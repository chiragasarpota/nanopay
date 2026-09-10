import { performance } from 'node:perf_hooks'
import { cpus, platform, arch } from 'node:os'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import * as nano from '../dist/legacy.js'

const require = createRequire(import.meta.url)
// Optional absolute path to an independently installed nanocurrency@2.5.0.
const baseline = process.env.NANOPAY_BASELINE
  ? require(process.env.NANOPAY_BASELINE)
  : undefined
const vector = JSON.parse(
  readFileSync(
    new URL('../test/upstream/data/valid_blocks.json', import.meta.url),
  ),
)[0]
const key = vector.secretKey
const publicKey = nano.derivePublicKey(key)
const signature = nano.signBlock({ hash: vector.block.hash, secretKey: key })
const tasks = [
  [
    'Nano → raw',
    30000,
    (api) =>
      api.convert('123.456789012345678901234567890123', {
        from: 'NANO',
        to: 'raw',
      }),
  ],
  [
    'raw → Nano',
    30000,
    (api) =>
      api.convert('123456789012345678901234567890123', {
        from: 'raw',
        to: 'NANO',
      }),
  ],
  ['deriveSecretKey', 5000, (api) => api.deriveSecretKey(key, 123)],
  [
    'deriveAddress',
    5000,
    (api) => api.deriveAddress(publicKey, { useNanoPrefix: true }),
  ],
  ['hashBlock', 2000, (api) => api.hashBlock(vector.block.data)],
  [
    'signBlock',
    100,
    (api) => api.signBlock({ hash: vector.block.hash, secretKey: key }),
  ],
  [
    'verifyBlock',
    100,
    (api) => api.verifyBlock({ hash: vector.block.hash, signature, publicKey }),
  ],
]
function measure(api, operation, count) {
  for (let i = 0; i < Math.min(count, 500); i++) operation(api)
  const samples = []
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now()
    for (let i = 0; i < count; i++) operation(api)
    samples.push((count * 1000) / (performance.now() - start))
  }
  return samples.sort((a, b) => a - b)[2]
}
const results = tasks.map(([operation, iterations, fn]) => {
  const upstreamOpsPerSecond = baseline
    ? measure(baseline, fn, iterations)
    : undefined
  const opsPerSecond = measure(nano, fn, iterations)
  return {
    operation,
    opsPerSecond: Math.round(opsPerSecond),
    ...(baseline
      ? {
          upstreamOpsPerSecond: Math.round(upstreamOpsPerSecond),
          speedup: Number((opsPerSecond / upstreamOpsPerSecond).toFixed(2)),
        }
      : {}),
  }
})
const blockHash =
  'b9cb6b51b8eb869af085c4c03e7dc539943d0bdde13b21436b687c9c7ea56cb0'
await nano.computeWork(blockHash, {
  workThreshold: '0000000000000000',
  maxIterations: 1,
})
const workSamples = []
for (let i = 0; i < 5; i++) {
  const start = performance.now()
  const work = await nano.computeWork(blockHash, {
    workThreshold: 'ffffffffffffffff',
    maxIterations: 1000000,
  })
  if (work !== null)
    throw new Error('Unexpected successful nonce in bounded benchmark')
  workSamples.push((1000000 * 1000) / (performance.now() - start))
}
results.push({
  operation: 'WASM nonce attempts (including event-loop yields)',
  opsPerSecond: Math.round(workSamples.sort((a, b) => a - b)[2]),
})
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: `${platform()} ${arch()}`,
      cpu: cpus()[0]?.model,
      method:
        'Median of five warm samples; same machine and inputs. RPC latency depends on your node/network.',
      results,
    },
    null,
    2,
  ),
)
