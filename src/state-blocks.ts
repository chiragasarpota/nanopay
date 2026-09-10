/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { checkHash, checkAmount, checkWork } from './check.js'
import {
  publicKeyFromAddress,
  normalizeAddress,
  addressFromPrivateKey,
} from './accounts.js'
import { deriveAddress } from './keys.js'
import { nanoToRaw } from './amounts.js'
import { hashBlock } from './hash.js'
import { signBlock as sign, verifyBlock as verify } from './signature.js'
import type { BlockRepresentation } from './block.js'

export const ZERO_HASH = '0'.repeat(64)
export type UnsignedBlock = Omit<BlockRepresentation, 'signature'>
export type SignedBlock = BlockRepresentation
export type Amount =
  { amount: string; amountRaw?: never } | { amountRaw: string; amount?: never }
export interface BuildBlockParams {
  account: string
  previous: string | null
  representative: string
  /** Resulting balance in raw. */
  balanceRaw: string
  /** Destination address for send, source hash for receive/open, null for change. */
  link: string | null
  work?: string | null
}
export interface BuildTransactionParams {
  account: string
  previous: string
  representative: string
  /** Current balance in raw. */
  balanceRaw: string
  work?: string | null
}
export type BuildSendParams = BuildTransactionParams & Amount & { to: string }
export interface BuildReceiveParams extends Omit<
  BuildTransactionParams,
  'previous'
> {
  previous: string | null
  sourceHash: string
  amountRaw: string
}
/** Resolve an explicit Nano or raw amount without floating-point arithmetic. */
function resolveAmount(params: Amount): string {
  if ((params.amount !== undefined) === (params.amountRaw !== undefined))
    throw new Error('Provide exactly one of amount (Nano) or amountRaw')
  const raw =
    params.amount !== undefined ? nanoToRaw(params.amount) : params.amountRaw
  if (!checkAmount(raw)) throw new Error('Raw amount is not valid')
  return raw
}
/** Build an unsigned state block. No keys, signing, work generation or networking. */
export function buildBlock(params: BuildBlockParams): UnsignedBlock {
  const account = normalizeAddress(params.account)
  const representative = normalizeAddress(params.representative)
  const previous = params.previous ?? ZERO_HASH
  let link = params.link ?? ZERO_HASH
  const destination = link.startsWith('nano_') || link.startsWith('xrb_')
  if (destination) link = publicKeyFromAddress(link)
  if (!checkHash(previous) || !checkHash(link))
    throw new Error('Previous or link hash is not valid')
  if (!checkAmount(params.balanceRaw))
    throw new Error('Raw balance is not valid')
  if (previous === ZERO_HASH && (destination || link === ZERO_HASH))
    throw new Error('An open block requires a source hash')
  if (params.work != null && !checkWork(params.work))
    throw new Error('Work must be 16 hexadecimal characters')
  return {
    type: 'state',
    account,
    representative,
    previous: previous.toUpperCase(),
    balance: params.balanceRaw,
    link: link.toUpperCase(),
    link_as_account: deriveAddress(link),
    work: params.work ?? null,
  }
}
export function buildSendBlock(params: BuildSendParams): UnsignedBlock {
  if (!checkHash(params.previous) || params.previous === ZERO_HASH)
    throw new Error('A send requires an opened account')
  publicKeyFromAddress(params.to)
  if (!checkAmount(params.balanceRaw))
    throw new Error('Raw balance is not valid')
  const amount = BigInt(resolveAmount(params))
  if (amount === 0n) throw new Error('Send amount must be greater than zero')
  if (amount > BigInt(params.balanceRaw))
    throw new Error('Insufficient balance')
  return buildBlock({
    ...params,
    balanceRaw: (BigInt(params.balanceRaw) - amount).toString(),
    link: params.to,
  })
}
export function buildReceiveBlock(params: BuildReceiveParams): UnsignedBlock {
  if (!checkHash(params.sourceHash) || params.sourceHash === ZERO_HASH)
    throw new Error('Source hash is not valid')
  if (!checkAmount(params.amountRaw) || params.amountRaw === '0')
    throw new Error('Incoming amount must be positive raw')
  if (!checkAmount(params.balanceRaw))
    throw new Error('Raw balance is not valid')
  if (
    (params.previous === null || params.previous === ZERO_HASH) &&
    params.balanceRaw !== '0'
  )
    throw new Error('An unopened account must have zero current balance')
  return buildBlock({
    ...params,
    link: params.sourceHash,
    balanceRaw: (
      BigInt(params.balanceRaw) + BigInt(params.amountRaw)
    ).toString(),
  })
}
export function buildChangeBlock(
  params: BuildTransactionParams,
): UnsignedBlock {
  if (!checkHash(params.previous) || params.previous === ZERO_HASH)
    throw new Error('A representative change requires an opened account')
  return buildBlock({ ...params, link: null })
}
export function signHash(hash: string, privateKey: string): string {
  return sign({ hash, secretKey: privateKey })
}
/** Invalid inputs and invalid signatures both return false. */
export function verifyHash(params: {
  hash: string
  signature: string
  publicKey: string
}): boolean {
  try {
    return verify(params)
  } catch {
    return false
  }
}
/** Attach a locally verified external signature, copying only protocol fields. */
export function attachSignature(
  block: UnsignedBlock,
  signature: string,
): SignedBlock {
  const clean = buildBlock({
    account: block.account,
    previous: block.previous,
    representative: block.representative,
    balanceRaw: block.balance,
    link: block.link,
    work: block.work,
  })
  if (
    !verifyHash({
      hash: hashBlock(clean),
      signature,
      publicKey: publicKeyFromAddress(clean.account),
    })
  )
    throw new Error('Block signature is not valid')
  return { ...clean, signature: signature.toUpperCase() }
}
/** Sign an actual block. Use signHash to sign an already computed hash. */
export function signBlock(
  block: UnsignedBlock,
  privateKey: string,
): SignedBlock {
  if (normalizeAddress(block.account) !== addressFromPrivateKey(privateKey))
    throw new Error('Private key does not match block account')
  const clean = buildBlock({
    account: block.account,
    previous: block.previous,
    representative: block.representative,
    balanceRaw: block.balance,
    link: block.link,
    work: block.work,
  })
  return { ...clean, signature: signHash(hashBlock(clean), privateKey) }
}
/** Verify the signature and state block fields; does not check PoW or ledger validity. */
export function verifyBlock(block: SignedBlock): boolean {
  try {
    return (
      block.type === 'state' &&
      verifyHash({
        hash: hashBlock(block),
        signature: block.signature,
        publicKey: publicKeyFromAddress(block.account),
      })
    )
  } catch {
    return false
  }
}
/** Previous hash for existing accounts, public key for the first receive. */
export function getWorkRoot(
  block: Pick<UnsignedBlock, 'previous' | 'account'>,
): string {
  if (!checkHash(block.previous)) throw new Error('Previous hash is not valid')
  return block.previous === ZERO_HASH
    ? publicKeyFromAddress(block.account)
    : block.previous
}

