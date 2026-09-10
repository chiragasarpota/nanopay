/*!
 * Derived from nanocurrency-js, Copyright (c) 2019 Marvin ROGER.
 * Modified for nanopay by chiragasarpota, 2026-09-10. GPL-3.0-only.
 */
import { checkNumber } from './check.js'

/** Nano units. Prefer nanoToRaw/rawToNano for everyday amounts. */
export enum Unit {
  hex = 'hex',
  raw = 'raw',
  /** Legacy micronano: 10^24 raw. Use NANO for everyday Nano amounts. */
  nano = 'nano',
  knano = 'knano',
  Nano = 'Nano',
  NANO = 'NANO',
  KNano = 'KNano',
  MNano = 'MNano',
}
const DECIMALS: Record<Unit, number> = {
  hex: 0,
  raw: 0,
  nano: 24,
  knano: 27,
  Nano: 30,
  NANO: 30,
  KNano: 33,
  MNano: 36,
}
export interface ConvertParams {
  from: Unit | `${Unit}`
  to: Unit | `${Unit}`
}

/** Convert exactly, without floating point or rounding. Hex output must fit uint128. */
export function convert(value: string, params: ConvertParams): string {
  if (
    !params ||
    !Object.hasOwn(DECIMALS, params.from) ||
    !Object.hasOwn(DECIMALS, params.to)
  ) {
    throw new Error('From or to is not valid')
  }
  if (params.from === 'hex') {
    if (typeof value !== 'string' || !/^[0-9a-fA-F]{32}$/.test(value))
      throw new Error('Value is not valid')
    value = BigInt(`0x${value}`).toString()
  } else if (!checkNumber(value)) {
    throw new Error('Value is not valid')
  }

  const [whole, fraction = ''] = value.split('.')
  let digits = (whole + fraction).replace(/^0+/, '') || '0'
  const scale = fraction.length - DECIMALS[params.from] + DECIMALS[params.to]
  let result: string
  if (digits === '0') {
    result = '0'
  } else if (scale <= 0) {
    result = digits + '0'.repeat(-scale)
  } else {
    digits = digits.padStart(scale + 1, '0')
    result = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(
      /\.?0+$/,
      '',
    )
  }

  if (params.to !== 'hex') return result
  if (result.includes('.'))
    throw new Error('Hex amount must be a whole number of raw')
  const raw = BigInt(result)
  if (raw >= 1n << 128n)
    throw new Error('Hex amount exceeds the uint128 maximum')
  return raw.toString(16).padStart(32, '0')
}
