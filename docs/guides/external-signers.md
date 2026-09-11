# External signers

A signer provides a public key and a `sign(hash)` callback. This lets the client build and publish transactions without holding a local private key itself.

## Implement the contract

```ts
import { createClient, type Signer } from 'nanopay'

export async function sendWithSigner(signer: Signer, to: string) {
  const nano = createClient()
  const result = await nano.send({ account: signer, to, amount: '0.01' })
  return nano.waitForConfirmation(result.hash)
}
```

`Signer` is `{ readonly publicKey: string; sign(hash: string): string | Promise<string> }`. The callback receives a 32-byte hash encoded as hex and returns a 64-byte Nano signature encoded as hex.

Your adapter must use Nano's Ed25519-BLAKE2b scheme. The library verifies the returned signature against the public key and hash before requesting work or publishing. A hardware wallet integration must provide its own connection, device prompts and transport; none are bundled.

## Wrap a local key

```ts
import { createSigner, generatePrivateKey } from 'nanopay'

const signer = createSigner(generatePrivateKey())
console.log(signer.publicKey)
```

`createSigner` adapts a local private key to the same interface. It is useful when the rest of your application wants a uniform signing interface. It does not move the secret into secure hardware or erase it from memory.

## Devices that need the full block

The high-level `Signer` callback receives only the hash. If your device requires the complete block to display and approve the transaction, use the granular preparation flow:

1. Call `prepareSend`, `prepareReceive` or `prepareChangeRepresentative` with public inputs.
2. Pass the returned unsigned block to your device adapter for review and signing.
3. Use `attachSignature` to validate the result, then obtain and attach work.
4. Persist and publish the signed candidate; reconcile that hash if submission is interrupted.

See [blocks and signing](blocks.md) for the full sequence. Prepared transactions can become stale while a user is reviewing them, so coordinate account writes during that period.

## Signing failures

User rejection or an invalid signature happens before publication and does not create a submitted transaction. Network failure during publication is different: preserve the signed candidate and inspect its hash. A Promise-based signer should implement any device cancellation or timeout behavior its transport needs; the `Signer.sign` signature has no `AbortSignal` parameter.
