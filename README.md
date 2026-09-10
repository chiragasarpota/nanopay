# nanopay

A Nano toolkit with local wallets, exact amount conversion, block signing, a typed RPC client, and WebAssembly proof of work. Built from [nanocurrency-js](https://github.com/marvinroger/nanocurrency-js) and maintained by chiragasarpota.

**Release status:** `0.1.0` is prepared for publication. npm currently blocks publishing after the earlier package unpublish. The initial `0.0.1` bootstrap contains only version metadata.

Requires Node.js 22+ or a modern browser with Web Crypto, WebAssembly and native fetch. Works with ESM, CommonJS, TypeScript, and Web Workers.

## Start here

Once published:

```sh
npm install nanopay
```

To use this checkout now:

```sh
npm ci
npm run build
```

```js
import { createWallet, nanoToRaw, rawToNano } from 'nanopay'
// In this checkout, import from './dist/index.js' instead.

const wallet = await createWallet()
console.log(wallet.address)

nanoToRaw('1.25') // '1250000000000000000000000000000'
rawToNano('1') // '0.000000000000000000000000000001'
```

CommonJS also works: `const { createWallet } = require('nanopay')`.

Keep `wallet.seed` and `wallet.privateKey` private. All key derivation and signing happen locally.

## Functions

| Function                                        | Purpose                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `createWallet()`                                | Generate a fresh seed and its first account.                                                       |
| `deriveWallet(seed, index = 0)`                 | Recover an account; returns seed, index, privateKey, publicKey, address.                           |
| `nanoToRaw(amount)`                             | Convert a Nano decimal string to an exact raw string. Rejects fractional raw and uint128 overflow. |
| `rawToNano(raw)`                                | Convert a raw string or bigint to a Nano decimal string.                                           |
| `checkAddress(address)`                         | Validate address format and checksum. Accepts `nano_` and `xrb_`.                                  |
| `createSendBlock(params)`                       | Subtract a Nano amount and sign a send block locally.                                              |
| `createReceiveBlock(params)`                    | Add incoming raw and sign a receive or open block locally.                                         |
| `createChangeBlock(params)`                     | Sign a representative change with the same balance.                                                |
| `createRpcClient(url, options?)`                | Connect to your chosen Nano node.                                                                  |
| `computeWork(root, options?)`                   | Generate PoW locally in WebAssembly.                                                               |
| `validateWork({ blockHash, work, threshold? })` | Check a PoW nonce.                                                                                 |

Pass amounts as strings. JavaScript numbers cannot represent all Nano balances exactly. One Nano is `10^30` raw; balances fit an unsigned 128-bit integer.

## Read from a Nano node

```js
import { createRpcClient } from 'nanopay'

const rpc = createRpcClient('http://127.0.0.1:7076', {
  timeoutMs: 15_000,
})

const balance = await rpc.getBalance(wallet.address)
console.log(balance.balance) // confirmed Nano, as a decimal string
console.log(balance.balanceRaw) // same amount in raw
console.log(balance.receivable) // confirmed incoming funds awaiting receipt

const incoming = await rpc.getReceivable(wallet.address, { count: 100 })
const history = await rpc.getHistory(wallet.address, { count: 20 })
```

| Method                                   | Result / behavior                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `getBalance(address)`                    | Confirmed balance and receivable funds, each in Nano and raw.                                                                |
| `getAccountInfo(address)`                | Atomic frontier, current balance and representative, with separate confirmed fields. Returns `null` for an unopened account. |
| `getReceivable(address, { count? })`     | Confirmed incoming blocks as `{ hash, amount, amountRaw, source }`. Default limit: 100.                                      |
| `getHistory(address, { count?, head? })` | `{ entries, previous?, next? }`. History may include unconfirmed entries.                                                    |
| `getBlock(hash)`                         | Block contents, amounts, and an explicit `confirmed` boolean.                                                                |
| `generateWork(root, { threshold? })`     | Request work from your node/work peers, then validate it locally.                                                            |
| `publishBlock(block, subtype)`           | Verify the signature and work, then submit once. Returns the block hash.                                                     |
| `request(action, params?)`               | Access any additional documented Nano RPC directly.                                                                          |

All methods accept `signal` in their options. Client options also accept `headers` and a custom `fetch`. There are no automatic retries, response caches, or global endpoint settings. Node failures throw `NanoRpcError` with `action` and, when available, HTTP `status`. Aborts and timeouts use `AbortError` and `TimeoutError`.

The client follows the [official Nano RPC protocol](https://docs.nano.org/commands/rpc-protocol/). It uses `receivable`, confirmed balance options, and structured JSON blocks with explicit transaction subtypes. A successful publish is **not confirmation**; check `getBlock(hash).confirmed` before treating a payment as settled.

## Build a send

`balanceRaw` means the **current** balance. `amount` means how much Nano to send. The helper computes the resulting balance.

```js
import { createSendBlock } from 'nanopay'

// wallet and rpc are from the examples above; recipient is a Nano address.
const account = await rpc.getAccountInfo(wallet.address)
if (!account) throw new Error('Account has no received funds')

const work = await rpc.generateWork(account.frontier)
const { block } = createSendBlock({
  privateKey: wallet.privateKey,
  previous: account.frontier,
  representative: account.representative,
  balanceRaw: account.balanceRaw,
  to: recipient,
  amount: '0.01',
  work,
})

const hash = await rpc.publishBlock(block, 'send')
```

Serialize transactions for each account and fetch a fresh account snapshot before constructing the next block; parallel writes against the same frontier can create a fork. Independent reads and different accounts can run concurrently.

For incoming funds, pass `sourceHash` and `amountRaw` from `getReceivable()` to `createReceiveBlock()`. Set `previous: null` and `balanceRaw: '0'` to open an account; supply the representative you choose. For an existing account, pass its current frontier, balance, and representative. Publish with subtype `open` or `receive`, respectively.

## Proof of work

```js
import { computeWork, RECEIVE_WORK_THRESHOLD } from 'nanopay'

const work = await computeWork(root, {
  workThreshold: RECEIVE_WORK_THRESHOLD,
  signal: AbortSignal.timeout(30_000),
  maxIterations: 10_000_000,
})
// work is a 16-character hex nonce, or null if the attempt limit is exhausted.
```

The root is the previous block hash. For an open block, use the account public key. The defaults match [Nano's work thresholds](https://docs.nano.org/integration-guides/work-generation/#difficulty-thresholds):

| Constant                                         | Threshold          | Use                       |
| ------------------------------------------------ | ------------------ | ------------------------- |
| `DEFAULT_WORK_THRESHOLD` / `SEND_WORK_THRESHOLD` | `fffffff800000000` | Send and change           |
| `RECEIVE_WORK_THRESHOLD`                         | `fffffe0000000000` | Receive and open          |
| `LEGACY_WORK_THRESHOLD`                          | `ffffffc000000000` | Historical epoch 1 blocks |

The WASM engine reuses buffers inside each batch and compiles once per JavaScript realm. Separate requests have separate memory. It yields every 16,384 attempts by default; `batchSize` trades yield overhead against responsiveness. `workerIndex` and `workerCount` divide the nonce space into disjoint ranges. Run those calls in separate Web Workers or Node worker threads to use multiple cores; the options do not spawn workers themselves.

For sustained mainnet generation, use `rpc.generateWork()` with a GPU-backed work server. Local CPU throughput does not imply a fixed completion time because finding work is probabilistic.

## Browser

Use normal ESM imports with your bundler. For a script tag, serve `dist/nanopay.js` and use the `NanoPay` global. The WASM bytes are embedded; no separate WASM download or Docker installation is required. Browser RPC endpoints must allow your origin through CORS.

## Lower-level toolkit

The upstream building blocks remain available: `generateSeed`, `deriveSecretKey`, `derivePublicKey`, `deriveAddress`, `hashBlock`, `signBlock`, `verifyBlock`, `createBlock`, `convert`, `Unit`, and the `check*` validators. Public functions include TypeScript declarations and parameter documentation.

Changes from `nanocurrency@2.5.0`:

- Addresses default to `nano_`. Use `deriveAddress(key, { useNanoPrefix: false })` for `xrb_`.
- Work defaults to the current send/change threshold; pass `LEGACY_WORK_THRESHOLD` when checking old vectors.
- `convert()` is exact and rejects fractional or overflowing hex balances. For compatibility, `Unit.nano` still means the legacy `10^24` raw unit; use `nanoToRaw()` for ordinary Nano amounts.
- The old nanopay payment-wrapper API is replaced. This package does not retain its global `init()` or automatic pending-receive loop.

## Development

```sh
npm ci
npm run check
npm run bench
```

`npm run check` runs type checking, Node tests, browser/worker tests, formatting, and a clean npm installation check. Install a test browser with `npx playwright install chromium` if Chrome is not installed.

`npm run build:wasm` rebuilds the checked-in binary using LLVM clang and wasm-ld. Set `NANOPAY_CLANG` and `NANOPAY_WASM_LD` to override compiler paths. Ordinary builds use the checked-in WASM binary. The C source, TypeScript source, and build scripts ship in the npm package.

See [benchmarks](docs/performance.md) and [release notes](CHANGELOG.md).

## License and origin

GPL-3.0-only. The upstream copyright notices are preserved. See [LICENSE](LICENSE) and [NOTICE](NOTICE). This is an independent fork; it does not imply endorsement by the upstream author or Nano Foundation.
