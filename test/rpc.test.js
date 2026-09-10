import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as nano from '../dist/legacy.js'

const address = nano.deriveWallet('0'.repeat(64)).address
const hash = 'a'.repeat(64)
const root = 'b9cb6b51b8eb869af085c4c03e7dc539943d0bdde13b21436b687c9c7ea56cb0'
function mock(response, options = {}) {
  const calls = []
  const client = nano.createRpcClient('https://node.example/rpc', {
    ...options,
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers })
      return typeof response === 'function'
        ? response(init)
        : Response.json(response)
    },
  })
  return { client, calls }
}

test('confirmed balances retain exact strings and use documented RPC fields', async () => {
  const { client, calls } = mock(
    { balance: '1250000000000000000000000000000', receivable: '1' },
    { headers: { authorization: 'Bearer example-test-value' } },
  )
  assert.deepEqual(await client.getBalance(address), {
    balance: '1.25',
    balanceRaw: '1250000000000000000000000000000',
    receivable: '0.000000000000000000000000000001',
    receivableRaw: '1',
  })
  assert.deepEqual(calls[0].body, {
    action: 'account_balance',
    account: address,
    include_only_confirmed: true,
  })
  assert.equal(calls[0].headers.get('content-type'), 'application/json')
  assert.equal(
    calls[0].headers.get('authorization'),
    'Bearer example-test-value',
  )
})
test('balance supports legacy pending response but rejects malformed amounts', async () => {
  assert.equal(
    (await mock({ balance: '0', pending: '2' }).client.getBalance(address))
      .receivableRaw,
    '2',
  )
  await assert.rejects(
    mock({ balance: 1, receivable: '0' }).client.getBalance(address),
    nano.NanoRpcError,
  )
  await assert.rejects(
    mock({ balance: '0' }).client.getBalance(address),
    nano.NanoRpcError,
  )
})
test('account info keeps current and confirmed balances distinct', async () => {
  const { client, calls } = mock({
    frontier: hash,
    balance: '5',
    representative: address,
    block_count: '2',
    confirmed_frontier: 'b'.repeat(64),
    confirmed_balance: '3',
    confirmed_height: '1',
  })
  const info = await client.getAccountInfo(address)
  assert.equal(info.balanceRaw, '5')
  assert.equal(info.confirmed.balanceRaw, '3')
  assert.deepEqual(calls[0].body, {
    action: 'account_info',
    account: address,
    representative: true,
    include_confirmed: true,
  })
  assert.equal(
    await mock({ error: 'Account not found' }).client.getAccountInfo(address),
    null,
  )
  await assert.rejects(
    mock({ error: 'RPC access denied' }).client.getAccountInfo(address),
    /RPC access denied/,
  )
})
test('receivable maps amounts and sources with confirmed-only defaults', async () => {
  const { client, calls } = mock({
    blocks: { [hash]: { amount: '1', source: address } },
  })
  assert.deepEqual(await client.getReceivable(address, { count: 20 }), [
    { hash, amount: nano.rawToNano('1'), amountRaw: '1', source: address },
  ])
  assert.deepEqual(calls[0].body, {
    action: 'receivable',
    account: address,
    count: '20',
    source: true,
    include_only_confirmed: true,
  })
  for (const blocks of ['', [], {}])
    assert.deepEqual(await mock({ blocks }).client.getReceivable(address), [])
})
test('history preserves pagination without rounding amounts', async () => {
  const { client, calls } = mock({
    history: [
      {
        type: 'receive',
        hash,
        amount: '1',
        account: address,
        local_timestamp: '100',
      },
    ],
    previous: hash,
  })
  const history = await client.getHistory(address, { count: 3, head: hash })
  assert.equal(history.entries[0].amountRaw, '1')
  assert.equal(history.entries[0].localTimestamp, '100')
  assert.equal(history.previous, hash)
  assert.equal(calls[0].body.head, hash)
  assert.deepEqual(await mock({ history: '' }).client.getHistory(address), {
    entries: [],
  })
})
test('receivable pagination forwards a validated offset', async () => {
  const { client, calls } = mock({ blocks: {} })
  await client.getReceivable(address, { count: 1000, offset: 1000 })
  assert.equal(calls[0].body.offset, '1000')
  assert.equal(calls[0].body.count, '1000')
  for (const offset of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(client.getReceivable(address, { offset }), /Offset/)
  assert.equal(calls.length, 1)
})
test('block info explicitly converts string confirmation status', async () => {
  const data = {
    block_account: address,
    amount: '1',
    balance: '3',
    confirmed: 'false',
    contents: { type: 'state' },
  }
  assert.equal((await mock(data).client.getBlock(hash)).confirmed, false)
  assert.equal(
    (await mock({ ...data, confirmed: 'true' }).client.getBlock(hash))
      .confirmed,
    true,
  )
  await assert.rejects(
    mock({ ...data, confirmed: 'unknown' }).client.getBlock(hash),
    /confirmation/,
  )
})
test('block info distinguishes unavailable amounts from zero and malformed values', async () => {
  const data = {
    block_account: address,
    balance: '3',
    confirmed: 'true',
    contents: { type: 'state', previous: '1'.repeat(64) },
  }
  const block = await mock(data).client.getBlock(hash)
  assert.equal(block.confirmed, true)
  assert.equal(block.balanceRaw, '3')
  assert.equal(Object.hasOwn(block, 'amount'), false)
  assert.equal(Object.hasOwn(block, 'amountRaw'), false)
  const zero = await mock({ ...data, amount: '0' }).client.getBlock(hash)
  assert.equal(zero.amount, '0')
  assert.equal(zero.amountRaw, '0')
  for (const amount of [null, 0, '-1', 'NaN'])
    await assert.rejects(
      mock({ ...data, amount }).client.getBlock(hash),
      nano.NanoRpcError,
    )
})
test('RPC work is independently validated before being returned', async () => {
  const { client, calls } = mock({ work: '0000000000010600' })
  assert.equal(
    await client.generateWork(root, { threshold: nano.LEGACY_WORK_THRESHOLD }),
    '0000000000010600',
  )
  assert.deepEqual(calls[0].body, {
    action: 'work_generate',
    hash: root,
    difficulty: nano.LEGACY_WORK_THRESHOLD,
    use_peers: true,
  })
  await assert.rejects(client.generateWork(root), /invalid proof of work/)
  await assert.rejects(
    mock({ work: 'bad' }).client.generateWork(root),
    /invalid proof of work/,
  )
})
test('publish sends a locally verified block with explicit subtype and never retries', async () => {
  const vectors = JSON.parse(
    readFileSync(new URL('./upstream/data/valid_blocks.json', import.meta.url)),
  )
  const block = vectors
    .map((v) => v.block.data)
    .find(
      (b) =>
        !/^0{64}$/.test(b.previous) &&
        nano.validateWork({ blockHash: b.previous, work: b.work }),
    )
  assert.ok(block, 'fixture contains modern send-threshold work')
  const expectedHash = nano.hashBlock(block)
  const { client, calls } = mock({ hash: expectedHash })
  assert.equal(await client.publishBlock(block, 'send'), expectedHash)
  assert.deepEqual(calls[0].body, {
    action: 'process',
    json_block: true,
    subtype: 'send',
    block,
  })
  await assert.rejects(
    client.publishBlock({ ...block, balance: '0' }, 'send'),
    /signature/,
  )
  assert.equal(calls.length, 1)
  await client.publishBlock(
    { ...block, privateKey: 'do-not-send-this-field' },
    'send',
  )
  assert.equal(Object.hasOwn(calls[1].body.block, 'privateKey'), false)
  const failed = mock({ error: 'Fork' })
  await assert.rejects(failed.client.publishBlock(block, 'send'), /Fork/)
  assert.equal(failed.calls.length, 1)
  await assert.rejects(
    mock({ hash: 'f'.repeat(64) }).client.publishBlock(block, 'send'),
    /different block hash/,
  )
})
test('HTTP, JSON and node errors are actionable and carry the RPC action', async () => {
  for (const response of [
    () => new Response('', { status: 503 }),
    () => new Response('not json'),
    { error: 'Bad account number' },
    [],
  ]) {
    await assert.rejects(
      mock(response).client.getBalance(address),
      (error) =>
        error instanceof nano.NanoRpcError &&
        error.action === 'account_balance',
    )
  }
})
test('timeouts and caller cancellation propagate and clear pending work', async () => {
  const fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason)
      else
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        })
    })
  const client = nano.createRpcClient('https://node.example', {
    fetch,
    timeoutMs: 10,
  })
  await assert.rejects(client.getBalance(address), { name: 'TimeoutError' })
  await assert.rejects(
    client.getBalance(address, { signal: AbortSignal.abort() }),
    { name: 'AbortError' },
  )
  const controller = new AbortController()
  const pending = client.getBalance(address, { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
test('invalid inputs fail before any network request', async () => {
  const { client, calls } = mock({})
  await assert.rejects(client.getBalance('bad'))
  await assert.rejects(client.getReceivable(address, { count: 0 }))
  await assert.rejects(client.getHistory(address, { head: 'bad' }))
  await assert.rejects(client.getBlock('bad'))
  await assert.rejects(client.publishBlock({}, 'unknown'))
  assert.equal(calls.length, 0)
  assert.throws(() => nano.createRpcClient('file:///tmp/node'))
  assert.throws(() =>
    nano.createRpcClient('https://node.example', { timeoutMs: Infinity }),
  )
})
test('concurrent RPC calls have separate bodies and cancellation signals', async () => {
  const calls = []
  const client = nano.createRpcClient('https://node.example', {
    fetch: async (_url, init) => {
      calls.push(init)
      const { value } = JSON.parse(init.body)
      await new Promise((resolve) => setTimeout(resolve, 1))
      return Response.json({ value })
    },
  })
  const replies = await Promise.all(
    Array.from({ length: 20 }, (_, value) =>
      client.request('version', { value }),
    ),
  )
  assert.deepEqual(
    replies.map((v) => v.value),
    Array.from({ length: 20 }, (_, i) => i),
  )
  assert.equal(new Set(calls.map((call) => call.signal)).size, 20)
  assert.equal(
    (await mock({ ok: true }).client.request('version', { action: 'stop' })).ok,
    true,
  )
})
