import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as n from '../dist/index.js'
const account = n.accountFromSeed('0'.repeat(64))
const other = n.accountFromSeed('0'.repeat(64), 1)
const incoming = ['2', '3', '4'].map((s) => ({
  hash: s.repeat(64),
  amountRaw: '10',
  source: other.address,
}))
const workFixtures = JSON.parse(
  readFileSync(new URL('./data/receive-work.json', import.meta.url)),
)
const sendFixture = JSON.parse(
  readFileSync(new URL('./upstream/data/valid_blocks.json', import.meta.url)),
)
  .map((v) => v.block.data)
  .find(
    (b) =>
      b.previous !== n.ZERO_HASH &&
      n.verifyWork({ root: b.previous, work: b.work }),
  )
const snapshot = (frontier = sendFixture.previous) => ({
  frontier,
  balance: n.nanoToRaw('2'),
  representative: account.address,
  block_count: '1',
  confirmed_frontier: frontier,
  confirmed_balance: n.nanoToRaw('2'),
  confirmed_height: '1',
})
const blockInfo = (confirmed = true, destination = account.publicKey) => ({
  block_account: other.address,
  amount: '10',
  balance: '90',
  confirmed,
  subtype: 'send',
  contents: { type: 'state', link: destination },
})
function node(handler, options = {}) {
  const calls = []
  const client = n.createClient({
    rpcUrl: 'https://node.example',
    ...options,
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body)
      calls.push(body)
      const result = await handler(body, init)
      return result instanceof Response ? result : Response.json(result)
    },
  })
  return { client, calls }
}
const processReply = (body) => ({ hash: n.hashBlock(body.block) })
test('send uses granular signing, exact amounts, validated work and a single process call', async () => {
  const { client, calls } = node((body) => {
    if (body.action === 'account_info') return snapshot()
    if (body.action === 'work_generate') return { work: sendFixture.work }
    if (body.action === 'process') return processReply(body)
    assert.fail(body.action)
  })
  const result = await client.send({
    account,
    to: other.address,
    amount: '0.125',
  })
  assert.equal(result.status, 'submitted')
  assert.equal(result.block.balance, n.nanoToRaw('1.875'))
  assert.equal(result.block.link, other.publicKey)
  assert.ok(n.verifyBlock(result.block))
  assert.deepEqual(
    calls.map((c) => c.action),
    ['account_info', 'work_generate', 'process'],
  )
  const serialized = JSON.stringify(calls)
  assert.equal(serialized.includes(account.privateKey), false)
  assert.equal(serialized.includes('privateKey'), false)
})
test('prepareSend and custom signers give full control without exposing local keys', async () => {
  let signedHash
  const { client, calls } = node(
    (body) =>
      body.action === 'account_info' ? snapshot() : processReply(body),
    {
      work: ({ root, threshold }) => {
        assert.equal(root, sendFixture.previous)
        assert.equal(threshold, n.SEND_WORK_THRESHOLD)
        return sendFixture.work
      },
    },
  )
  const prepared = await client.prepareSend({
    account: account.address,
    to: other.address,
    amountRaw: '1',
  })
  assert.equal(Object.hasOwn(prepared.block, 'signature'), false)
  assert.equal(calls.length, 1)
  const result = await client.send({
    account: {
      publicKey: account.publicKey,
      async sign(hash) {
        signedHash = hash
        return n.signHash(hash, account.privateKey)
      },
    },
    to: other.address,
    amountRaw: '1',
  })
  assert.equal(signedHash, result.hash)
  assert.ok(n.verifyBlock(result.block))
  await assert.rejects(
    client.send({
      account: { publicKey: account.publicKey, sign: () => '0'.repeat(128) },
      to: other.address,
      amount: '1',
    }),
    /signature/,
  )
  assert.equal(calls.filter((c) => c.action === 'process').length, 1)
})
test('same-account writes read the new frontier only after the earlier process completes', async () => {
  let frontier = sendFixture.previous
  let reads = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let began
  const entered = new Promise((resolve) => {
    began = resolve
  })
  const { client } = node(async (body) => {
    if (body.action === 'account_info') {
      reads++
      if (reads === 2) {
        assert.notEqual(frontier, sendFixture.previous)
        throw new Error('second read observed the committed frontier')
      }
      return snapshot(frontier)
    }
    if (body.action === 'work_generate') return { work: sendFixture.work }
    if (body.action === 'process') {
      began()
      await gate
      frontier = n.hashBlock(body.block)
      return { hash: frontier }
    }
  })
  const first = client.send({ account, to: other.address, amountRaw: '1' })
  await entered
  const second = client.send({ account, to: other.address, amountRaw: '2' })
  const secondCheck = assert.rejects(second, n.NanoRpcError)
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(reads, 1)
  release()
  await first
  await secondCheck
  assert.equal(reads, 2)
})
test('cancelling a queued write does not bypass the earlier in-flight write', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let began
  const entered = new Promise((resolve) => {
    began = resolve
  })
  let reads = 0
  const { client } = node(async (body) => {
    if (body.action === 'account_info') {
      reads++
      if (reads > 1) throw new Error('stop after checking the queue')
      return snapshot()
    }
    if (body.action === 'work_generate') return { work: sendFixture.work }
    if (body.action === 'process') {
      began()
      await gate
      return processReply(body)
    }
  })
  const first = client.send({ account, to: other.address, amountRaw: '1' })
  await entered
  const controller = new AbortController()
  const middle = client.send({
    account,
    to: other.address,
    amountRaw: '1',
    signal: controller.signal,
  })
  controller.abort()
  await assert.rejects(middle, { name: 'AbortError' })
  const third = assert.rejects(
    client.send({ account, to: other.address, amountRaw: '1' }),
  )
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(reads, 1)
  release()
  await first
  await third
  assert.equal(reads, 2)
})
test('submission errors retain the exact signed transaction and never retry', async () => {
  const { client, calls } = node((body) => {
    if (body.action === 'account_info') return snapshot()
    if (body.action === 'work_generate') return { work: sendFixture.work }
    return new Response('', { status: 503 })
  })
  await assert.rejects(
    client.send({ account, to: other.address, amountRaw: '1' }),
    (error) => {
      assert.ok(error instanceof n.TransactionError)
      assert.ok(error.cause instanceof n.NanoRpcError)
      assert.equal(error.transaction.hash, n.hashBlock(error.transaction.block))
      assert.ok(n.verifyBlock(error.transaction.block))
      return true
    },
  )
  assert.equal(calls.filter((c) => c.action === 'process').length, 1)
})
test('receive validates confirmed source ownership and requires a chosen opening representative', async () => {
  let destination = account.publicKey
  let confirmed = true
  const { client } = node((body) => {
    if (body.action === 'account_info') return { error: 'Account not found' }
    if (body.action === 'block_info') return blockInfo(confirmed, destination)
    if (body.action === 'receivable_exists') return { exists: '1' }
    if (body.action === 'work_generate') return { work: workFixtures[0].work }
    return processReply(body)
  })
  await assert.rejects(
    client.receive({ account, hash: incoming[0].hash }),
    /representative/,
  )
  destination = other.publicKey
  await assert.rejects(
    client.receive({
      account,
      hash: incoming[0].hash,
      representative: account.address,
    }),
    /confirmed, unreceived send/,
  )
  destination = account.publicKey
  confirmed = false
  await assert.rejects(
    client.receive({
      account,
      hash: incoming[0].hash,
      representative: account.address,
    }),
    /confirmed, unreceived send/,
  )
  confirmed = true
  const result = await client.receive({
    account,
    hash: incoming[0].hash,
    representative: account.address,
  })
  assert.equal(result.subtype, 'open')
  assert.equal(result.hash, workFixtures[0].hash)
  assert.equal(result.block.balance, '10')
})
function receiving(failAt) {
  let submissions = 0
  return node(
    (body) => {
      if (body.action === 'account_info') return { error: 'Account not found' }
      if (body.action === 'receivable')
        return {
          blocks: Object.fromEntries(
            incoming.map((v) => [
              v.hash,
              { amount: v.amountRaw, source: v.source },
            ]),
          ),
        }
      if (body.action === 'process') {
        submissions++
        return submissions === failAt ? { error: 'Fork' } : processReply(body)
      }
      assert.fail(body.action)
    },
    {
      representative: account.address,
      work: ({ root, threshold }) => {
        assert.equal(threshold, n.RECEIVE_WORK_THRESHOLD)
        const fixture = workFixtures.find(
          (v) => v.root.toUpperCase() === root.toUpperCase(),
        )
        assert.ok(fixture, 'work must use the updated frontier')
        return fixture.work
      },
    },
  )
}
test('receiveAll chains real signed blocks, bounds the snapshot and reuses account state', async () => {
  const { client, calls } = receiving()
  const result = await client.receiveAll({ account, maxBlocks: 2 })
  assert.deepEqual(
    result.transactions.map((v) => v.hash),
    workFixtures.slice(0, 2).map((v) => v.hash),
  )
  assert.deepEqual(
    result.transactions.map((v) => v.subtype),
    ['open', 'receive'],
  )
  assert.equal(result.amountRaw, '20')
  assert.equal(result.hasMore, true)
  assert.equal(calls.filter((c) => c.action === 'account_info').length, 1)
  assert.equal(calls.find((c) => c.action === 'receivable').count, '3')
})
test('receiveAll exposes completed blocks and an uncertain failed block without automatic retry', async () => {
  const { client, calls } = receiving(2)
  await assert.rejects(client.receiveAll({ account }), (error) => {
    assert.ok(error instanceof n.ReceiveAllError)
    assert.equal(error.completed.transactions.length, 1)
    assert.equal(error.completed.amountRaw, '10')
    assert.ok(error.cause instanceof n.TransactionError)
    assert.equal(error.cause.transaction.hash, workFixtures[1].hash)
    return true
  })
  assert.equal(calls.filter((c) => c.action === 'process').length, 2)
})
test('representative changes preserve balance and use send difficulty', async () => {
  const { client } = node((body) =>
    body.action === 'account_info'
      ? snapshot()
      : body.action === 'work_generate'
        ? { work: sendFixture.work }
        : processReply(body),
  )
  const result = await client.changeRepresentative({
    account,
    representative: other.address,
  })
  assert.equal(result.block.balance, n.nanoToRaw('2'))
  assert.equal(result.block.representative, other.address)
  assert.equal(result.block.link, n.ZERO_HASH)
  assert.equal(result.subtype, 'change')
})
test('confirmation polling distinguishes missing, submitted and confirmed blocks; supports timeout and abort', async () => {
  let count = 0
  const { client } = node(() =>
    ++count === 1 ? { error: 'Block not found' } : blockInfo(count >= 3),
  )
  const result = await client.waitForConfirmation(incoming[0].hash, {
    pollIntervalMs: 1,
    timeoutMs: 1000,
  })
  assert.equal(result.confirmed, true)
  assert.equal(count, 3)
  const missing = node(() => ({ error: 'Block not found' })).client
  await assert.rejects(
    missing.waitForConfirmation(incoming[0].hash, {
      pollIntervalMs: 1,
      timeoutMs: 10,
    }),
    { name: 'TimeoutError' },
  )
  await assert.rejects(
    missing.waitForConfirmation(incoming[0].hash, {
      signal: AbortSignal.abort(),
    }),
    { name: 'AbortError' },
  )
  const denied = node(() => ({ error: 'Access denied' })).client
  await assert.rejects(
    denied.waitForConfirmation(incoming[0].hash),
    /Access denied/,
  )
})
test('batch balances and receivable checks reject missing/invalid RPC fields', async () => {
  const { client, calls } = node(() => ({
    balances: {
      [account.address]: { balance: '1', receivable: '2' },
      [other.address]: { balance: '0', pending: '0' },
    },
  }))
  const values = await client.getBalances([account.address, other.address])
  assert.equal(values[account.address].balanceRaw, '1')
  assert.equal(calls[0].include_only_confirmed, true)
  assert.deepEqual(await client.getBalances([]), {})
  await assert.rejects(
    node(() => ({ balances: {} })).client.getBalances([account.address]),
    n.NanoRpcError,
  )
  await assert.rejects(
    node(() => ({ exists: 'yes' })).client.isReceivable(incoming[0].hash),
    n.NanoRpcError,
  )
  assert.equal(
    await node(() => ({ exists: '0' })).client.isReceivable(incoming[0].hash),
    false,
  )
})
