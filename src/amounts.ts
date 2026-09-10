/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { checkAmount } from './check.js'
import { convert } from './conversion.js'

/** Convert a Nano decimal string to an exact raw balance. 1 Nano = 10^30 raw. */
export function nanoToRaw(amount: string): string {
  const raw = convert(amount, { from: 'NANO', to: 'raw' })
  if (!checkAmount(raw))
    throw new Error('Amount must be whole raw within the uint128 range')
  return raw
}

/** Convert a raw string or bigint to Nano, without precision loss. */
export function rawToNano(raw: string | bigint): string {
  const amount = typeof raw === 'bigint' ? raw.toString() : raw
  if (!checkAmount(amount)) throw new Error('Raw amount is not valid')
  return convert(amount, { from: 'raw', to: 'NANO' })
}
