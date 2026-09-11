# Accounts and keys

Use the wallet helpers for deterministic accounts or the individual derivation functions when you need to manage each step. All operations on this page are synchronous and local.

## Native seed wallet

```ts
import { createWallet, walletFromSeed } from 'nanopay'

const wallet = createWallet()
const first = wallet.account() // Index 0
const next = wallet.account(1)
const recovered = walletFromSeed(wallet.seed).account(1)

console.log(next.address === recovered.address) // true
```

A native Nano seed is 32 bytes represented by 64 hexadecimal characters. `walletFromSeed` uses Nano's BLAKE2b derivation with account indexes from `0` through `4294967295`. It is different from [mnemonic derivation](mnemonics.md).

`SeedWallet` exposes `seed` and `account(index = 0)`. It derives accounts on demand. Reusing the same seed and index produces the same account; you must retain the indexes your application uses or provide an account-discovery strategy.

## Derive each component

```ts
import {
  generateSeed,
  derivePrivateKey,
  derivePublicKey,
  deriveAddress,
} from 'nanopay/keys'

const seed = generateSeed()
const privateKey = derivePrivateKey(seed, 0)
const publicKey = derivePublicKey(privateKey)
const address = deriveAddress(publicKey)
console.log(address)
```

The seed controls the account family. Each derived private key controls one account. The public key and address may be shared. Deriving an account does not open it on the ledger.

## Import a private key

```ts
import { accountFromPrivateKey, generatePrivateKey } from 'nanopay/keys'

const privateKey = generatePrivateKey()
const account = accountFromPrivateKey(privateKey)
console.log(account.address)
```

`generatePrivateKey()` creates an independent private key. It has no recoverable parent seed. `createAccount()` combines that generation with public-key/address derivation. A private key imported from a seed-derived account also cannot recover the original seed or sibling accounts.

## Account shape

```ts
import type { Account } from 'nanopay'

type PublicAccount = Pick<Account, 'publicKey' | 'address'>
```

An `Account` has readonly `privateKey`, `publicKey` and `address` fields. Objects are frozen, but their secret strings remain in JavaScript memory. The library does not provide encrypted storage, guaranteed erasure or a backup vault.

Persist secret material using your application's storage design. Avoid serializing full accounts to logs, analytics, URLs or browser error reports.

## Address utilities

| Function                                             | Use                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `publicKeyFromAddress(address)`                      | Decode and checksum-validate an address                        |
| `addressFromPrivateKey(privateKey)`                  | Derive the address directly                                    |
| `normalizeAddress(address)`                          | Validate and normalize `nano_` or `xrb_` input to `nano_`      |
| `deriveAddress(publicKey, { useNanoPrefix: false })` | Produce the historical `xrb_` prefix                           |
| `accountFromSeed(seed, index)`                       | Derive one complete account without retaining a wallet wrapper |

Hex inputs accept either case. Canonical account helpers produce uppercase key hex and `nano_` addresses. [Full signatures](../api.md#accounts-and-keys).
