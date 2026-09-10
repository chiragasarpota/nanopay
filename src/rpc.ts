/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import {
  checkAddress,
  checkAmount,
  checkHash,
  checkThreshold,
  checkWork,
} from './check.js'
import { rawToNano } from './amounts.js'
import { hashBlock } from './hash.js'
import { derivePublicKey } from './keys.js'
import { verifyBlock } from './signature.js'
import {
  DEFAULT_WORK_THRESHOLD,
  RECEIVE_WORK_THRESHOLD,
  validateWork,
} from './work.js'
import type { BlockRepresentation } from './block.js'

export interface RequestOptions {
  signal?: AbortSignal
}
export interface RpcClientOptions {
  /** Request timeout in milliseconds. Default: 15000. */
  timeoutMs?: number
  headers?: HeadersInit
  /** Supply a custom fetch implementation for your environment or tests. */
  fetch?: typeof globalThis.fetch
}
export interface AccountBalance {
  /** Confirmed Nano balance as an exact decimal string. */
  balance: string
  balanceRaw: string
  receivable: string
  receivableRaw: string
}
export interface AccountInfo {
  /** Current frontier, which may be unconfirmed. */
  frontier: string
  balance: string
  balanceRaw: string
  representative: string
  blockCount: string
  /** Only confirmed data from the same atomic account_info request. */
  confirmed: {
    frontier: string
    balance: string
    balanceRaw: string
    height: string
  }
}
export interface Receivable {
  hash: string
  amount: string
  amountRaw: string
  source: string
}
export interface HistoryEntry {
  type: string
  hash: string
  account?: string
  amount?: string
  amountRaw?: string
  localTimestamp?: string
}
export interface AccountHistory {
  entries: HistoryEntry[]
  previous?: string
  next?: string
}
export type BlockSubtype = 'send' | 'receive' | 'open' | 'change'
export interface BlockInfo {
  account: string
  amount: string
  amountRaw: string
  balance: string
  balanceRaw: string
  confirmed: boolean
  subtype?: string
  /** Node JSON representation; legacy blocks and state blocks are supported. */
  block: Record<string, unknown>
}

/** Distinguishes node/HTTP/protocol failures from ordinary input validation errors. */
export class NanoRpcError extends Error {
  override readonly name = 'NanoRpcError'
  constructor(
    message: string,
    readonly action: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
function record(value: unknown, action: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NanoRpcError('Invalid RPC response: expected an object', action)
  return value as Record<string, unknown>
}
function textField(value: unknown, action: string): string {
  if (typeof value !== 'string')
    throw new NanoRpcError('Invalid RPC response: expected a string', action)
  return value
}
function rawField(value: unknown, action: string): string {
  if (!checkAmount(value))
    throw new NanoRpcError(
      'Invalid RPC response: expected a raw amount',
      action,
    )
  return value
}
function hashField(value: unknown, action: string): string {
  if (!checkHash(value))
    throw new NanoRpcError(
      'Invalid RPC response: expected a block hash',
      action,
    )
  return value
}
function addressField(value: unknown, action: string): string {
  if (!checkAddress(value))
    throw new NanoRpcError(
      'Invalid RPC response: expected a Nano address',
      action,
    )
  return value
}
function requireAddress(account: string): void {
  if (!checkAddress(account)) throw new Error('Address is not valid')
}
function requireCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('Count must be a positive safe integer')
}

/** Stateless RPC client using native fetch. Concurrent calls share no mutable request state. */
export class NanoRpcClient {
  private readonly url: string
  private readonly timeoutMs: number
  private readonly headers: Headers
  private readonly fetch: typeof globalThis.fetch

