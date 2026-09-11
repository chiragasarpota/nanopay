# Proof of work

Every state block needs suitable proof of work. nanopay supports a node/work-peer request, a local WASM engine and a custom provider callback.

## Default transaction behavior

`createClient()` requests work from its configured RPC provider, which is BerryPay in 0.2.0 when no URL is supplied. The client chooses the subtype's threshold and verifies the returned work locally before submission.

RPC work generation and standalone local work generation share a name but run in different places:

| Call                                                       | Where work is generated                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| `nano.generateWork(root, options)`                         | The configured RPC node or its work peers |
| `generateWork(root, options)` imported from `nanopay/work` | Locally with WASM                         |

## Generate locally

```ts
import { generateWork, verifyWork } from 'nanopay/work'

// A low threshold keeps this demonstration quick; it is not mainnet work.
const root = '0'.repeat(64)
const threshold = 'f000000000000000'
const work = await generateWork(root, {
  threshold,
  maxIterations: 100_000,
  signal: AbortSignal.timeout(5_000),
})

if (work === null) throw new Error('Attempt range exhausted')
console.log(verifyWork({ root, work, threshold }))
```

The result is a 16-character hexadecimal nonce, or `null` when the attempt range is exhausted. Cancellation rejects with the signal's reason. Mainnet thresholds are much harder than the demonstration threshold; use the correct network difficulty for real blocks.

## Configure a local work provider

```ts
import { createClient } from 'nanopay/rpc'
import { generateWork } from 'nanopay/work'

const nano = createClient({
  work: async ({ root, threshold, signal }) => {
    const work = await generateWork(root, { threshold, signal })
    if (work === null) throw new Error('Work range exhausted')
    return work
  },
})
```

A custom provider may call a GPU service instead. Return a hex nonce and honor the supplied signal where possible. Work requests need the work root and threshold, not the account's private key.

## Mainnet thresholds

| Constant                                         | Hex threshold      | Block types                      |
| ------------------------------------------------ | ------------------ | -------------------------------- |
| `SEND_WORK_THRESHOLD` / `DEFAULT_WORK_THRESHOLD` | `fffffff800000000` | Send and representative change   |
| `RECEIVE_WORK_THRESHOLD`                         | `fffffe0000000000` | Receive and open                 |
| `LEGACY_WORK_THRESHOLD`                          | `ffffffc000000000` | Historical epoch-1 compatibility |

For manual receive/open work, pass `RECEIVE_WORK_THRESHOLD` to generation and `attachWork`. Its default is the send threshold. Dev networks can require different work settings; configure those explicitly.

## Batching and workers

The WASM module compiles once per realm and isolates each request's mutable memory. It processes work in batches (default 16,384 attempts), yielding between batches so cancellation and other tasks can run.

`workerIndex` and `workerCount` partition the nonce space. They do not start workers. To use multiple CPU cores, create Web Workers or Node worker threads and run one partition in each. Stop the remaining workers when one finds valid work.

Generation time is probabilistic. Increasing batch size changes scheduling overhead and responsiveness, not the difficulty. GPU services are more appropriate for sustained mainnet generation. See [measured performance](../performance.md) and [runtime restrictions](../runtimes.md).
