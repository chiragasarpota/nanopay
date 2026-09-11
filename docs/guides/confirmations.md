# Confirmations and WebSockets

Use polling when you know a transaction hash. Use WebSockets for a stream of account activity. Your application is responsible for durable payment records and reconciling missed notifications.

## Confirm a known hash

```ts
import { createClient } from 'nanopay'

const nano = createClient()
const hash = process.env.NANO_BLOCK_HASH
if (!hash) throw new Error('Set NANO_BLOCK_HASH')

const confirmed = await nano.waitForConfirmation(hash, {
  timeoutMs: 60_000,
  pollIntervalMs: 1_000,
})
console.log(confirmed.confirmed) // true
```

The defaults are a 60-second overall wait and a one-second polling interval. A missing block is treated as transient while waiting. Other RPC failures are propagated. A timeout ends the wait; it does not cancel or reverse the block.

The result is `BlockInfo`. `amount` and `amountRaw` may be absent when a predecessor has been pruned, even for a confirmed block. Confirmation is not inferred from the amount field.

## Subscribe to account activity

```ts
import { watchConfirmations } from 'nanopay/confirmations'

const account = process.env.NANO_ACCOUNT
if (!account) throw new Error('Set NANO_ACCOUNT')
const controller = new AbortController()

try {
  for await (const event of watchConfirmations(
    'wss://xno-rpc.berrypay.org/ws',
    {
      accounts: [account],
      signal: controller.signal,
      bufferSize: 1_000,
      timeoutMs: 15_000,
    },
  )) {
    console.log(event.hash, event.account, event.amountRaw)
  }
} catch (error) {
  if (!controller.signal.aborted) throw error
}
```

Call `controller.abort()` when the owning component or service shuts down. Breaking out of the `for await` loop also closes the socket. The timeout covers connection/subscription acknowledgement, not all future idle time.

BerryPay requires a non-empty account filter. Its unfiltered and `all_local_accounts` subscriptions are disabled. Other providers can allow unfiltered subscriptions by omitting `accounts`; an empty array is always rejected.

## Event fields

| Field                  | Meaning                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `hash`                 | Uppercase block hash; use it for deduplication                                        |
| `account`              | Account that owns the confirmed block, which may be the sender of an incoming payment |
| `amount` / `amountRaw` | Event amount as exact Nano/raw strings                                                |
| `confirmationType`     | The node's confirmation classification                                                |
| `block`                | Included node block representation                                                    |

An account filter can include events relevant to the account through a send destination. Do not assume `event.account` is always the account you are monitoring. Verify the block destination and your invoice/account mapping before crediting a payment. Confirmation events also include receives and representative changes; they are not all new incoming payments.

## Reconnect and reconcile

The stream raises errors on disconnect, malformed notifications and buffer overflow. It has no automatic reconnect, heartbeat, deduplication or durable checkpoint. A connection that becomes silent without closing needs an application-level liveness strategy.

A payment service should persist processed hashes, reconnect with bounded backoff and reconcile account history/receivables after a gap. Treat notifications as a prompt to inspect account state, not the sole accounting record. Startup reconciliation is needed even when no disconnect was observed.

Slow consumers can exhaust `bufferSize`; the stream fails rather than silently discard events. Perform durable enqueueing promptly and move lengthy work outside the iterator where appropriate. See the [official Nano WebSocket guide](https://docs.nano.org/integration-guides/websockets/) for node delivery semantics.

## Other runtimes

Supply `webSocket: url => new YourWebSocket(url)` when your environment lacks a compatible global implementation. The object must support browser-style `addEventListener`, `removeEventListener`, `send` and `close`. RPC provider configuration and WebSocket provider configuration are independent.
