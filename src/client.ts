/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import {
  NanoRpcClient,
  NanoRpcError,
  type RpcClientOptions,
  type RequestOptions,
  type BlockSubtype,
  type BlockInfo,
  type Receivable,
  type AccountInfo,
} from './rpc.js'
import {
  accountFromPrivateKey,
  normalizeAddress,
  publicKeyFromAddress,
  type Account,
} from './accounts.js'
import { deriveAddress } from './keys.js'
import {
  buildSendBlock,
  buildReceiveBlock,
  buildChangeBlock,
  signHash,
  attachSignature,
  getWorkRoot,
  type UnsignedBlock,
  type SignedBlock,
  type Amount,
} from './state-blocks.js'
import { hashBlock } from './hash.js'
import { attachWork } from './proof-of-work.js'
import { RECEIVE_WORK_THRESHOLD, SEND_WORK_THRESHOLD } from './work.js'
import { checkHash } from './check.js'
import { rawToNano } from './amounts.js'
import { abortable, delay, positiveMilliseconds } from './async.js'

/** Bring a hardware wallet or external signer. Only publicKey and sign(hash) are required. */
export interface Signer {
  readonly publicKey: string
  sign(hash: string): string | Promise<string>
}
export type SigningAccount = Account | Signer
export interface WorkRequest {
  root: string
  threshold: string
  signal?: AbortSignal
}
export type WorkProvider = (request: WorkRequest) => string | Promise<string>
export interface ClientOptions extends RpcClientOptions {
  rpcUrl: string
  /** Used only for the first receive when no representative is supplied. */
  representative?: string
  /** Defaults to RPC work_generate. Replace with local WASM, a GPU or your work service. */
  work?: WorkProvider
}
type AccountState = Pick<
  AccountInfo,
  'frontier' | 'balanceRaw' | 'representative'
>
export interface PreparedTransaction {
  readonly hash: string
  readonly block: UnsignedBlock
  readonly subtype: BlockSubtype
}
export interface TransactionResult {
  hash: string
  block: SignedBlock
  subtype: BlockSubtype
  status: 'submitted'
}
export type PrepareSendOptions = RequestOptions &
  Amount & { account: string; to: string }
export interface PrepareReceiveOptions extends RequestOptions {
  account: string
  hash: string
  representative?: string
}
export interface PrepareChangeOptions extends RequestOptions {
  account: string
  representative: string
}
export type SendOptions = Omit<
  PrepareSendOptions,
  'account' | 'amount' | 'amountRaw'
> &
  Amount & { account: SigningAccount }
export interface ReceiveOptions extends Omit<PrepareReceiveOptions, 'account'> {
  account: SigningAccount
}
export interface ChangeRepresentativeOptions extends Omit<
  PrepareChangeOptions,
  'account'
