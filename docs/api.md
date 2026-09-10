# Complete API reference

All names below are exported from `nanopay` unless marked as a client method. TypeScript declarations ship with each entry point. Hex keys and hashes accept either case; canonical account and block builders return uppercase keys/hashes and `nano_` addresses. All amounts are exact strings.

## Accounts and keys

Available through `nanopay/keys` as well as the main entry point. These operations are synchronous and local.

| Function                                       | Returns / purpose                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `generateSeed()`                               | A cryptographically random, 32-byte Nano seed as 64 hex characters. |
| `generatePrivateKey()`                         | An independent random private key as 64 hex characters.             |
| `derivePrivateKey(seed, index = 0)`            | Native Nano BLAKE2b derivation; index range 0–4294967295.           |
| `derivePublicKey(privateKey)`                  | A Nano public key. Accepts a private key only.                      |
| `deriveAddress(publicKey, { useNanoPrefix? })` | Checksum address; defaults to `nano_`, false selects `xrb_`.        |
| `publicKeyFromAddress(address)`                | Decode an address and verify its checksum.                          |
| `addressFromPrivateKey(privateKey)`            | Derive the public key and its address.                              |
| `normalizeAddress(address)`                    | Validate and normalize a `nano_` or `xrb_` address to `nano_`.      |
| `createAccount()`                              | An independent random `Account`.                                    |
| `accountFromPrivateKey(privateKey)`            | Recover one `Account`.                                              |
| `accountFromSeed(seed, index = 0)`             | Derive one `Account` from a native Nano seed.                       |
| `createWallet()`                               | Random `SeedWallet` with `seed` and `account(index = 0)`.           |
| `walletFromSeed(seed)`                         | Recover a `SeedWallet`; derive accounts on demand.                  |

`Account` is `{ readonly privateKey, readonly publicKey, readonly address }`. Wallet and account objects are frozen. Private keys and seeds remain sensitive JavaScript strings; this library does not claim memory erasure or encrypted storage. A private key cannot be reversed into a seed.

## Mnemonics

Also available from `nanopay/mnemonic`. English BIP39 words and checksums use `@scure/bip39`; hardened child derivation uses HMAC-SHA512 from `@noble/hashes`.

| Function                                         | Returns / purpose                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `generateMnemonic({ words = 24 } = {})`          | Secure random 12, 15, 18, 21 or 24-word phrase. Synchronous.                              |
| `isValidMnemonic(value)`                         | Whether English words, count and checksum are valid.                                      |
| `entropyToMnemonic(entropyHex)`                  | Encode 16, 20, 24, 28 or 32 bytes of entropy into words.                                  |
| `mnemonicToEntropy(mnemonic)`                    | Decode the original entropy as hex.                                                       |
| `deriveMnemonicSeed(mnemonic, { passphrase? })`  | Async BIP39 PBKDF2 derivation; returns a **64-byte / 128-hex-character** seed.            |
| `deriveMnemonicPrivateKey(bip39Seed, index = 0)` | Synchronous Nano SLIP-0010 derivation at `m/44'/165'/index'`; index range 0–2147483647.   |
| `walletFromMnemonic(mnemonic, { passphrase? })`  | Async recovery of `MnemonicWallet`, with `mnemonic` and synchronous `account(index = 0)`. |

`walletFromMnemonic` computes PBKDF2 and the common derivation path once. It does not cache every account or run PBKDF2 for each index. Back up the passphrase separately when using one; a different passphrase creates different accounts without reporting an error.

