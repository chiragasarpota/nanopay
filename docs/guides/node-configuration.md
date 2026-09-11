# Choose your node

## BerryPay by default

Starting in **nanopay 0.2.0**, the following all select BerryPay's public Nano mainnet RPC:

```ts
import {
  createClient,
  createRpcClient,
  NanoClient,
  NanoRpcClient,
} from 'nanopay'

const nano = createClient()
const rpc = createRpcClient()
const clientInstance = new NanoClient()
const rpcInstance = new NanoRpcClient()
```

The exported `DEFAULT_RPC_URL` is `https://xno-rpc.berrypay.org/proxy`. No API key is required for the current public endpoint. This is **mainnet**: transaction methods operate on real Nano when you provide a funded account.

In **0.1.0**, URLs are required. For that version, use `createClient({ rpcUrl: 'https://xno-rpc.berrypay.org/proxy' })` or `createRpcClient('https://xno-rpc.berrypay.org/proxy')`.

Constructing a client makes no network request. The selected provider receives RPC queries and signed blocks when your code invokes network methods. Local wallet generation, derivation and signing stay local. Use a provider you trust for ledger reads and operational availability.

## Use your own endpoint

```ts
import { createClient, createRpcClient } from 'nanopay'

const nano = createClient({ rpcUrl: 'http://127.0.0.1:7076' })
const rpc = createRpcClient('https://your-node.example/rpc')
```

Explicit URLs must use HTTP or HTTPS. An empty or invalid URL throws; it does not silently select BerryPay. A failed request to your node is not retried against BerryPay. There is no automatic provider failover or global mutable endpoint setting.

Network selection comes from the endpoint you supply. Use the RPC and work settings appropriate to your dev network for integration tests; the default endpoint is not a test network.

## Headers, timeouts and fetch

```ts
import { createClient, createRpcClient } from 'nanopay'

const nano = createClient({ timeoutMs: 30_000 }) // BerryPay, custom timeout
const rpc = createRpcClient(undefined, { timeoutMs: 30_000 })

const privateNode = createClient({
  rpcUrl: 'https://your-node.example/rpc',
  headers: { Authorization: `Bearer ${process.env.RPC_TOKEN}` },
  timeoutMs: 15_000,
  fetch: globalThis.fetch,
})
```

The default timeout is 15,000 ms **per RPC request**, not per complete transaction. `signal` controls an individual operation. A send can contain multiple requests for account state, work and publication.

Only attach provider credentials to the intended provider URL. Browser applications must not embed a private service token into their public bundle. Your endpoint must allow the browser origin through CORS.

## WebSocket endpoint

`watchConfirmations` takes its own explicit URL. An RPC URL is not automatically converted into a WebSocket URL.

```ts
import { watchConfirmations } from 'nanopay'

const address = process.env.NANO_ACCOUNT
if (!address) throw new Error('Set NANO_ACCOUNT')

for await (const event of watchConfirmations('wss://xno-rpc.berrypay.org/ws', {
  accounts: [address],
  signal: AbortSignal.timeout(60_000),
})) {
  console.log(event.hash, event.amount)
}
```

BerryPay requires an `accounts` filter. Unfiltered subscriptions and `all_local_accounts` are disabled by provider policy. `watchConfirmations` can use an unfiltered subscription with a different provider that permits it. See [confirmation handling](confirmations.md) for reconnection and deduplication.

## Provider capabilities

BerryPay exposes the public reads and transaction operations needed by nanopay: account and block queries, receivables, confirmation reads, work generation and signed block publication. Its proxy also permits public diagnostic reads such as version and block counters.

Wallet/seed/private-key operations, node-side signing and sensitive administrative/control actions remain blocked. The library's local key and signing functions do not require those RPC actions. `request(action, params)` can call only the operations the selected provider enables.

The proxy may impose rate limits, request bounds and availability limits. An HTTP 429 is returned as a `NanoRpcError` with `status: 429`; the library does not retry automatically. Avoid describing the service as allowing every Nano RPC action. Use your own node when you need capabilities or operational guarantees outside its public policy.

Provider policy and service limits can change independently of the npm package. The [official Nano RPC protocol](https://docs.nano.org/commands/rpc-protocol/) defines node operations; it does not require a public proxy to expose every operation.
