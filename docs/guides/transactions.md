# Send and receive

`NanoClient` combines account-state reads, block construction, local signing, work generation and one publication attempt. Use a funded `Account` or an [external signer](external-signers.md).

The following examples assume `nano = createClient()` and a loaded signing `account`, as shown in the [quick start](../getting-started.md). Replace recipient, representative and source-hash variables with your application's inputs.

## Send an exact amount

```ts
const sent = await nano.send({
  account,
  to: recipientAddress,
  amount: '0.125',
})
await nano.waitForConfirmation(sent.hash)
```

Alternatively, supply `amountRaw: '1'` to send one raw. Never supply both amount fields. An unopened account or insufficient balance fails before publication.

The result contains `hash`, the signed `block`, `subtype` and `status: 'submitted'`. Submission is node acceptance. Wait for confirmation when your application needs settlement; the receiver still needs to receive the transfer into their account.

## Receive one payment

```ts
const received = await nano.receive({
  account,
  hash: incomingSendHash,
  representative: chosenRepresentative,
})
await nano.waitForConfirmation(received.hash)
```

`hash` is the incoming sender's block hash. The client verifies that the confirmed send belongs to the destination account. If the destination has no frontier, this creates an open block and requires a representative supplied here or in the client's configuration.

On an existing account, omit `representative` to retain the current one. If historical source information has been pruned, the client uses confirmed account-scoped receivable records and can page through them. A missing, foreign or unconfirmed incoming transfer cannot be received through this helper.

## Receive a bounded batch

```ts
const batch = await nano.receiveAll({
  account,
  representative: chosenRepresentative,
  maxBlocks: 100,
})

for (const transaction of batch.transactions) {
  await nano.waitForConfirmation(transaction.hash)
}
console.log(batch.amount, batch.hasMore)
```

The default limit is 100; accepted limits range from 1 to 10,000. Each receive has its own block and hash. The client reuses account state and chains receives sequentially within the batch.

`amount` and `amountRaw` total the submitted receives. `hasMore` describes the fetched snapshot, not future incoming payments. Call again after reconciling and confirming the previous result if you want another bounded batch. Large workloads should respect provider limits rather than run an unbounded loop.

If receiving stops, `ReceiveAllError.completed` preserves earlier submissions. They are not rolled back. [Recover from a partial batch](errors.md#partial-batches).

## Change representative

```ts
const changed = await nano.changeRepresentative({
  account,
  representative: chosenRepresentative,
})
await nano.waitForConfirmation(changed.hash)
```

The account must be open. Changing representative preserves the balance and requires send/change proof of work. nanopay does not automatically choose or rank representatives.

## Coordinate concurrent writes

High-level writes to one account queue inside a single client instance. This avoids reading the same frontier for simultaneous sends. Reads and writes to different accounts can proceed independently.

```ts
const first = nano.send({ account, to: recipientA, amount: '0.01' })
const second = nano.send({ account, to: recipientB, amount: '0.02' })
const settled = await Promise.allSettled([first, second])
```

Inspect each result. If the first submission has an uncertain outcome, queued and later writes are blocked until you reconcile it. The second payment is not silently retried.

The queue is in memory and belongs to one client. Multiple processes, devices, independently created clients and raw/prepared block operations require application-level coordination. Reuse a client for the account-writing service instead of constructing one per payment.

## Cancellation

Pass `signal` to a workflow, for example `nano.send({ account, to, amount: '1', signal })`. Cancellation before publication stops the operation without creating a submission ambiguity. Cancellation during publication can occur after the node received the block. Treat that as [an uncertain transaction](errors.md), not proof of cancellation on the network.
