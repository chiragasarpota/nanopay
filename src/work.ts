/*!
 * Derived from nanocurrency-js, Copyright (c) 2019 Marvin ROGER.
 * Modified for nanopay by chiragasarpota, 2026-09-10. GPL-3.0-only.
 */
import blake from 'blakejs'
const { blake2b } = blake
import { checkHash, checkThreshold, checkWork } from './check.js'
import { hexToByteArray } from './utils.js'

/** Mainnet epoch 2 send/change difficulty. */
export const SEND_WORK_THRESHOLD = 'fffffff800000000'
/** Mainnet epoch 2 receive/open difficulty. */
export const RECEIVE_WORK_THRESHOLD = 'fffffe0000000000'
/** Historical epoch 1 difficulty; do not use for new send/change blocks. */
export const LEGACY_WORK_THRESHOLD = 'ffffffc000000000'
export const DEFAULT_WORK_THRESHOLD = SEND_WORK_THRESHOLD

export interface ValidateWorkParams {
  /** Previous block hash; for an open block, the account public key. */
  blockHash: string
  work: string
  /** Defaults to the mainnet send/change threshold. */
  threshold?: string
}

/** Verify a PoW nonce using Nano's BLAKE2b-8 equation and little-endian ordering. */
export function validateWork(params: ValidateWorkParams): boolean {
  const threshold = params.threshold ?? DEFAULT_WORK_THRESHOLD
  if (!checkHash(params.blockHash)) throw new Error('Hash is not valid')
  if (!checkWork(params.work)) throw new Error('Work is not valid')
  if (!checkThreshold(threshold)) throw new Error('Threshold is not valid')
  const input = new Uint8Array(40)
  input.set(hexToByteArray(params.work).reverse())
  input.set(hexToByteArray(params.blockHash), 8)
  const hash = blake2b(input, undefined, 8)
  const target = hexToByteArray(threshold)
  // Compare high bytes first. No BigInt allocation or hex round trip per hash.
  for (let i = 0; i < 8; i++) {
    const difference = hash[7 - i] - target[i]
    if (difference !== 0) return difference > 0
  }
  return true
}
