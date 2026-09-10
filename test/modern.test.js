import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as nano from '../dist/legacy.js'

const seed = '0'.repeat(64)
const root = 'b9cb6b51b8eb869af085c4c03e7dc539943d0bdde13b21436b687c9c7ea56cb0'
const vectors = JSON.parse(
  readFileSync(new URL('./upstream/data/valid_keys.json', import.meta.url)),
)

test('simple wallet API matches every upstream key/address vector', () => {
  for (const vector of vectors) {
    const wallet = nano.deriveWallet(vector.seed, vector.index)
    assert.equal(wallet.privateKey, vector.secretKey)
    assert.equal(wallet.publicKey, vector.publicKey)
    assert.equal(wallet.address, vector.account.replace('xrb_', 'nano_'))
    assert.equal(wallet.index, vector.index)
  }
})
test('wallet creation uses fresh seeds and modern addresses', async () => {
  const [a, b] = await Promise.all([nano.createWallet(), nano.createWallet()])
  assert.notEqual(a.seed, b.seed)
  assert.notEqual(a.privateKey, b.privateKey)
  assert.ok(nano.checkAddress(a.address))
  assert.ok(a.address.startsWith('nano_'))
})
test('amount conversion preserves single raw, uint128, and long decimal precision', () => {
  const max = (1n << 128n) - 1n
  for (const raw of [0n, 1n, 123456789123456789123456789n, max]) {
    assert.equal(nano.nanoToRaw(nano.rawToNano(raw)), raw.toString())
  }
  assert.equal(nano.nanoToRaw('1.25'), '1250000000000000000000000000000')
  assert.equal(nano.rawToNano('1'), '0.000000000000000000000000000001')
  const tiny = '0.' + '0'.repeat(70) + '1'
  assert.equal(
    nano.convert(nano.convert(tiny, { from: 'NANO', to: 'raw' }), {
      from: 'raw',
      to: 'NANO',
    }),
    tiny,
  )
})
test('amount conversion rejects precision loss, malformed input and overflow', () => {
  for (const value of [
    '',
    'NaN',
    'Infinity',
    '1e3',
    '-1',
    ' 1',
    '.1',
    '1.',
    1,
    null,
    undefined,
  ]) {
    assert.throws(() => nano.nanoToRaw(value))
  }
  assert.throws(() => nano.nanoToRaw('0.' + '0'.repeat(30) + '1'))
  assert.throws(() => nano.rawToNano(1))
  assert.throws(() => nano.rawToNano((1n << 128n).toString()))
  assert.throws(() => nano.convert('1.1', { from: 'raw', to: 'hex' }))
  assert.throws(() =>
    nano.convert((1n << 128n).toString(), { from: 'raw', to: 'hex' }),
  )
  for (const unit of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => nano.convert('1', { from: unit, to: 'raw' }))
  }
})
test('validators reject arbitrary JavaScript values without throwing', () => {
  const checks = [
    nano.checkSeed,
    nano.checkKey,
    nano.checkHash,
    nano.checkAddress,
    nano.checkWork,
    nano.checkThreshold,
    nano.checkSignature,
    nano.checkAmount,
    nano.checkIndex,
  ]
  for (const check of checks)
    for (const value of [
      null,
      undefined,
      {},
      [],
      Symbol('invalid'),
      NaN,
      Infinity,
    ])
      assert.equal(check(value), false)
})
test('current Nano difficulty defaults and legacy opt-in are explicit', () => {
  assert.equal(nano.DEFAULT_WORK_THRESHOLD, 'fffffff800000000')
  assert.equal(nano.RECEIVE_WORK_THRESHOLD, 'fffffe0000000000')
  assert.equal(
    nano.validateWork({
      blockHash: root,
      work: '0000000000010600',
      threshold: nano.LEGACY_WORK_THRESHOLD,
    }),
    true,
  )
  assert.equal(
    nano.validateWork({ blockHash: root, work: '0000000000010600' }),
    false,
  )
})
test('WASM work agrees with independent JS validation over diverse roots and ranges', async () => {
  for (let index = 0; index < 12; index++) {
    const hash = index.toString(16).padStart(64, '0')
    const work = await nano.computeWork(hash, {
      workerIndex: index,
      workerCount: 12,
      workThreshold: 'f000000000000000',
      maxIterations: 10000,
    })
    assert.ok(work)
    assert.ok(
      nano.validateWork({
        blockHash: hash,
        work,
        threshold: 'f000000000000000',
      }),
    )
    const nonce = BigInt(`0x${work}`)
    assert.ok(nonce >= ((1n << 64n) * BigInt(index)) / 12n)
    assert.ok(nonce < ((1n << 64n) * BigInt(index + 1)) / 12n)
  }
})
test('concurrent WASM requests do not share roots or result memory', async () => {
  const roots = Array.from({ length: 10 }, (_, index) =>
    index.toString(16).padStart(64, '0'),
  )
  const results = await Promise.all(
    roots.map((blockHash) =>
      nano.computeWork(blockHash, {
        workThreshold: 'ff00000000000000',
        batchSize: 4,
        maxIterations: 10000,
      }),
    ),
  )
  results.forEach((work, index) =>
    assert.ok(
      nano.validateWork({
        blockHash: roots[index],
        work,
        threshold: 'ff00000000000000',
      }),
    ),
  )
})
test('work can be bounded or cancelled before and during computation', async () => {
  assert.equal(await nano.computeWork(root, { maxIterations: 0 }), null)
  assert.equal(
    await nano.computeWork(root, {
      maxIterations: 1,
      workThreshold: 'ffffffffffffffff',
    }),
    null,
  )
  await assert.rejects(
    nano.computeWork(root, { signal: AbortSignal.abort() }),
    { name: 'AbortError' },
  )
  const controller = new AbortController()
  const work = nano.computeWork(root, {
    signal: controller.signal,
    workThreshold: 'ffffffffffffffff',
    batchSize: 32,
  })
  setTimeout(() => controller.abort(), 5)
  await assert.rejects(work, { name: 'AbortError' })
  await assert.rejects(
    nano.computeWork(root, {
      workerIndex: 0,
      workerCount: Number.MAX_SAFE_INTEGER + 1,
    }),
  )
  await assert.rejects(nano.computeWork(root, { maxIterations: -1 }))
  await assert.rejects(nano.computeWork(root, { batchSize: 0 }))
})
test('worker indexes above 255 retain their full range and unsigned nonce', async () => {
  const work = await nano.computeWork(root, {
    workerIndex: 299,
    workerCount: 300,
    workThreshold: '0000000000000000',
  })
  assert.equal(BigInt(`0x${work}`), ((1n << 64n) * 299n) / 300n)
})
test('state blocks reject invalid work strings and missing data', () => {
  const wallet = nano.deriveWallet(seed)
  assert.throws(() => nano.createBlock(wallet.privateKey, null), /Block data/)
  assert.throws(
    () =>
      nano.createBlock(wallet.privateKey, {
        previous: seed,
        link: '1'.repeat(64),
        balance: '1',
        representative: wallet.address,
        work: 'bad',
      }),
    /Work is not valid/,
  )
})
