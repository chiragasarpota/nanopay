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
for (const failureMode of ['abort', 'timeout']) {
  test(`${failureMode} during process blocks queued and future writes until explicit reconciliation`, async () => {
    const controller = new AbortController()
    let began
    const entered = new Promise((resolve) => {
      began = resolve
    })
    let finishProcessing
    let frontier = sendFixture.previous
    let accountReads = 0
    const { client, calls } = node(
      (body, init) => {
        if (body.action === 'account_info') {
          if (body.account === account.address && ++accountReads > 1) {
            assert.notEqual(frontier, sendFixture.previous)
            throw new Error('resumed read observed the reconciled frontier')
          }
          return snapshot(frontier)
        }
        if (body.action === 'work_generate') return { work: sendFixture.work }
        if (body.action === 'process') {
          if (body.block.account !== account.address) return processReply(body)
          // The HTTP request can end while the node still owns the submitted block.
          finishProcessing = () => {
            frontier = n.hashBlock(body.block)
          }
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              'abort',
              () => reject(init.signal.reason),
              {
                once: true,
              },
            )
            began()
          })
        }
        assert.fail(`Unexpected RPC: ${body.action}`)
      },
      { timeoutMs: failureMode === 'timeout' ? 40 : 15000 },
    )
    const firstFailure = client
      .send({
        account,
        to: other.address,
        amountRaw: '1',
        signal: controller.signal,
      })
      .catch((error) => error)
    await entered
    const queued = Promise.allSettled([
      client.send({ account, to: other.address, amountRaw: '2' }),
      client.receive({ account, hash: incoming[0].hash }),
      client.changeRepresentative({ account, representative: other.address }),
      client.receiveAll({ account }),
    ])
    if (failureMode === 'abort') controller.abort()
    const failure = await firstFailure
    assert.ok(failure instanceof n.TransactionError)
    assert.equal(
      failure.cause.name,
      failureMode === 'abort' ? 'AbortError' : 'TimeoutError',
    )
    for (const result of await queued) {
      assert.equal(result.status, 'rejected')
      assert.ok(result.reason instanceof n.AccountBlockedError)
      assert.equal(result.reason.cause, failure)
      assert.equal(result.reason.transaction.hash, failure.transaction.hash)
    }
    await assert.rejects(
      client.send({ account, to: other.address, amountRaw: '3' }),
      n.AccountBlockedError,
    )
    assert.equal(accountReads, 1)
    assert.equal(calls.filter((call) => call.action === 'process').length, 1)
    // Quarantining one account must not stop other accounts or independent reads.
    await client.send({ account: other, to: account.address, amountRaw: '1' })
    assert.ok(await client.getAccountInfo(other.address))
    assert.throws(() => client.resumeAccount(account.address, 'bad'), /hash/)
    assert.throws(
      () => client.resumeAccount(account.address, 'F'.repeat(64)),
      /matches/,
    )
    assert.throws(
      () => client.resumeAccount(other.address, failure.transaction.hash),
      /matches/,
    )
    finishProcessing()
    client.resumeAccount(
      account.address.replace('nano_', 'xrb_'),
      failure.transaction.hash.toLowerCase(),
    )
    await assert.rejects(
      client.send({ account, to: other.address, amountRaw: '3' }),
      (error) =>
        error.cause?.message ===
        'resumed read observed the reconciled frontier',
    )
    assert.equal(accountReads, 2)
    assert.equal(calls.filter((call) => call.action === 'process').length, 2)
  })
}
test('resuming immediately after failure never replays writes already queued', async () => {
  const { client, calls } = node((body) => {
    if (body.action === 'account_info') return snapshot()
    if (body.action === 'work_generate') return { work: sendFixture.work }
    return new Response('', { status: 503 })
  })
  const failed = client
    .send({ account, to: other.address, amountRaw: '1' })
    .catch((error) => {
      client.resumeAccount(account.address, error.transaction.hash)
    })
  const queued = Promise.allSettled(
    Array.from({ length: 10 }, () =>
      client.send({ account, to: other.address, amountRaw: '2' }),
    ),
  )
  await failed
  for (const result of await queued) {
    assert.equal(result.status, 'rejected')
    assert.ok(result.reason instanceof n.AccountBlockedError)
  }
  assert.equal(calls.filter((call) => call.action === 'process').length, 1)
})
test('failures before publication release the queue without blocking the account', async () => {
  let workRequests = 0
  const { client, calls } = node(
    (body) =>
      body.action === 'account_info' ? snapshot() : processReply(body),
    {
      work: () => {
        if (++workRequests === 1) throw new Error('work provider unavailable')
        return sendFixture.work
      },
    },
  )
  const first = assert.rejects(
    client.send({ account, to: other.address, amountRaw: '1' }),
    /work provider unavailable/,
  )
  const second = client.send({ account, to: other.address, amountRaw: '2' })
  await first
  assert.equal((await second).status, 'submitted')
  assert.equal(calls.filter((call) => call.action === 'process').length, 1)
})
test('receive validates confirmed source ownership and requires a chosen opening representative', async () => {
  let destination = account.publicKey
  let confirmed = true
  const { client, calls } = node((body) => {
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
  assert.equal(
    calls.some((call) => call.action === 'receivable'),
    false,
  )
})
for (const pruned of ['source', 'predecessor']) {
  test(`single receive works when the ${pruned} has been pruned`, async () => {
    const { client, calls } = node((body) => {
      if (body.action === 'account_info') return { error: 'Account not found' }
      if (body.action === 'block_info') {
        if (pruned === 'source') return { error: 'Block not found' }
        const { amount, ...retained } = blockInfo()
        return retained
      }
      if (body.action === 'receivable_exists')
        return pruned === 'source'
          ? { error: 'Block not found' }
          : { exists: '1' }
      if (body.action === 'receivable') {
        assert.equal(body.account, account.address)
        assert.equal(body.include_only_confirmed, true)
        return {
          blocks: {
            [incoming[0].hash]: { amount: '10', source: other.address },
          },
        }
      }
      if (body.action === 'work_generate') return { work: workFixtures[0].work }
      if (body.action === 'process') return processReply(body)
      assert.fail(body.action)
    })
    const result = await client.receive({
      account,
      hash: incoming[0].hash,
      representative: account.address,
    })
    assert.equal(result.status, 'submitted')
    assert.equal(result.hash, workFixtures[0].hash)
    assert.equal(result.block.balance, '10')
    assert.ok(n.verifyBlock(result.block))
    assert.equal(calls.filter((call) => call.action === 'process').length, 1)
  })
}
test('pruned receives reject absent, foreign and unconfirmed entries without publishing', async () => {
  for (const state of ['absent', 'foreign', 'unconfirmed']) {
    const { client, calls } = node((body) => {
      if (body.action === 'account_info') return { error: 'Account not found' }
      if (body.action === 'block_info' || body.action === 'receivable_exists')
        return { error: 'Block not found' }
      if (body.action === 'receivable') {
        const owner = state === 'foreign' ? other.address : account.address
        const exists = state !== 'absent'
        const confirmed = state !== 'unconfirmed'
        assert.equal(body.include_only_confirmed, true)
        return {
          blocks:
            exists && owner === body.account && confirmed
              ? { [incoming[0].hash]: { amount: '10', source: other.address } }
              : {},
        }
      }
      assert.fail('Invalid receives must stop before work or publication')
    })
    await assert.rejects(
      client.receive({
        account,
        hash: incoming[0].hash,
        representative: account.address,
      }),
      /confirmed, unreceived send/,
    )
    assert.equal(
      calls.some((call) => call.action === 'process'),
      false,
    )
  }
})
test('pruned receive lookup searches beyond the first page and compares hashes case-insensitively', async () => {
  const target = 'B'.repeat(64)
  const page = Object.fromEntries(
    Array.from({ length: 1000 }, (_, index) => [
      (index + 1).toString(16).padStart(64, '0'),
      { amount: '1', source: other.address },
    ]),
  )
  const { client, calls } = node((body) => {
    if (body.action === 'account_info') return { error: 'Account not found' }
    if (body.action === 'block_info' || body.action === 'receivable_exists')
      return { error: 'Block not found' }
    if (body.action === 'receivable') {
      assert.equal(body.count, '1000')
      return {
        blocks:
          body.offset === '1000'
            ? { [target]: { amount: '10', source: other.address } }
            : page,
      }
    }
    assert.fail(body.action)
  })
  const result = await client.prepareReceive({
    account: account.address,
    hash: target.toLowerCase(),
    representative: account.address,
  })
  assert.equal(result.block.link, target)
  assert.equal(result.block.balance, '10')
  assert.deepEqual(
    calls
      .filter((call) => call.action === 'receivable')
      .map((call) => call.offset ?? '0'),
    ['0', '1000'],
  )
  await assert.rejects(
    client.prepareReceive({
      account: account.address,
      hash: 'C'.repeat(64),
      representative: account.address,
    }),
    /confirmed, unreceived send/,
  )
})
test('pruned receive lookup propagates RPC failures and cancellation', async () => {
  for (const failure of ['permission', 'malformed', 'abort']) {
    const controller = new AbortController()
    const { client, calls } = node((body, init) => {
      if (body.action === 'account_info') return { error: 'Account not found' }
      if (body.action === 'block_info')
        return failure === 'permission'
          ? { error: 'Access denied' }
          : { error: 'Block not found' }
      if (body.action === 'receivable_exists') return { exists: '1' }
      if (body.action === 'receivable') {
        if (failure === 'malformed')
          return {
            blocks: {
              [incoming[0].hash]: { amount: null, source: other.address },
            },
          }
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(init.signal.reason),
            { once: true },
          )
          controller.abort()
        })
      }
      assert.fail(body.action)
    })
    await assert.rejects(
      client.prepareReceive({
        account: account.address,
        hash: incoming[0].hash,
        representative: account.address,
        signal: controller.signal,
      }),
      failure === 'abort' ? { name: 'AbortError' } : n.NanoRpcError,
    )
    if (failure === 'permission')
      assert.equal(
        calls.some((call) => call.action === 'receivable'),
        false,
      )
  }
})
test('confirmation polling accepts retained blocks with unavailable amounts', async () => {
  let reads = 0
  const { client } = node(() => {
    const { amount, ...block } = blockInfo(++reads > 1)
    return block
  })
  const block = await client.waitForConfirmation(incoming[0].hash, {
    pollIntervalMs: 1,
  })
  assert.equal(reads, 2)
  assert.equal(block.confirmed, true)
  assert.equal(block.amount, undefined)
  assert.equal(block.amountRaw, undefined)
  assert.equal(block.balanceRaw, '90')
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
  const batch = client.receiveAll({ account })
  const queued = assert.rejects(
    client.send({ account, to: other.address, amountRaw: '1' }),
    (error) => {
      assert.ok(error instanceof n.AccountBlockedError)
      assert.equal(error.transaction.hash, workFixtures[1].hash)
      return true
    },
  )
  await assert.rejects(batch, (error) => {
    assert.ok(error instanceof n.ReceiveAllError)
    assert.equal(error.completed.transactions.length, 1)
    assert.equal(error.completed.amountRaw, '10')
    assert.ok(error.cause instanceof n.TransactionError)
    assert.equal(error.cause.transaction.hash, workFixtures[1].hash)
    return true
  })
  await queued
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
