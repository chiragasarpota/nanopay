/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { normalizeAddress } from './accounts.js'
import { checkHash, checkAmount } from './check.js'
import { rawToNano } from './amounts.js'
import { positiveMilliseconds } from './async.js'
export interface Confirmation {
  hash: string
  account: string
  amount: string
  amountRaw: string
  confirmationType: string
  block: Record<string, unknown>
}
export interface WatchConfirmationsOptions {
  accounts?: string[]
  signal?: AbortSignal
  /** Maximum buffered events before failing explicitly. Default: 1000. */
  bufferSize?: number
  /** Connection/subscription timeout. Default: 15000 milliseconds. */
  timeoutMs?: number
  /** Browser-compatible socket factory for alternate runtimes or tests. */
  webSocket?: (url: string) => WebSocket
}
/** Live node notifications. Deduplicate by hash and reconcile through RPC after a disconnect. */
export async function* watchConfirmations(
  url: string,
  options: WatchConfirmationsOptions = {},
): AsyncGenerator<Confirmation> {
  options = { ...options }
  const parsed = new URL(url)
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new Error('WebSocket URL must use ws or wss')
  const accounts = options.accounts?.map(normalizeAddress)
  if (accounts?.length === 0)
    throw new Error(
      'Omit accounts for all confirmations; an empty filter matches nothing',
    )
  const capacity = options.bufferSize ?? 1000
  if (!Number.isSafeInteger(capacity) || capacity < 1)
    throw new Error('bufferSize must be a positive safe integer')
  const timeoutMs = options.timeoutMs ?? 15000
  positiveMilliseconds(timeoutMs)
  options.signal?.throwIfAborted()
  const socket = (options.webSocket ?? ((value) => new WebSocket(value)))(
    parsed.href,
  )
  const queue: Confirmation[] = []
  let failure: unknown
  let failed = false
  let wake: (() => void) | undefined
  const fail = (error: unknown) => {
    if (!failed) {
      failed = true
      failure = error
      clearTimeout(timer)
      socket.close()
      wake?.()
    }
  }
  const abort = () => fail(options.signal?.reason)
  const timer = setTimeout(
    () =>
      fail(
        new DOMException('Confirmation subscription timed out', 'TimeoutError'),
      ),
    timeoutMs,
  )
  const open = () => {
    try {
      socket.send(
        JSON.stringify({
          action: 'subscribe',
          topic: 'confirmation',
          ack: true,
          id: 'nanopay-confirmations',
          ...(accounts ? { options: { accounts, include_block: true } } : {}),
        }),
      )
    } catch (error) {
      fail(error)
    }
  }
  const message = (event: MessageEvent) => {
    try {
      if (typeof event.data !== 'string')
        throw new Error('Expected a text WebSocket message')
      const data = JSON.parse(event.data)
      if (data.ack === 'subscribe' && data.id === 'nanopay-confirmations') {
        clearTimeout(timer)
        return
      }
      if (data.topic !== 'confirmation') return
      const value = data.message
      if (
        !value ||
        !checkHash(value.hash) ||
        !checkAmount(value.amount) ||
        typeof value.confirmation_type !== 'string' ||
        !value.block ||
        typeof value.block !== 'object' ||
        Array.isArray(value.block)
      )
        throw new Error('Invalid confirmation notification')
      if (queue.length >= capacity)
        throw new Error(
          'Confirmation buffer overflow; reconcile missed blocks through RPC',
        )
      queue.push({
        hash: value.hash.toUpperCase(),
        account: normalizeAddress(value.account),
        amountRaw: value.amount,
        amount: rawToNano(value.amount),
        confirmationType: value.confirmation_type,
        block: value.block,
      })
      wake?.()
    } catch (error) {
      fail(error)
    }
  }
  const error = () => fail(new Error('Confirmation WebSocket failed'))
  const close = () =>
    fail(
      new Error(
        'Confirmation WebSocket closed; reconcile through RPC before reconnecting',
      ),
    )
  socket.addEventListener('open', open)
  socket.addEventListener('message', message)
  socket.addEventListener('error', error)
  socket.addEventListener('close', close)
  options.signal?.addEventListener('abort', abort, { once: true })
  try {
    if (options.signal?.aborted) abort()
    for (;;) {
      if (failed) throw failure
      if (queue.length) yield queue.shift()!
      else
        await new Promise<void>((resolve) => {
          wake = resolve
        })
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    socket.removeEventListener('open', open)
    socket.removeEventListener('message', message)
    socket.removeEventListener('error', error)
    socket.removeEventListener('close', close)
    socket.close()
  }
}
