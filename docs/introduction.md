# Build with nanopay

nanopay is a JavaScript and TypeScript library for Nano accounts, payments, state blocks, signing, proof of work and node communication. It is based on [nanocurrency-js](https://github.com/marvinroger/nanocurrency-js) and distributed under GPL-3.0-only.

## Choose the right level

| Level              | Examples                                                | What you provide                                                |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------- |
| Payment workflows  | `send`, `receive`, `receiveAll`, `changeRepresentative` | An account or signer, transaction inputs and a node             |
| Preparation        | `prepareSend`, `prepareReceive`                         | Public account information; the client reads current node state |
| Offline primitives | `derivePrivateKey`, `buildSendBlock`, `signHash`        | Key material or the exact block fields                          |
| Node access        | `getBalance`, `getBlock`, `request`                     | Public addresses, hashes or raw RPC parameters                  |

All levels use the same Nano block and cryptographic implementation. You can start with the client, then replace signing or work generation without changing your account derivation.

## How a payment works

1. The sender creates and signs a block reducing their account balance.
2. A node accepts the block; the client returns its hash with `status: 'submitted'`.
3. Confirmation establishes that the send has settled according to the node.
4. The destination creates a receive block to add the incoming amount to its own balance. The first receive also opens the destination account.

A destination can have receivable funds before it has an opened account. `getBalance` distinguishes balance from receivable; `getAccountInfo` returns `null` for an unopened account. A confirmed send does not automatically create the receiver's block.

## Local code and network calls

Creating wallets, deriving keys, validating addresses, converting amounts and signing blocks do not contact a node. Constructing a client does not send a request either.

RPC methods contact the configured node. Starting in **0.2.0**, omitting the URL selects BerryPay's public mainnet endpoint. Version **0.1.0** requires an explicit URL. [Choose your node](guides/node-configuration.md) explains both versions and the provider's role.

## Scope

The library provides transaction tools. Your application supplies secret storage, representative selection, persistent payment records, coordination between independent writers and any hardware-device transport. It does not run a consensus node or select a representative for you.

Start with the [quick start](getting-started.md), then use the [complete API reference](api.md) for exact signatures and return values.
