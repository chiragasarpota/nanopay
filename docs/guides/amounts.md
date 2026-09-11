# Amounts and validation

## Use exact strings

One Nano is `10^30` raw. A raw is the smallest unit. JavaScript floating-point numbers cannot represent all possible Nano balances exactly, so the canonical amount API takes decimal strings.

```ts
import { nanoToRaw, rawToNano } from 'nanopay/amounts'

nanoToRaw('1.25') // '1250000000000000000000000000000'
rawToNano('1') // '0.000000000000000000000000000001'
rawToNano(1n) // Same result
```

`amount` means Nano. `amountRaw` and `balanceRaw` mean raw. Sending functions require exactly one of `amount` or `amountRaw`; this is enforced by TypeScript and at runtime.

Do not use `Number(balanceRaw)` or convert an amount to a float before passing it to nanopay. For comparisons and raw arithmetic, use `BigInt`:

```ts
import { nanoToRaw, rawToNano } from 'nanopay/amounts'

const balanceRaw = nanoToRaw('2')
const paymentRaw = nanoToRaw('0.125')
if (BigInt(paymentRaw) > BigInt(balanceRaw))
  throw new Error('Insufficient balance')
const remaining = rawToNano(BigInt(balanceRaw) - BigInt(paymentRaw))
```

## Accepted values and bounds

Canonical raw strings are non-negative integers without unnecessary leading zeros. Nano amounts must represent an exact whole number of raw. Fractional raw and values outside unsigned 128-bit range are rejected.

Zero can be a balance or a conversion input; sending zero is rejected by transaction builders. Exact conversion is not display formatting. Decide how many digits to show in your UI separately from the value you sign or submit.

The general `convert` function and `Unit` remain available for compatibility. Historical `Unit.nano` means `10^24` raw. Use `nanoToRaw` and `rawToNano` for the current Nano denomination to avoid that legacy naming ambiguity.

## Validate user input

```ts
import { isValidAddress, isValidSeed, isValidRawAmount } from 'nanopay'

function validateDestination(address: unknown, raw: unknown): boolean {
  return isValidAddress(address) && isValidRawAmount(raw)
}

isValidSeed('not a seed') // false
```

The `isValid*` predicates accept unknown values and return booleans or type guards. `isValidAddress` checks the address structure and checksum. It does not establish ownership or whether an account is open.

`isValidPrivateKey`, `isValidPublicKey`, `isValidSignature` and `isValidWorkFormat` are format checks. Use `verifyHash`, `verifyBlock` or `verifyWork` when you need cryptographic verification. [All validators](../api.md#amounts-and-validation).
