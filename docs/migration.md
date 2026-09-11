# Versions and migration

## From 0.1.0 to 0.2.0

The main behavior change is the default RPC endpoint. Omitted URLs now select BerryPay's public Nano **mainnet** RPC. Existing explicit URLs continue to work.

```ts
import { createClient, createRpcClient, DEFAULT_RPC_URL } from 'nanopay'

// New in 0.2.0
const nano = createClient()
const rpc = createRpcClient()

// Equivalent explicit choice; also supported in 0.1.0
const explicit = createClient({ rpcUrl: 'https://xno-rpc.berrypay.org/proxy' })
```

`new NanoClient()` and `new NanoRpcClient()` also support omitted options/URLs. `DEFAULT_RPC_URL` is a public constant in the root and RPC entry points. Passing an empty or invalid URL still throws. There is no automatic fallback to BerryPay after an explicit endpoint fails.

If your application relies on an explicitly chosen node, keep its URL in configuration. WebSocket URLs remain explicit; use BerryPay's `wss://xno-rpc.berrypay.org/ws` with an account filter. [Provider configuration](guides/node-configuration.md).

Check `npm ls nanopay` before using the new defaults. The site may describe a prepared release before it is available from npm; publishing and deployment are separate steps.

## From nanocurrency-js

The `nanopay/legacy` entry point preserves upstream function names and call signatures. The root entry uses consistent private-key terminology and separates hash signing from block signing.

| Legacy call                                     | Canonical equivalent                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `deriveSecretKey(seed, index)`                  | `derivePrivateKey(seed, index)`                                                     |
| `deriveWallet(seed, index)`                     | `accountFromSeed(seed, index)` for one account; `walletFromSeed(seed)` for a wallet |
| Async `createWallet()` returning a flat account | Synchronous `createWallet()` returning `{ seed, account(index) }`                   |
| `derivePublicKey(privateKeyOrAddress)`          | `derivePublicKey(privateKey)` or `publicKeyFromAddress(address)`                    |
| `signBlock({ hash, secretKey })`                | `signHash(hash, privateKey)`                                                        |
| `verifyBlock({ hash, signature, publicKey })`   | `verifyHash({ hash, signature, publicKey })`                                        |
| `computeWork(root, { workThreshold })`          | `generateWork(root, { threshold })`                                                 |
| `validateWork({ blockHash, work, threshold })`  | `verifyWork({ root, work, threshold })`                                             |

The canonical `signBlock(unsignedBlock, privateKey)` hashes and signs a block. It is not the old hash-object overload. Likewise, canonical `verifyBlock` takes a signed state block.

## Earlier nanopay packages

This toolkit replaces the old nanopay payment-wrapper API. The recovered package's `0.0.1` release contains version metadata only, while `0.1.0` is the first full toolkit. Old payment-wrapper consumers need an intentional migration; package-name continuity is not API compatibility.

Review the [complete API reference](api.md), choose explicit amount units and run your integration tests before changing a production dependency.