export type CreateSendParams = Omit<
  BuildSendParams,
  'account' | 'amount' | 'amountRaw'
> &
  Amount & { privateKey: string }
export type CreateReceiveParams = Omit<BuildReceiveParams, 'account'> & {
  privateKey: string
}
export type CreateChangeParams = Omit<BuildTransactionParams, 'account'> & {
  privateKey: string
}
export interface CreatedBlock {
  hash: string
  block: SignedBlock
}
function created(block: UnsignedBlock, privateKey: string): CreatedBlock {
  // Each caller has just built this block with an address derived from this key.
  const hash = hashBlock(block)
  return { hash, block: { ...block, signature: signHash(hash, privateKey) } }
}
/** Build and sign locally; leaves work null unless supplied. */
export function createSendBlock(params: CreateSendParams): CreatedBlock {
  return created(
    buildSendBlock({
      ...params,
      account: addressFromPrivateKey(params.privateKey),
    }),
    params.privateKey,
  )
}
export function createReceiveBlock(params: CreateReceiveParams): CreatedBlock {
  return created(
    buildReceiveBlock({
      ...params,
      account: addressFromPrivateKey(params.privateKey),
    }),
    params.privateKey,
  )
}
export function createChangeBlock(params: CreateChangeParams): CreatedBlock {
  return created(
    buildChangeBlock({
      ...params,
      account: addressFromPrivateKey(params.privateKey),
    }),
    params.privateKey,
  )
}