> {
  account: SigningAccount
}
export interface ReceiveAllOptions extends RequestOptions {
  account: SigningAccount
  representative?: string
  maxBlocks?: number
}
export interface ReceiveAllResult {
  transactions: TransactionResult[]
  amount: string
  amountRaw: string
  hasMore: boolean
}
export interface ConfirmationOptions extends RequestOptions {
  timeoutMs?: number
  pollIntervalMs?: number
}
/** The node may have accepted this exact block. Inspect its hash before deciding what to do next. */
export class TransactionError extends Error {
  override readonly name = 'TransactionError'
  constructor(
    readonly transaction: Omit<TransactionResult, 'status'>,
    cause: unknown,
  ) {
    super('Block submission failed; check transaction.hash before retrying', {
      cause,
    })
  }
}
/** This write was not started because an earlier submission still needs reconciliation. */
export class AccountBlockedError extends Error {
  override readonly name = 'AccountBlockedError'
  readonly transaction: TransactionError['transaction']
  constructor(cause: TransactionError) {
    super(
      'Account writes are blocked; reconcile transaction.hash before resuming',
      {
        cause,
      },
    )
    this.transaction = cause.transaction
  }
}
export class ReceiveAllError extends Error {
  override readonly name = 'ReceiveAllError'
  constructor(
    readonly completed: ReceiveAllResult,
    cause: unknown,
  ) {
    super(
      'Receiving stopped; completed contains the blocks already submitted',
      { cause },
    )
  }
}
/** Turn local key material into the same interface used by external signers. */
export function createSigner(privateKey: string): Signer {
  const account = accountFromPrivateKey(privateKey)
  return Object.freeze({
    publicKey: account.publicKey,
    sign: (hash: string) => signHash(hash, account.privateKey),
  })
}
function signerFor(account: SigningAccount): Signer {
  if ('privateKey' in account) {
    const signer = createSigner(account.privateKey)
    if (
      signer.publicKey !== account.publicKey.toUpperCase() ||
      deriveAddress(signer.publicKey) !== normalizeAddress(account.address)
    )
      throw new Error('Account keys and address do not match')
    return signer
  }
  deriveAddress(account.publicKey)
  if (typeof account.sign !== 'function')
    throw new Error('Account must provide a sign(hash) function')
  // Snapshot the key and bind the callback so caller mutation cannot change a queued transaction's identity.
  return {
    publicKey: account.publicKey.toUpperCase(),
    sign: account.sign.bind(account),
  }
}
function prepared(
  block: UnsignedBlock,
  subtype: BlockSubtype,
): PreparedTransaction {
  return Object.freeze({
    block: Object.freeze(block),
    hash: hashBlock(block),
    subtype,
  })
}
interface AccountQueue {
  tail: Promise<void>
  failure?: TransactionError
}
/** RPC reads and granular prepare/publish methods, plus serialized account transaction workflows. */
export class NanoClient extends NanoRpcClient {
  private readonly representative?: string
  private readonly workProvider: WorkProvider
  private readonly queues = new Map<string, AccountQueue>()
  constructor(options: ClientOptions) {
    super(options.rpcUrl, options)
    this.representative =
      options.representative === undefined
        ? undefined
        : normalizeAddress(options.representative)
    this.workProvider =
      options.work ??
      (({ root, threshold, signal }) =>
        this.generateWork(root, { threshold, signal }))
  }
  /** Read current ledger state and build an unsigned send for manual signing/submission. */
  async prepareSend(options: PrepareSendOptions): Promise<PreparedTransaction> {
    options = { ...options }
    const account = normalizeAddress(options.account)
    const info = await this.getAccountInfo(account, options)
    if (!info) throw new Error('Cannot send from an unopened account')
    return prepared(
      buildSendBlock({
        ...options,
        account,
        previous: info.frontier,
        representative: info.representative,
        balanceRaw: info.balanceRaw,
      }),
      'send',
    )
  }
  /** Verify the confirmed source and destination, then build an unsigned receive/open. */
  async prepareReceive(
    options: PrepareReceiveOptions,
  ): Promise<PreparedTransaction> {
    options = { ...options }
    const account = normalizeAddress(options.account)
    if (!checkHash(options.hash)) throw new Error('Hash is not valid')
    const [info, incoming] = await Promise.all([
      this.getAccountInfo(account, options),
      this.receiveSource(account, options.hash.toUpperCase(), options),
    ])
    return this.prepareIncoming(account, info, incoming, options.representative)
  }
  private async receiveSource(
    account: string,
    hash: string,
    options: RequestOptions,
  ): Promise<Pick<Receivable, 'hash' | 'amountRaw'>> {
    // Retained history gives a constant-size lookup, even for accounts with many receivables.
    try {
      const [source, receivable] = await Promise.all([
        this.getBlock(hash, options),
        this.isReceivable(hash, options),
      ])
      const destination =
        source.block.type === 'state'
          ? source.block.link
          : typeof source.block.destination === 'string'
            ? publicKeyFromAddress(source.block.destination)
            : undefined
      if (
        !receivable ||
        !source.confirmed ||
        (source.subtype !== 'send' && source.block.type !== 'send') ||
        typeof destination !== 'string' ||
        destination.toUpperCase() !== publicKeyFromAddress(account)
      )
        throw new Error(
          'Source must be a confirmed, unreceived send to this account',
        )
      if (source.amountRaw !== undefined)
        return { hash, amountRaw: source.amountRaw }
    } catch (error) {
      if (!(
        error instanceof NanoRpcError &&
        ['block_info', 'receivable_exists'].includes(error.action) &&
        error.message === 'Block not found'
      ))
        throw error
    }
    // Pruning preserves confirmed receivable records, including ownership and amount.
    // Page only on this fallback path so a large account cannot create one unbounded response.
    const count = 1000
    for (let offset = 0; ; offset += count) {
      options.signal?.throwIfAborted()
      const entries = await this.getReceivable(account, {
        ...options,
        count,
        offset,
      })
      const incoming = entries.find(
        (entry) => entry.hash.toUpperCase() === hash,
      )
      if (incoming) return incoming
      if (entries.length < count)
        throw new Error(
          'Source must be a confirmed, unreceived send to this account',
        )
    }
  }
  async prepareChangeRepresentative(
    options: PrepareChangeOptions,
  ): Promise<PreparedTransaction> {
    options = { ...options }
    const account = normalizeAddress(options.account)
    const info = await this.getAccountInfo(account, options)
    if (!info)
      throw new Error(
        'Receive funds to open the account before changing its representative',
      )
    return prepared(
      buildChangeBlock({
        account,
        previous: info.frontier,
        balanceRaw: info.balanceRaw,
        representative: options.representative,
      }),
      'change',
    )
  }
  private prepareIncoming(
    account: string,
    info: AccountState | null,
    incoming: Pick<Receivable, 'hash' | 'amountRaw'>,
    requestedRepresentative?: string,
  ): PreparedTransaction {
    const representative =
      requestedRepresentative ?? info?.representative ?? this.representative
    if (!representative)
      throw new Error('Choose a representative for the first receive')
    return prepared(
      buildReceiveBlock({
        account,
        previous: info?.frontier ?? null,
        balanceRaw: info?.balanceRaw ?? '0',
        representative,
        sourceHash: incoming.hash,
        amountRaw: incoming.amountRaw,
      }),
      info ? 'receive' : 'open',
    )
  }
  /**
   * Allow new writes after the caller has reconciled this exact failed submission.
   * This only clears the local block; it does not cancel or check the node request.
   * Previously queued writes remain rejected and are never replayed.
   */
  resumeAccount(address: string, transactionHash: string): void {
    address = normalizeAddress(address)
    if (!checkHash(transactionHash)) throw new Error('Invalid transaction hash')
    const queue = this.queues.get(address)
    if (
      !queue?.failure ||
      queue.failure.transaction.hash !== transactionHash.toUpperCase()
    )
      throw new Error('No blocked transaction matches this account and hash')
    this.queues.delete(address)
  }
  private async serialize<T>(
    address: string,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    signal?.throwIfAborted()
    const queue = this.queues.get(address) ?? { tail: Promise.resolve() }
    const previous = queue.tail
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    queue.tail = tail
    this.queues.set(address, queue)
    try {
      await abortable(previous, signal)
      signal?.throwIfAborted()
      if (queue.failure) throw new AccountBlockedError(queue.failure)
      return await operation()
    } catch (error) {
      const cause = error instanceof ReceiveAllError ? error.cause : error
      if (cause instanceof TransactionError) queue.failure = cause
      throw error
    } finally {
      release()
      void tail.then(() => {
        if (
          !queue.failure &&
          queue.tail === tail &&
          this.queues.get(address) === queue
        )
          this.queues.delete(address)
      })
    }
  }
  private async submit(
    transaction: PreparedTransaction,
    signer: Signer,
    options: RequestOptions,
  ): Promise<TransactionResult> {
    options.signal?.throwIfAborted()
    // Verify the signature before spending time on proof of work; the callback never receives private data.
    const signed = attachSignature(
      transaction.block,
      await abortable(
        Promise.resolve(signer.sign(transaction.hash)),
        options.signal,
      ),
    )
    options.signal?.throwIfAborted()
    const threshold =
      transaction.subtype === 'receive' || transaction.subtype === 'open'
        ? RECEIVE_WORK_THRESHOLD
        : SEND_WORK_THRESHOLD
    const work = await abortable(
      Promise.resolve(
        this.workProvider({
          root: getWorkRoot(signed),
          threshold,
          signal: options.signal,
        }),
      ),
      options.signal,
    )
    const block = attachWork(signed, work, { threshold })
    options.signal?.throwIfAborted()
    try {
      const hash = await this.publishBlock(block, transaction.subtype, options)
      return { hash, block, subtype: transaction.subtype, status: 'submitted' }
    } catch (cause) {
      throw new TransactionError(
        { hash: transaction.hash, block, subtype: transaction.subtype },
        cause,
      )
    }
  }
  async send(options: SendOptions): Promise<TransactionResult> {
    options = { ...options }
    const signer = signerFor(options.account)
    const account = deriveAddress(signer.publicKey)
    return this.serialize(account, options.signal, async () =>
      this.submit(
        await this.prepareSend({ ...options, account }),
        signer,
        options,
      ),
    )
  }
  async receive(options: ReceiveOptions): Promise<TransactionResult> {
    options = { ...options }
    const signer = signerFor(options.account)
    const account = deriveAddress(signer.publicKey)
    return this.serialize(account, options.signal, async () =>
      this.submit(
        await this.prepareReceive({ ...options, account }),
        signer,
        options,
      ),
    )
  }
  async changeRepresentative(
    options: ChangeRepresentativeOptions,
  ): Promise<TransactionResult> {
    options = { ...options }
    const signer = signerFor(options.account)
    const account = deriveAddress(signer.publicKey)
    return this.serialize(account, options.signal, async () =>
      this.submit(
        await this.prepareChangeRepresentative({ ...options, account }),
        signer,
        options,
      ),
    )
  }
  /** Receive a bounded snapshot (default 100 blocks), reusing the resulting frontier after each submission. */
  async receiveAll(options: ReceiveAllOptions): Promise<ReceiveAllResult> {
    options = { ...options }
    const maxBlocks = options.maxBlocks ?? 100
    if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 10000)
      throw new Error('maxBlocks must be an integer from 1 to 10000')
    const signer = signerFor(options.account)
    const account = deriveAddress(signer.publicKey)
    return this.serialize(account, options.signal, async () => {
      const [initialInfo, incoming] = await Promise.all([
        this.getAccountInfo(account, options),
        this.getReceivable(account, { ...options, count: maxBlocks + 1 }),
      ])
      let info: AccountState | null = initialInfo
      const transactions: TransactionResult[] = []
      let total = 0n
      const result = (): ReceiveAllResult => ({
        transactions: [...transactions],
        amountRaw: total.toString(),
        amount: rawToNano(total),
        hasMore: incoming.length > transactions.length,
      })
      try {
        for (const entry of incoming.slice(0, maxBlocks)) {
          const transaction = this.prepareIncoming(
            account,
            info,
            entry,
            options.representative,
          )
          const submitted = await this.submit(transaction, signer, options)
          transactions.push(submitted)
          total += BigInt(entry.amountRaw)
          info = {
            frontier: submitted.hash,
            balanceRaw: submitted.block.balance,
            representative: submitted.block.representative,
          }
        }
        return result()
      } catch (cause) {
        throw new ReceiveAllError(result(), cause)
      }
    })
  }
  /** Wait for ledger confirmation. Submission acceptance alone is not payment finality. */
  async waitForConfirmation(
    hash: string,
    options: ConfirmationOptions = {},
  ): Promise<BlockInfo> {
    options = { ...options }
    if (!checkHash(hash)) throw new Error('Hash is not valid')
    const timeoutMs = options.timeoutMs ?? 60000
    const pollIntervalMs = options.pollIntervalMs ?? 1000
    positiveMilliseconds(timeoutMs)
    positiveMilliseconds(pollIntervalMs)
    options.signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException('Confirmation timed out', 'TimeoutError'),
        ),
      timeoutMs,
    )
    try {
      for (;;) {
        controller.signal.throwIfAborted()
        try {
          const block = await this.getBlock(hash, { signal: controller.signal })
          if (block.confirmed) return block
        } catch (error) {
          if (!(
            error instanceof NanoRpcError &&
            error.action === 'block_info' &&
            error.message === 'Block not found'
          ))
            throw error
        }
        await delay(pollIntervalMs, controller.signal)
      }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
    }
  }
}
export function createClient(options: ClientOptions): NanoClient {
  return new NanoClient(options)
}
