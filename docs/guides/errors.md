# Errors and recovery

The important distinction is whether a signed block may have reached the node. A request that times out can still have been accepted. nanopay preserves that exact candidate so you can reconcile it before making another payment.

## Error types

| Error                 | Meaning                                                              | What to inspect                                         |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Ordinary input error  | Invalid input, key, amount, builder fields or URL                    | Fix the input; no automatic transaction retry           |
| `NanoRpcError`        | Node, HTTP, network or response-format failure                       | `action`, `status`, `cause`                             |
| `TransactionError`    | A high-level publication attempt failed                              | `transaction.hash`, signed `transaction.block`, `cause` |
| `AccountBlockedError` | This write did not start because an earlier submission is unresolved | The earlier `transaction` and original `cause`          |
| `ReceiveAllError`     | A receive batch stopped                                              | `completed` submissions and the underlying `cause`      |

`AbortError` and `TimeoutError` can also appear as cancellation reasons. When they occur during a high-level publication attempt, inspect the enclosing transaction error rather than assuming nothing happened.

## Preserve a failed candidate

This pattern demonstrates recovery of the **same send** if it confirms after a submission error. It assumes a client, loaded account and destination from the quick start:

```ts
import { TransactionError } from 'nanopay'

try {
  const result = await nano.send({
    account,
    to: recipientAddress,
    amount: '0.01',
  })
  await nano.waitForConfirmation(result.hash)
} catch (error) {
  if (!(error instanceof TransactionError)) throw error

  // Persist this signed candidate in your application's durable journal.
  const candidate = error.transaction
  await nano.waitForConfirmation(candidate.hash, { timeoutMs: 120_000 })

  // Confirmation above proves this exact candidate settled.
  nano.resumeAccount(account.address, candidate.hash)
}
```

If the recovery wait times out or another node error occurs, this example leaves the account blocked and propagates the failure. It does not call `send` again. Reconcile the saved candidate and account state before deciding whether anything needs resubmission.

A missing hash alone is not proof of rejection while a node may still be processing it. Resubmitting the original signed block is different from building a new payment on a later frontier; your recovery policy must distinguish them.

## What account blocking does

After an uncertain high-level submission, queued and future writes to that account reject with `AccountBlockedError`. They are not replayed when the account resumes. Reads and operations on other accounts continue.

`resumeAccount(address, transactionHash)` only clears the local block for that exact candidate. It does not inspect the network, cancel a request, publish a block or assert confirmation. Call it after your reconciliation has established an appropriate next state.

The queue and block are in memory. Restarting a process or creating a new client loses that state; a production service needs a durable transaction journal and account coordination. Granular `publishBlock` and raw `request('process', ...)` do not create this automatic high-level block.

## Partial batches

`ReceiveAllError.completed.transactions` contains receives already submitted before failure. `completed.amount` and `amountRaw` total those submissions. Persist and inspect their hashes even when the overall batch rejects.

If `error.cause` is a `TransactionError`, the stopped receive has its own signed candidate and can be uncertain. Handle it separately from completed entries. Do not blindly restart the entire batch or erase the successful records.

## Read retries and rate limits

Safe reads can use bounded backoff in your application. Distinguish throttling (`status: 429`) from bad parameters or an action blocked by your provider. Avoid an aggressive retry loop that competes with confirmation polling.

For writes, reconciliation comes first. A timeout is a statement about how long the caller waited, not a statement about ledger acceptance.
