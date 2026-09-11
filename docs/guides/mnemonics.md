# Mnemonics and recovery

nanopay supports English BIP39 mnemonics and Nano SLIP-0010 derivation. These are distinct from native Nano hex seeds.

## Create and recover

```ts
import { generateMnemonic, walletFromMnemonic } from 'nanopay/mnemonic'

const words = generateMnemonic({ words: 24 })
const wallet = await walletFromMnemonic(words)
const account = wallet.account(0)
console.log(account.address)
```

The supported word counts are 12, 15, 18, 21 and 24; the default is 24. Save the words before accepting funds. The library returns them to your code but does not store them anywhere automatically.

Passphrases are optional. To recover a wallet created with a passphrase, pass the same value as the second argument: `walletFromMnemonic(words, { passphrase })`. Different passphrases derive different wallets, including a missing or mistyped one; they do not produce a “wrong password” error.

## The derivation path

`walletFromMnemonic` derives a 64-byte BIP39 seed with PBKDF2, then Nano accounts at `m/44'/165'/index'`. Indexes range from `0` to `2147483647`. PBKDF2 and the shared path are computed once per wallet; subsequent `wallet.account(index)` calls are synchronous.

```ts
import {
  generateMnemonic,
  deriveMnemonicSeed,
  deriveMnemonicPrivateKey,
} from 'nanopay/mnemonic'
import { accountFromPrivateKey } from 'nanopay/keys'

const words = generateMnemonic()
const bip39Seed = await deriveMnemonicSeed(words)
const privateKey = deriveMnemonicPrivateKey(bip39Seed, 2)
const account = accountFromPrivateKey(privateKey)
console.log(account.address)
```

`deriveMnemonicSeed` returns **128 hex characters**. Do not pass that result to `walletFromSeed`, which expects a 64-character native Nano seed.

## Native seed backup as words

Encoding a native seed as words is a different operation from creating a mnemonic-derived wallet:

```ts
import { generateSeed, walletFromSeed } from 'nanopay/keys'
import { entropyToMnemonic, mnemonicToEntropy } from 'nanopay/mnemonic'

const nativeSeed = generateSeed()
const backupWords = entropyToMnemonic(nativeSeed)
const restoredSeed = mnemonicToEntropy(backupWords)
const account = walletFromSeed(restoredSeed).account()
console.log(account.address)
```

To recover that native wallet, decode the words back to entropy and use `walletFromSeed`. Feeding those same words to `walletFromMnemonic` follows BIP39/SLIP-0010 and yields different accounts. Record the derivation scheme with your backups.

## Validation and compatibility

`isValidMnemonic(value)` checks the English word list, word count and checksum. It does not prove that the phrase belongs to an expected address, uses the expected passphrase, or matches another wallet's derivation scheme.

Mnemonic functions normalize Unicode with NFKD and normalize whitespace. Browser PBKDF2 uses Web Crypto, requiring HTTPS or localhost. Compatibility is checked against the [official Nano key-management vectors](https://docs.nano.org/integration-guides/key-management/); verify the scheme used by any wallet you import from.
