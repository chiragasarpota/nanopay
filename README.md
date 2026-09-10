# nanopay

Nano for JavaScript and TypeScript: create or recover accounts, send and receive funds, build blocks, sign locally, generate work, and query a node.

Use the client for complete workflows. Use the exported functions when you want control over each step. Both use the same Nano cryptography and block builders.

**Publication pending:** this checkout contains the unreleased `0.1.0` toolkit. npm's name-reuse cooldown currently prevents publication. The separately prepared `0.0.1` bootstrap contains version metadata only.

[Complete API reference](docs/api.md) · [Runtime support](docs/runtimes.md) · [Performance](docs/performance.md) · [Release status](docs/releasing.md)

## Install

After publication:

```sh
npm install nanopay
```

To run this checkout now, use `npm ci && npm run build` and import from `./dist/index.js`. Node.js 22+, ESM, CommonJS, TypeScript and modern browsers are supported. A browser script bundle exposes `NanoPay`.

## Create or recover accounts

```js
import {
  createWallet,
  walletFromSeed,
  accountFromPrivateKey,
  walletFromMnemonic,
} from 'nanopay'

const wallet = createWallet()
const first = wallet.account() // index 0
const second = wallet.account(1)

// Each account has { privateKey, publicKey, address }.
console.log(first.address)

const recovered = walletFromSeed(savedSeed).account(1)
const imported = accountFromPrivateKey(savedPrivateKey)
const mnemonicWallet = await walletFromMnemonic(savedWords, {
  passphrase: savedPassphrase,
})
const mnemonicAccount = mnemonicWallet.account()
```

Back up `wallet.seed`, or your mnemonic **and its passphrase**, according to how the wallet was created. A private key controls one account; it cannot recover the wallet's seed or other accounts. Keep seeds and private keys out of logs and RPC requests.

Native Nano hex seeds and BIP39 mnemonic seeds follow different derivation schemes. `walletFromSeed` uses Nano's BLAKE2b derivation. `walletFromMnemonic` follows BIP39 and the Nano SLIP-0010 path `m/44'/165'/index'`. It matches the [official Nano key-management vectors](https://docs.nano.org/integration-guides/key-management/).

## Send, receive, and confirm

```js
import { createClient, walletFromSeed } from 'nanopay'

const client = createClient({ rpcUrl: 'http://127.0.0.1:7076' })
const account = walletFromSeed(savedSeed).account()

const balance = await client.getBalance(account.address)
console.log(balance.balance) // confirmed Nano, exact decimal string

const sent = await client.send({
  account,
  to: recipientAddress,
  amount: '0.125', // Nano; alternatively use amountRaw: '1'
})
await client.waitForConfirmation(sent.hash)

const received = await client.receiveAll({
  account,
  representative: chosenRepresentative,
  maxBlocks: 100,
})
for (const transaction of received.transactions) {
  await client.waitForConfirmation(transaction.hash)
}

await client.changeRepresentative({
  account,
  representative: chosenRepresentative,
})
```

The client reads account state, builds a block, signs locally, requests work, verifies it, and submits once. Choose a representative for the first receive; existing accounts keep theirs unless you supply another. `receive({ account, hash })` receives one confirmed incoming send. `receiveAll` processes a bounded snapshot and reports `hasMore` when that snapshot contains additional blocks.

Writes to the same account queue inside a client instance. Different accounts and independent reads run concurrently. Coordinate writers yourself when using multiple clients, processes, devices, or the granular prepare/publish methods.

`status: 'submitted'` means the node accepted the block. Use `waitForConfirmation` before treating it as settled. If submission fails, `TransactionError.transaction` retains the exact hash and signed block; inspect that hash before trying again. `ReceiveAllError.completed` preserves earlier successful submissions, and its `cause` identifies the failed step. Writes are never retried automatically.

A submission failure blocks further writes to that account with `AccountBlockedError`, including already queued writes. After reconciling the failed transaction with the node, call `client.resumeAccount(address, transactionHash)` to allow new writes; rejected writes are never replayed. A missing hash alone does not prove the node stopped processing it.

## Full control, one step at a time

```js
import {
  generateSeed,
  derivePrivateKey,
  derivePublicKey,
  deriveAddress,
  buildSendBlock,
  hashBlock,
  signHash,
  attachSignature,
  getWorkRoot,
  attachWork,
  createRpcClient,
} from 'nanopay'

const seed = generateSeed()
const privateKey = derivePrivateKey(seed, 0)
const publicKey = derivePublicKey(privateKey)
const address = deriveAddress(publicKey)

// Use a funded account's state here; a fresh account cannot send yet.
const rpc = createRpcClient('http://127.0.0.1:7076')
const state = await rpc.getAccountInfo(address)
if (!state) throw new Error('Receive funds into this account first')

