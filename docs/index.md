---
layout: home
pageClass: nanopay-home
title: Build with Nano
markdownStyles: false
---

<script setup>
import NanoLanding from '../site/.vitepress/theme/components/NanoLanding.vue'
</script>

<NanoLanding>
<template #send>

```ts
import { createClient, walletFromSeed } from 'nanopay'

const nano = createClient()
const account = walletFromSeed(process.env.NANO_SEED!).account()

const sent = await nano.send({
  account,
  to: process.env.NANO_RECIPIENT!,
  amount: '0.01',
})

await nano.waitForConfirmation(sent.hash)
```

</template>
<template #receive>

```ts
import { createClient, walletFromSeed } from 'nanopay'

const nano = createClient()
const account = walletFromSeed(process.env.NANO_SEED!).account()

const batch = await nano.receiveAll({
  account,
  representative: process.env.NANO_REPRESENTATIVE!,
  maxBlocks: 20,
})

for (const transaction of batch.transactions) {
  await nano.waitForConfirmation(transaction.hash)
}
```

</template>
<template #keys>

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

</template>
<template #request>

```ts
import { createPaymentUri } from 'nanopay/payments'

const uri = createPaymentUri({
  address: process.env.NANO_ACCOUNT!,
  amount: '1.25',
  label: 'Coffee',
  message: 'Order 1042',
})

// Share the URI with a wallet or your QR renderer.
console.log(uri)
```

</template>
<template #watch>

```ts
import { watchConfirmations } from 'nanopay/confirmations'

const events = watchConfirmations('wss://xno-rpc.berrypay.org/ws', {
  accounts: [process.env.NANO_ACCOUNT!],
})

for await (const event of events) {
  console.log(event.hash)
  // Stop after the first event and close the stream.
  break
}
```

</template>
</NanoLanding>
