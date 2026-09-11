# RPC and pagination

`createRpcClient()` provides normalized reads, work generation and block publication. `createClient()` extends that same client with transaction workflows. Both use BerryPay by default starting in 0.2.0; [override the endpoint](node-configuration.md) as needed.

## Read confirmed balances

```ts
import { createRpcClient } from 'nanopay/rpc'

const rpc = createRpcClient()
const address = process.env.NANO_ACCOUNT
if (!address) throw new Error('Set NANO_ACCOUNT')
const funds = await rpc.getBalance(address)
console.log(funds.balance, funds.receivable)
```

`getBalance` requests confirmed data and normalizes legacy `pending` to the `receivable` fields. `getBalances(addresses)` batches confirmed balances into one request and requires node v25 or later. It rejects the batch if an account is missing or a node reports an entry error, rather than inventing a zero balance.

## Current and confirmed account state

`getAccountInfo(address)` returns the current frontier, balance, representative and block count, plus a separate `confirmed` snapshot from the same request. The current frontier can be unconfirmed. Use the appropriate field for the decision you are making.

An unopened account returns `null`. Do not interpret `null` as invalid address format or proof that no one has sent funds to the address; confirmed sends can still be waiting for its first receive.

## Page through receivables

This fragment assumes a configured `rpc` and public `address`:

```ts
const firstPage = await rpc.getReceivable(address, { count: 100, offset: 0 })
const secondPage = await rpc.getReceivable(address, { count: 100, offset: 100 })

for (const item of firstPage) {
  console.log(item.hash, item.amountRaw, item.source)
}
```

The default count is 100. Each entry contains the confirmed incoming send hash, exact amounts and source account. Offset pagination reads live data; receiving blocks between pages can shift entries. Coordinate receivers or restart/reconcile pagination rather than assuming a stable snapshot.

Use `isReceivable(hash)` for a hash-only existence query. A pruned node can report `Block not found` for a pruned source hash; account-scoped receivable records can still exist. The high-level receive workflow includes that fallback.

## History and blocks

`getHistory(address, { count, head, signal })` returns `entries` and optional pagination markers. Use the returned `previous` as the next page's `head` for older history. History can include unconfirmed entries, and providers may impose page limits.

`getBlock(hash)` returns balance, confirmation status and block contents. Amount fields are optional: if the previous block was pruned, the node may not be able to compute the transfer amount. Treat an absent amount as unavailable data, not zero. Older block formats are returned through the generic `block` record.

## Call an additional RPC action

```ts
import { createRpcClient } from 'nanopay/rpc'

const rpc = createRpcClient()
const counts = await rpc.request<{ count: string; cemented: string }>(
  'block_count',
)
console.log(counts.count, counts.cemented)
```

`request<T>(action, params, options)` sends raw Nano RPC and returns the node's JSON. The generic `T` helps TypeScript consumers; it does not validate the response schema. The specialized helpers validate and normalize their own fields.

Your provider must allow the action. A public proxy is not required to expose wallet, signing or node-administration commands. The [Nano RPC protocol](https://docs.nano.org/commands/rpc-protocol/) defines parameters and responses for node versions.

Raw calls bypass workflow serialization, block checks and response normalization. Prefer `publishBlock` for a signed block or `send`/`receive` for complete workflows. Do not use raw node-side signing operations to send private keys to a public endpoint.

## Errors and limits

`NanoRpcError` identifies the action and an optional HTTP status. Node errors and malformed helper responses reject explicitly. Cancellation and timeout propagate their reason. The client does not retry HTTP 429s, server failures or writes; implement bounded retry policy for safe reads in your application and reconcile writes first.
