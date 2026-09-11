# Payment links

Payment links encode a Nano destination with optional amount, label and message. nanopay creates and parses the URI text; use your own QR renderer or wallet deep-link integration to display it.

## Create a request

```ts
import { createPaymentUri, parsePaymentUri, createAccount } from 'nanopay'

const account = createAccount()
const uri = createPaymentUri({
  address: account.address,
  amount: '1.25',
  label: 'Coffee',
  message: 'Order 1042',
})
const request = parsePaymentUri(uri)
console.log(uri, request.amount)
```

This generates a fresh account for illustration. Retain its private key before using its address for real payments. For an existing merchant account, supply that account's address instead.

The URI uses `nano:` and encodes amounts in raw. The helper accepts `amount` in Nano or `amountRaw` in raw, but not both. Both are optional when the payer can choose an amount. Unicode labels and messages are encoded with URL query parameters.

## Parse and review

`parsePaymentUri` accepts `nano:` and `nano://` payment links containing `nano_` addresses. It validates the address checksum and returns `{ address, amount?, amountRaw?, label?, message? }`.

The parser rejects duplicate or unsupported parameters, URI fragments, malformed amounts and unsupported actions. It is not a seed-import or representative-change URI parser.

A parsed URI is a request, not proof of payment or authorization to send. Show the destination and amount to the user in your application before initiating a payment. The sender's wallet may omit or edit a requested amount.

## Track the invoice in your application

Keep an invoice record with the destination, expected amount, expiry and settlement status. A label or message in a payment URI is not a private message stored in a Nano block. Do not use it as a ledger-level unique payment identifier.

Use your account allocation and accounting strategy to match confirmed sends to invoices. [WebSocket events](confirmations.md) can trigger reconciliation, and [receivable reads](rpc.md) can identify incoming funds that still need a receive block.
