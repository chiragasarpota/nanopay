/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { normalizeAddress } from './accounts.js'
import { nanoToRaw, rawToNano } from './amounts.js'
import { checkAmount } from './check.js'
import type { Amount } from './state-blocks.js'
export interface PaymentRequest {
  address: string
  amount?: string
  amountRaw?: string
  label?: string
  message?: string
}
export type CreatePaymentRequest = Omit<
  PaymentRequest,
  'amount' | 'amountRaw'
> &
  (Amount | { amount?: never; amountRaw?: never })
/** Create a nano: payment URI. Input amount is Nano; the URI always encodes raw. */
export function createPaymentUri(request: CreatePaymentRequest): string {
  const address = normalizeAddress(request.address)
  const query = new URLSearchParams()
  if (request.amount !== undefined && request.amountRaw !== undefined)
    throw new Error('Provide amount or amountRaw, not both')
  if (request.amount !== undefined)
    query.set('amount', nanoToRaw(request.amount))
  if (request.amountRaw !== undefined) {
    if (!checkAmount(request.amountRaw))
      throw new Error('Raw amount is not valid')
    query.set('amount', request.amountRaw)
  }
  for (const key of ['label', 'message'] as const) {
    if (request[key] !== undefined) {
      if (typeof request[key] !== 'string')
        throw new Error(key + ' must be a string')
      query.set(key, request[key])
    }
  }
  return 'nano:' + address + (query.size ? '?' + query.toString() : '')
}
/** Parse payment nano: URIs and nano:// deep links. Reject unsupported actions and ambiguous parameters. */
export function parsePaymentUri(uri: string): PaymentRequest {
  if (
    typeof uri !== 'string' ||
    !/^nano:(?:\/\/)?nano_[^?#]+(?:\?[^#]*)?$/i.test(uri)
  )
    throw new Error('Invalid Nano payment URI')
  const value = uri.replace(/^nano:(?:\/\/)?/i, '')
  const separator = value.indexOf('?')
  const address = separator < 0 ? value : value.slice(0, separator)
  const search = separator < 0 ? '' : value.slice(separator + 1)
  const query = new URLSearchParams(search)
  for (const key of query.keys()) {
    if (
      !['amount', 'label', 'message'].includes(key) ||
      query.getAll(key).length !== 1
    )
      throw new Error('Unsupported or duplicate payment parameter')
  }
  const amountRaw = query.get('amount')
  if (amountRaw !== null && !checkAmount(amountRaw))
    throw new Error('URI amount must be a canonical raw amount')
  return {
    address: normalizeAddress(address),
    ...(amountRaw === null ? {} : { amountRaw, amount: rawToNano(amountRaw) }),
    ...(query.has('label') ? { label: query.get('label')! } : {}),
    ...(query.has('message') ? { message: query.get('message')! } : {}),
  }
}