const unsigned = buildSendBlock({
  account: address,
  previous: state.frontier,
  representative: state.representative,
  balanceRaw: state.balanceRaw,
  to: recipientAddress,
  amountRaw: '1',
})
const hash = hashBlock(unsigned)
const signature = signHash(hash, privateKey)
const signed = attachSignature(unsigned, signature)
const work = await rpc.generateWork(getWorkRoot(signed))
const block = attachWork(signed, work)
await rpc.publishBlock(block, 'send')
```

`build*` functions need no private keys. `signBlock(unsigned, privateKey)` combines hashing and signing. `createSendBlock`, `createReceiveBlock` and `createChangeBlock` combine building and signing, returning `{ hash, block }`. None of those functions contacts a node. `client.prepareSend`, `prepareReceive` and `prepareChangeRepresentative` add ledger reads and return unsigned transactions for your own signing flow.

External signers implement `{ publicKey, sign(hash) }`; pass that object as `account`. Signatures must use **Nano's Ed25519-BLAKE2b**, not standard Ed25519-SHA512. Work providers implement `work({ root, threshold, signal })`. You can use local WASM, a GPU service, or a separate work node. See [signer and work examples](docs/api.md#custom-signing-and-work).

## Exact amounts

```js
import { nanoToRaw, rawToNano } from 'nanopay/amounts'

nanoToRaw('1.25') // '1250000000000000000000000000000'
rawToNano('1') // '0.000000000000000000000000000001'
```

Amounts use strings, never floating-point numbers. `amount` means Nano; `amountRaw` and `balanceRaw` mean raw. One Nano is `10^30` raw. Fractional raw and uint128 overflow are rejected. General `convert` and `Unit` remain available; the historical `Unit.nano` means `10^24` raw, so use `nanoToRaw` for ordinary Nano amounts.

## Payment links and live confirmations

```js
import { createPaymentUri, parsePaymentUri, watchConfirmations } from 'nanopay'

const uri = createPaymentUri({
  address: account.address,
  amount: '1.25',
  label: 'Coffee',
})
const request = parsePaymentUri(uri)

for await (const event of watchConfirmations('ws://127.0.0.1:7078', {
  accounts: [account.address],
  signal: controller.signal,
})) {
  console.log(event.hash, event.amount)
}
```

Payment URIs encode raw as required by Nano. WebSocket notifications can repeat; deduplicate by hash. A disconnect, malformed message, or full buffer raises an error. Reconcile history and receivables through RPC after reconnecting. This stream has no automatic reconnect or persistent payment accounting.

## Small imports and local work

Focused entry points avoid loading unrelated modules:

```js
import { derivePrivateKey, deriveAddress } from 'nanopay/keys'
import { buildReceiveBlock, signBlock } from 'nanopay/blocks'
import { generateWork, RECEIVE_WORK_THRESHOLD } from 'nanopay/work'

const work = await generateWork(root, {
  threshold: RECEIVE_WORK_THRESHOLD,
  signal: AbortSignal.timeout(30_000),
  maxIterations: 10_000_000,
})
// A 16-character hex nonce, or null when the attempt range is exhausted.
```

Also available: `nanopay/amounts`, `/mnemonic`, `/rpc`, `/payments`, and `/confirmations`. Each supports ESM, CommonJS, and TypeScript. The keys entry point contains neither WASM nor the mnemonic word list.

The WASM engine compiles once per realm, isolates concurrent calls, and yields between batches. `workerIndex` and `workerCount` partition the nonce space; run those calls in separate Workers to use multiple cores. They do not create Workers. Mainnet work is probabilistic; use a GPU work service for sustained workloads. See [measured performance and tradeoffs](docs/performance.md).

## Scope and compatibility

The toolkit covers local accounts, native and mnemonic derivation, state blocks, signing, work, ledger reads, send/receive/change workflows, confirmation tracking and payment links. `client.request(action, params)` and `rpc.request(...)` expose every additional [Nano RPC command](https://docs.nano.org/commands/rpc-protocol/) supported and enabled by your node.

It does not run a consensus node, choose a representative, persist or encrypt secrets, manage exchange accounting, or provide a hardware-device transport. External signer hooks allow you to supply your own transport. New blocks use state format; RPC block reads also support historical block contents.

The original upstream function names and call signatures are preserved under `nanopay/legacy`, including `deriveSecretKey` and the hash-based `signBlock({ hash, secretKey })`. Main imports use `privateKey` consistently and distinguish signing a hash from signing a block. The old nanopay payment-wrapper API is replaced.

## Development and license

```sh
npm ci
npm run check
npm run bench
```

Checks cover protocol vectors, workflows, browser/Worker execution, formatting, and installation into a clean npm project. Install a browser with `npx playwright install chromium` if Chrome is unavailable. `npm run build:wasm` rebuilds the checked-in binary with LLVM clang and wasm-ld; ordinary builds use the existing binary.

GPL-3.0-only. Based on [nanocurrency-js](https://github.com/marvinroger/nanocurrency-js) by Marvin ROGER. Source, build scripts, original notices, and bundled dependency licenses ship with the package. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [CHANGELOG](CHANGELOG.md).
