# Quick start

Use Node.js 22 or newer. Browser setup is covered in [application integration](guides/integration.md).

## Install

```sh
npm install nanopay
npm install --save-dev typescript @types/node
```

These docs describe **0.2.0**. Check the installed version with `npm ls nanopay`. If you use **0.1.0**, upgrade or pass `createClient({ rpcUrl: 'https://xno-rpc.berrypay.org/proxy' })` wherever an example uses `createClient()`.

Use ESM (`"type": "module"` in `package.json`) and TypeScript's `NodeNext` module mode for the Node examples. Your project's TypeScript runner or compilation step must support top-level `await`. CommonJS is also available through `require('nanopay')`.

## Create an account

```ts
import { createWallet } from 'nanopay'

const wallet = createWallet()
const account = wallet.account()
console.log(account.address)
```

Save `wallet.seed` using your application's secret-storage mechanism before accepting funds. The example prints only the public address. `account` also holds the private key, so do not log the entire object.

`wallet.account(1)` derives the next account from the same seed. Creating an account does not create a block on the network or give it a spendable balance.

## Read a balance

```ts
import { createClient, walletFromSeed } from 'nanopay'

const seed = process.env.NANO_SEED
if (!seed) throw new Error('Set NANO_SEED to your saved wallet seed')

const nano = createClient()
const account = walletFromSeed(seed).account()
const funds = await nano.getBalance(account.address)

console.log(funds.balance, funds.receivable) // Exact Nano strings
```

`balance` is the confirmed balance. `receivable` is confirmed incoming Nano awaiting a receive block. Both also have raw equivalents: `balanceRaw` and `receivableRaw`.

## Receive your first funds

Send Nano to your account address using an existing wallet. After that send is confirmed, receive it with your own signing account and a representative you choose:

```ts
import { createClient, walletFromSeed } from 'nanopay'

const seed = process.env.NANO_SEED
const representative = process.env.NANO_REPRESENTATIVE
if (!seed || !representative)
  throw new Error('Set NANO_SEED and NANO_REPRESENTATIVE')

const nano = createClient()
const account = walletFromSeed(seed).account()
const received = await nano.receiveAll({
  account,
  representative,
  maxBlocks: 20,
})

for (const transaction of received.transactions) {
  await nano.waitForConfirmation(transaction.hash)
}
console.log('Received:', received.amount, 'XNO')
```

The first receive opens the account. Your representative is a Nano address used for voting delegation; selecting one is an application/user choice. Later receives preserve the existing representative unless you supply another.

## Send and confirm

```ts
import { createClient, walletFromSeed } from 'nanopay'

const seed = process.env.NANO_SEED
const to = process.env.NANO_RECIPIENT
if (!seed || !to) throw new Error('Set NANO_SEED and NANO_RECIPIENT')

const nano = createClient()
const account = walletFromSeed(seed).account()
const sent = await nano.send({ account, to, amount: '0.001' })
await nano.waitForConfirmation(sent.hash)
console.log('Confirmed:', sent.hash)
```

This account must already have enough spendable Nano. `amount` is an exact decimal string in Nano; use `amountRaw` for raw. Supply exactly one of them.

`send` builds a block, signs locally, obtains and verifies work, and submits once. A failed submission can have an uncertain outcome. [Handle errors and reconcile the exact hash](guides/errors.md) before retrying a payment.

## Next steps

- [Send and receive](guides/transactions.md): queues, single receives, batches and representatives.
- [Accounts and keys](guides/accounts.md): private-key imports and granular derivation.
- [Node configuration](guides/node-configuration.md): BerryPay, your own node and WebSockets.
- [API reference](api.md): every exported function and client method.