Encoding a native Nano seed using `entropyToMnemonic(seed)` is an entropy backup. Restore it with `walletFromSeed(mnemonicToEntropy(words))`. Passing those words to `walletFromMnemonic` deliberately follows the different BIP39/SLIP-0010 scheme. See the [official derivation scheme and vectors](https://docs.nano.org/integration-guides/key-management/).

## Amounts and validation

| Function                       | Meaning                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `nanoToRaw(amount)`            | Nano decimal string → canonical raw uint128 string.                                   |
| `rawToNano(raw)`               | Raw string or bigint → exact Nano decimal string.                                     |
| `convert(value, { from, to })` | General exact conversion using `Unit`.                                                |
| `isValidSeed(value)`           | 64 hex characters.                                                                    |
| `isValidPrivateKey(value)`     | 64 hex characters; format validation.                                                 |
| `isValidPublicKey(value)`      | 64 hex characters; format validation, not a claim of ownership or a curve-point test. |
| `isValidAccountIndex(value)`   | Integer in the native Nano uint32 index range.                                        |
| `isValidAddress(value)`        | Accepted prefix, encoding and valid checksum.                                         |
| `isValidRawAmount(value)`      | Canonical decimal string in the uint128 range, including zero.                        |
| `isValidHash(value)`           | 64 hex characters.                                                                    |
| `isValidSignature(value)`      | 128 hex characters; format only.                                                      |
| `isValidWorkFormat(value)`     | 16 hex characters; format only.                                                       |
| `isValidWorkThreshold(value)`  | 16 hex characters.                                                                    |

Predicates accept `unknown` and return booleans/type guards. `verifyHash`, `verifyBlock` and `verifyWork` perform cryptographic verification; malformed values return false. Other functions throw for invalid input. Mnemonic indexes have the smaller hardened range described above.

`Unit` values include `raw`, `hex`, `nano`, `knano`, `Nano`, `NANO`, `KNano`, and `MNano`. Historical lowercase `Unit.nano` means `10^24` raw; `Unit.NANO` and `Unit.Nano` mean `10^30`; `Unit.KNano` means `10^33` and `Unit.MNano` means `10^36`. Prefer `nanoToRaw` and `rawToNano` in payment code. See `nanopay/amounts` for focused imports.

## Blocks and signatures

All functions are local. Available from `nanopay/blocks`. `UnsignedBlock` is a Nano state block without a signature; `SignedBlock` includes a signature. `work` may be null until you attach it. Wire field `balance` always means the **resulting** raw balance.

| Function                                     | Parameters / result                                                                                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildBlock(params)`                         | `{ account, previous, representative, balanceRaw, link, work? }` → unsigned state block. Here `balanceRaw` is the resulting balance. `previous: null` means open. Link is a destination address, source hash, or null for change. |
| `buildSendBlock(params)`                     | `{ account, previous, representative, balanceRaw, to, amount OR amountRaw, work? }` → unsigned send. Here `balanceRaw` is the current balance.                                                                                    |
| `buildReceiveBlock(params)`                  | `{ account, previous, representative, balanceRaw, sourceHash, amountRaw, work? }` → unsigned receive/open. Use null previous and zero current balance for open.                                                                   |
| `buildChangeBlock(params)`                   | `{ account, previous, representative, balanceRaw, work? }` → unsigned representative change, preserving balance.                                                                                                                  |
| `hashBlock(block)`                           | Compute the state block hash. Signature and work do not affect it. Accepts the protocol fields or `HashBlockParams`.                                                                                                              |
| `signHash(hash, privateKey)`                 | Nano Ed25519-BLAKE2b signature of a 32-byte hash.                                                                                                                                                                                 |
| `verifyHash({ hash, signature, publicKey })` | Verify a hash signature.                                                                                                                                                                                                          |
| `signBlock(unsignedBlock, privateKey)`       | A signed block; rejects a key that does not match the block's account.                                                                                                                                                            |
| `attachSignature(unsignedBlock, signature)`  | Verify an external signature and return a signed block with only protocol fields.                                                                                                                                                 |
| `verifyBlock(signedBlock)`                   | Verify state fields and the signature. Does not establish ledger validity, confirmation, or PoW.                                                                                                                                  |
| `createSendBlock(params)`                    | Same send inputs, replacing `account` with `privateKey`; returns `{ hash, block }`, built and signed.                                                                                                                             |
| `createReceiveBlock(params)`                 | Same receive inputs, replacing `account` with `privateKey`; returns `{ hash, block }`.                                                                                                                                            |
| `createChangeBlock(params)`                  | Same change inputs, replacing `account` with `privateKey`; returns `{ hash, block }`.                                                                                                                                             |
| `getWorkRoot(block)`                         | Previous hash, or the account public key for an open block.                                                                                                                                                                       |

`ZERO_HASH` is 64 zeroes. Use `null` in generic builder inputs for an absent previous/link. Send and explicit representative changes require an opened account. Amount inputs reject zero sends, insufficient balance, and uint128 overflow. Offline builders cannot verify that a frontier/source is current or confirmed; use trusted ledger data or the client preparation methods.

## Proof of work

Available through `nanopay/work`.

| Function / constant                       | Purpose                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `generateWork(root, options = {})`        | Async local WASM search. Returns a 16-hex-character nonce, or null after exhausting the range.                |
| `verifyWork({ root, work, threshold? })`  | Verify a nonce at the requested difficulty.                                                                   |
| `attachWork(block, work, { threshold? })` | Return a copy with locally verified work. Signature remains valid because work is not part of the block hash. |
| `SEND_WORK_THRESHOLD`                     | `fffffff800000000` for current mainnet send/change.                                                           |
| `DEFAULT_WORK_THRESHOLD`                  | Same as send threshold.                                                                                       |
| `RECEIVE_WORK_THRESHOLD`                  | `fffffe0000000000` for current mainnet receive/open.                                                          |
| `LEGACY_WORK_THRESHOLD`                   | `ffffffc000000000` for historical epoch 1 work.                                                               |

`WorkOptions`: `threshold`, `signal`, `maxIterations`, `batchSize` (default 16384, maximum 1048576), `workerIndex` (default 0), and `workerCount` (default 1). The worker options partition the nonce range without starting threads. Cancellation throws the signal's reason. Supply the receive threshold when generating or attaching receive/open work. The client chooses it automatically. [Official difficulty rules](https://docs.nano.org/integration-guides/work-generation/#difficulty-thresholds).

## RPC and transaction clients

`createRpcClient(url, options?)` returns `NanoRpcClient`. `createClient({ rpcUrl, ...options })` returns `NanoClient`, which extends it with transaction workflows. Both classes can also be constructed directly. Focused import: `nanopay/rpc`.

Common options: `timeoutMs` (default 15000), `headers`, and custom `fetch`. NanoClient also takes `representative` (opening-account default) and `work` (custom provider). No third-party endpoint is selected implicitly.

All async methods accept `signal` in their options. Each request has its own timeout and cancellation state. Response validation errors, HTTP failures, and node errors use `NanoRpcError`, with `action`, optional HTTP `status`, and optional `cause`. Aborts/timeouts retain the signal's reason.

| Method on both clients                                 | Result                                                                                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getBalance(address, options?)`                        | Confirmed `{ balance, balanceRaw, receivable, receivableRaw }`.                                                                                                                               |
| `getBalances(addresses, options?)`                     | Same confirmed data keyed by address, using one `accounts_balances` request. Requires node v25+. Any missing/failed entry rejects the batch.                                                  |
| `getAccountInfo(address, options?)`                    | Atomic current `{ frontier, balance, balanceRaw, representative, blockCount, confirmed }`; null for unopened accounts. `confirmed` contains its own frontier, balance, balanceRaw and height. |
| `getReceivable(address, { count = 100, signal? })`     | Confirmed incoming `{ hash, amount, amountRaw, source }[]`.                                                                                                                                   |
| `isReceivable(hash, options?)`                         | Whether a confirmed send is still awaiting receipt.                                                                                                                                           |
| `getHistory(address, { count = 100, head?, signal? })` | `{ entries, previous?, next? }`; history can include unconfirmed entries.                                                                                                                     |
| `getBlock(hash, options?)`                             | `{ account, amount, amountRaw, balance, balanceRaw, confirmed, subtype?, block }`. Supports historical block contents.                                                                        |
| `generateWork(root, { threshold?, signal? })`          | Request node/work-peer generation and validate the nonce locally. Distinct from the standalone local `generateWork`.                                                                          |
| `publishBlock(signedBlock, subtype, options?)`         | Validate signature and work, submit once, and return the locally checked hash. Subtypes: send, receive, open, change.                                                                         |
| `request<T>(action, params = {}, options?)`            | Any enabled Nano RPC, including node administration and less common reads. Returns raw node JSON; `T` is a compile-time hint, not a response schema.                                          |

The defaults follow the [Nano RPC protocol](https://docs.nano.org/commands/rpc-protocol/). Your node controls RPC availability and permissions. Direct raw requests give full control and do not apply the specialized helpers' transaction checks or response normalization.

| Additional NanoClient method           | Parameters / result                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepareSend(options)`                 | `{ account: address, to, amount OR amountRaw, signal? }` → `PreparedTransaction`.                                                                                                                        |
| `prepareReceive(options)`              | `{ account: address, hash, representative?, signal? }` → `PreparedTransaction`, validating the confirmed incoming source and destination.                                                                |
| `prepareChangeRepresentative(options)` | `{ account: address, representative, signal? }` → `PreparedTransaction`.                                                                                                                                 |
| `send(options)`                        | `{ account: Account OR Signer, to, amount OR amountRaw, signal? }` → `TransactionResult`.                                                                                                                |
| `receive(options)`                     | `{ account: Account OR Signer, hash, representative?, signal? }` → `TransactionResult`. Opens the account if needed.                                                                                     |
| `receiveAll(options)`                  | `{ account: Account OR Signer, representative?, maxBlocks = 100, signal? }` → `ReceiveAllResult`. Maximum accepted limit: 10000.                                                                         |
| `changeRepresentative(options)`        | `{ account: Account OR Signer, representative, signal? }` → `TransactionResult`.                                                                                                                         |
| `waitForConfirmation(hash, options?)`  | Poll until `getBlock` reports confirmed; returns `BlockInfo`. Options: `timeoutMs = 60000`, `pollIntervalMs = 1000`, `signal`. Only a missing block is treated as transient; other RPC errors propagate. |

`PreparedTransaction` is `{ hash, block: UnsignedBlock, subtype }`. It is frozen but can become stale as the ledger changes. Preparing does not reserve a frontier or lock other writers.

`TransactionResult` is `{ hash, block: SignedBlock, subtype, status: 'submitted' }`. `ReceiveAllResult` is `{ transactions, amount, amountRaw, hasMore }`. Its totals count submitted receive blocks; they are not a separate confirmation guarantee. `hasMore` describes the fetched snapshot, so new incoming funds can arrive after a false result.

`TransactionError.transaction` holds the exact submitted candidate; the node may have accepted it before a network failure. Inspect that hash before retrying. `ReceiveAllError.completed` contains prior submissions; inspect `cause` for the stopped operation. Invalid inputs or failures before publication throw normally. A batch that fails during receiving wraps the cause even if no earlier block completed.

High-level writes serialize by account within one client instance. Different accounts are independent. Multiple client instances, devices and raw/prepared writes need application-level coordination. There are no automatic transaction retries or persistent queues.

## Custom signing and work

`createSigner(privateKey)` returns the same `Signer` interface used by an external wallet: `{ publicKey, sign(hash) }`. External signing must implement Nano Ed25519-BLAKE2b; generic Ed25519 signatures will fail verification. The callback may be synchronous or return a Promise.

```js
import { createClient } from 'nanopay/rpc'
import { generateWork } from 'nanopay/work'

const client = createClient({
  rpcUrl,
  work: async ({ root, threshold, signal }) => {
    const work = await generateWork(root, { threshold, signal })
    if (work === null) throw new Error('Work range exhausted')
    return work
  },
})
const signer = {
  publicKey: devicePublicKey,
  sign: (hash) => yourNanoDeviceTransport.signHash(hash),
}
await client.send({ account: signer, to: recipientAddress, amount: '0.01' })
```

The library verifies the returned signature before requesting work and verifies work before publishing. A supplied work provider should honor its `signal`. Device discovery, transport, and device-specific transaction displays belong to your adapter. For adapters that require the full block, use `prepareSend` → your adapter → `attachSignature` → work → `publishBlock`.

## Payment links and confirmations

| Function                                                                 | Parameters / result                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPaymentUri({ address, amount? OR amountRaw?, label?, message? })` | Encode a payment URI. Input amount is Nano; wire amount is raw.                                                                                                                                 |
| `parsePaymentUri(uri)`                                                   | Parse `nano:` or `nano://` payment links into `{ address, amount?, amountRaw?, label?, message? }`. Reject unsupported actions/parameters, duplicate parameters, fragments and invalid amounts. |
| `watchConfirmations(url, options?)`                                      | Async generator of `{ hash, account, amount, amountRaw, confirmationType, block }` from the node's confirmation topic.                                                                          |

Focused imports: `nanopay/payments` and `nanopay/confirmations`. A URI is text suitable for a QR encoder; no image-rendering dependency is included. Seed/key import links and representative-change URI actions are not handled by the payment parser.

`WatchConfirmationsOptions`: optional `accounts` filter, `signal`, `bufferSize` (default 1000), `timeoutMs` for subscription (default 15000), and a browser-compatible `webSocket(url)` factory. Omit `accounts` for all notifications; an empty array is rejected. Break the loop or abort to close the socket. Slow consumers encounter an explicit buffer-overflow error rather than silent loss. There is no reconnect, heartbeat, deduplication, or durable checkpoint inside the stream. Use RPC reconciliation and application storage for payment accounting; a stalled network connection requires application cancellation/reconnection. See [Nano's WebSocket delivery semantics](https://docs.nano.org/integration-guides/websockets/).

## Legacy entry point

`nanopay/legacy` preserves the previous toolkit API, including `deriveSecretKey(seed, index)`, `deriveWallet(seed, index)`, async flat-account `createWallet()`, overloaded `derivePublicKey(privateKeyOrAddress)`, `check*`, `computeWork(root, { workThreshold })`, `validateWork({ blockHash, work })`, `createBlock(privateKey, data)`, `signBlock({ hash, secretKey })`, and `verifyBlock({ hash, signature, publicKey })`. Its signed transaction helpers use Nano `amount` for send. Existing upstream tests run against this entry point. The canonical API above is the recommended interface for new code.