  constructor(url: string, options: RpcClientOptions = {}) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      throw new Error('RPC URL must use HTTP or HTTPS')
    this.url = parsed.href
    this.timeoutMs = options.timeoutMs ?? 15000
    if (
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs < 1 ||
      this.timeoutMs > 2147483647
    )
      throw new Error(
        'Timeout must be an integer from 1 to 2147483647 milliseconds',
      )
    this.headers = new Headers(options.headers)
    this.headers.set('content-type', 'application/json')
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  /** Escape hatch for any documented Nano RPC. No retries; especially important for writes. */
  async request<T = Record<string, unknown>>(
    action: string,
    params: Record<string, unknown> = {},
    options: RequestOptions = {},
  ): Promise<T> {
    if (typeof action !== 'string' || !action.trim())
      throw new Error('RPC action is required')
    options.signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException('RPC request timed out', 'TimeoutError'),
        ),
      this.timeoutMs,
    )
    try {
      const response = await this.fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ ...params, action }),
        signal: controller.signal,
      })
      if (!response.ok)
        throw new NanoRpcError(
          `RPC HTTP error ${response.status}`,
          action,
          response.status,
        )
      let data: Record<string, unknown>
      try {
        data = record(await response.json(), action)
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        if (error instanceof NanoRpcError) throw error
        throw new NanoRpcError(
          'RPC returned invalid JSON',
          action,
          response.status,
          { cause: error },
        )
      }
      if (typeof data.error === 'string')
        throw new NanoRpcError(data.error, action, response.status)
      return data as T
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason
      if (error instanceof NanoRpcError) throw error
      throw new NanoRpcError('RPC request failed', action, undefined, {
        cause: error,
      })
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
    }
  }

  /** Read confirmed balance and receivable funds. Amounts are available in Nano and raw. */
  async getBalance(
    account: string,
    options: RequestOptions = {},
  ): Promise<AccountBalance> {
    requireAddress(account)
    const action = 'account_balance'
    const data = await this.request(
      action,
      { account, include_only_confirmed: true },
      options,
    )
    const balanceRaw = rawField(data.balance, action)
    const receivableRaw = rawField(data.receivable ?? data.pending, action)
    return {
      balance: rawToNano(balanceRaw),
      balanceRaw,
      receivable: rawToNano(receivableRaw),
      receivableRaw,
    }
  }

  /** Read an atomic account snapshot. Returns null for an unopened account. */
  async getAccountInfo(
    account: string,
    options: RequestOptions = {},
  ): Promise<AccountInfo | null> {
    requireAddress(account)
    const action = 'account_info'
    let data: Record<string, unknown>
    try {
      data = await this.request(
        action,
        { account, representative: true, include_confirmed: true },
        options,
      )
    } catch (error) {
      if (
        error instanceof NanoRpcError &&
        error.message === 'Account not found'
      )
        return null
      throw error
    }
    const balanceRaw = rawField(data.balance, action)
    const confirmedRaw = rawField(data.confirmed_balance, action)
    return {
      frontier: hashField(data.frontier, action),
      balance: rawToNano(balanceRaw),
      balanceRaw,
      representative: addressField(data.representative, action),
      blockCount: textField(data.block_count, action),
      confirmed: {
        frontier: hashField(data.confirmed_frontier, action),
        balance: rawToNano(confirmedRaw),
        balanceRaw: confirmedRaw,
        height: textField(data.confirmed_height, action),
      },
    }
  }

  /** List up to count confirmed incoming blocks that have not been received (default: 100). */
  async getReceivable(
    account: string,
    options: RequestOptions & { count?: number } = {},
  ): Promise<Receivable[]> {
    requireAddress(account)
    const count = options.count ?? 100
    requireCount(count)
    const action = 'receivable'
    const data = await this.request(
      action,
      {
        account,
        count: String(count),
        source: true,
        include_only_confirmed: true,
      },
      options,
    )
    if (
      data.blocks === '' ||
      (Array.isArray(data.blocks) && data.blocks.length === 0)
    )
      return []
    return Object.entries(record(data.blocks, action)).map(([hash, value]) => {
      const entry = record(value, action)
      const amountRaw = rawField(entry.amount, action)
      return {
        hash: hashField(hash, action),
        amount: rawToNano(amountRaw),
        amountRaw,
        source: addressField(entry.source, action),
      }
    })
  }

  /** Read account history. The node may return unconfirmed entries; use getBlock to check. */
  async getHistory(
    account: string,
    options: RequestOptions & { count?: number; head?: string } = {},
  ): Promise<AccountHistory> {
    requireAddress(account)
    const count = options.count ?? 100
    requireCount(count)
    if (options.head !== undefined && !checkHash(options.head))
      throw new Error('Head hash is not valid')
    const action = 'account_history'
    const data = await this.request(
      action,
      {
        account,
        count: String(count),
        ...(options.head ? { head: options.head } : {}),
      },
      options,
    )
    const history = data.history === '' ? [] : data.history
    if (!Array.isArray(history))
      throw new NanoRpcError('Invalid RPC response: expected history', action)
    return {
      entries: history.map((value) => {
        const entry = record(value, action)
        const amountRaw =
          entry.amount === undefined
            ? undefined
            : rawField(entry.amount, action)
        return {
          type: textField(entry.type, action),
          hash: hashField(entry.hash, action),
          ...(entry.account === undefined
            ? {}
            : { account: addressField(entry.account, action) }),
          ...(amountRaw === undefined
            ? {}
            : { amount: rawToNano(amountRaw), amountRaw }),
          ...(entry.local_timestamp === undefined
            ? {}
            : { localTimestamp: textField(entry.local_timestamp, action) }),
        }
      }),
      ...(data.previous === undefined
        ? {}
        : { previous: hashField(data.previous, action) }),
      ...(data.next === undefined
        ? {}
        : { next: hashField(data.next, action) }),
    }
  }

  /** Read a block and its confirmation status. */
  async getBlock(
    hash: string,
    options: RequestOptions = {},
  ): Promise<BlockInfo> {
    if (!checkHash(hash)) throw new Error('Hash is not valid')
    const action = 'block_info'
    const data = await this.request(action, { hash, json_block: true }, options)
    const amountRaw = rawField(data.amount, action)
    const balanceRaw = rawField(data.balance, action)
    if (
      ![true, false, 'true', 'false'].includes(
        data.confirmed as boolean | string,
      )
    )
      throw new NanoRpcError('Invalid RPC confirmation status', action)
    return {
      account: addressField(data.block_account, action),
      amount: rawToNano(amountRaw),
      amountRaw,
      balance: rawToNano(balanceRaw),
      balanceRaw,
      confirmed: data.confirmed === true || data.confirmed === 'true',
      ...(data.subtype === undefined
        ? {}
        : { subtype: textField(data.subtype, action) }),
      block: record(data.contents, action),
    }
  }

  /** Ask your node/work peers for PoW. Use the previous hash, or public key for an open block. */
  async generateWork(
    root: string,
    options: RequestOptions & { threshold?: string } = {},
  ): Promise<string> {
    if (!checkHash(root)) throw new Error('Work root is not valid')
    const threshold = options.threshold ?? DEFAULT_WORK_THRESHOLD
    if (!checkThreshold(threshold)) throw new Error('Threshold is not valid')
    const action = 'work_generate'
    const data = await this.request(
      action,
      { hash: root, difficulty: threshold, use_peers: true },
      options,
    )
    if (
      !checkWork(data.work) ||
      !validateWork({ blockHash: root, work: data.work, threshold })
    )
      throw new NanoRpcError('RPC returned invalid proof of work', action)
    return data.work
  }

  /** Publish a locally signed state block. The returned hash is acceptance, not confirmation. */
  async publishBlock(
    block: BlockRepresentation,
    subtype: BlockSubtype,
    options: RequestOptions = {},
  ): Promise<string> {
    if (!['send', 'receive', 'open', 'change'].includes(subtype))
      throw new Error('Block subtype is not valid')
    if (!block || block.type !== 'state')
      throw new Error('A state block is required')
    const hash = hashBlock(block)
    const publicKey = derivePublicKey(block.account)
    if (!verifyBlock({ hash, publicKey, signature: block.signature }))
      throw new Error('Block signature is not valid')
    const threshold =
      subtype === 'receive' || subtype === 'open'
        ? RECEIVE_WORK_THRESHOLD
        : DEFAULT_WORK_THRESHOLD
    const root = /^0{64}$/.test(block.previous) ? publicKey : block.previous
    if (
      !checkWork(block.work) ||
      !validateWork({ blockHash: root, work: block.work, threshold })
    )
      throw new Error('Block proof of work is not valid')
    // Only serialize protocol fields; accidental extra properties never leave the caller.
    const wireBlock: BlockRepresentation = {
      type: block.type,
      account: block.account,
      previous: block.previous,
      representative: block.representative,
      balance: block.balance,
      link: block.link,
      link_as_account: block.link_as_account,
      signature: block.signature,
      work: block.work,
    }
    const data = await this.request(
      'process',
      { json_block: true, subtype, block: wireBlock },
      options,
    )
    const publishedHash = hashField(data.hash, 'process')
    if (publishedHash.toUpperCase() !== hash)
      throw new NanoRpcError('RPC returned a different block hash', 'process')
    return publishedHash
  }
}

/** Connect to your chosen Nano node. No global initialization or default third-party endpoint. */
export function createRpcClient(
  url: string,
  options: RpcClientOptions = {},
): NanoRpcClient {
  return new NanoRpcClient(url, options)
}
