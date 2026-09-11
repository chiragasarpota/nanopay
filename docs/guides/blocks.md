# Blocks and signing

The granular API separates block construction, hashing, signing, proof of work and publication. This is useful for external signing systems, custom work pipelines and applications that already coordinate ledger state.

## Prepare from the current ledger

```ts
import {
  createClient,
  walletFromSeed,
  signBlock,
  getWorkRoot,
  attachWork,
} from 'nanopay'

const seed = process.env.NANO_SEED
const to = process.env.NANO_RECIPIENT
if (!seed || !to) throw new Error('Set NANO_SEED and NANO_RECIPIENT')

const nano = createClient()
const account = walletFromSeed(seed).account()
const prepared = await nano.prepareSend({
  account: account.address,
  to,
  amount: '0.01',
})
const signed = signBlock(prepared.block, account.privateKey)
const work = await nano.generateWork(getWorkRoot(signed))
const block = attachWork(signed, work)
const hash = await nano.publishBlock(block, prepared.subtype)
await nano.waitForConfirmation(hash)
```

`prepareSend` reads the account frontier, balance and representative and returns `{ hash, block, subtype }` without signing or submitting. It does not reserve that frontier. Coordinate other writers while a prepared transaction is awaiting a signature.

Unlike `send`, this sequence does not participate in the high-level account queue or automatically block later writes after a publication failure. Persist the signed candidate and reconcile its exact hash yourself if publication is uncertain.

## Build entirely offline

The following fragment assumes you already have an account snapshot from a trusted node and a loaded account. `buildSendBlock` itself performs no network calls.

```ts
import {
  buildSendBlock,
  hashBlock,
  signHash,
  attachSignature,
} from 'nanopay/blocks'

const unsigned = buildSendBlock({
  account: account.address,
  previous: state.frontier,
  representative: state.representative,
  balanceRaw: state.balanceRaw,
  to: recipientAddress,
  amountRaw: '1',
})
const hash = hashBlock(unsigned)
const signature = signHash(hash, account.privateKey)
const signed = attachSignature(unsigned, signature)
```

The builder subtracts the send amount from the supplied current balance. It validates format and bounds but cannot know whether your snapshot is current. A stale frontier can produce a validly signed block that the network rejects.

## Choose a builder

| Function            | Input balance     | Result                                                   |
| ------------------- | ----------------- | -------------------------------------------------------- |
| `buildSendBlock`    | Current balance   | Decreases it by the send amount                          |
| `buildReceiveBlock` | Current balance   | Adds the incoming amount; null previous opens an account |
| `buildChangeBlock`  | Current balance   | Preserves it and changes the representative              |
| `buildBlock`        | Resulting balance | Builds generic state fields exactly as specified         |

`createSendBlock`, `createReceiveBlock` and `createChangeBlock` combine building and local signing and return `{ hash, block }`. They do not generate work, contact a node or confirm the transaction.

## Hash and signature rules

`hashBlock` hashes the protocol fields. Signature and work do not affect the hash. `signHash(hash, privateKey)` signs a hash; `signBlock(unsignedBlock, privateKey)` also hashes the block and verifies that the key matches the block account.

Nano uses **Ed25519-BLAKE2b**. Standard Ed25519-SHA512 signatures from unrelated crypto libraries are incompatible. `attachSignature` validates an external signature before returning a signed block.

`verifyBlock` checks fields and signature. It does not establish ledger validity, confirmation or adequate work. `verifyWork` checks work separately, and `publishBlock` checks both before a single `process` submission.

## Work and subtype

`getWorkRoot` returns the previous hash, or the account public key for an open block. Send/change use `SEND_WORK_THRESHOLD`; receive/open use `RECEIVE_WORK_THRESHOLD` under current mainnet defaults. Pass the receive threshold when manually generating and attaching receive work. The high-level client handles that selection automatically.

Pass the matching `send`, `receive`, `open` or `change` subtype to `publishBlock`. It submits the object-form state block through `process` with `json_block` and verifies the returned hash against the local candidate.
