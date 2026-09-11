import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createClient,
  createRpcClient,
  NanoClient,
  NanoRpcClient,
  DEFAULT_RPC_URL,
} from '../dist/index.js'

test('omitted URLs use BerryPay only when an RPC operation is requested', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return Response.json({ node_vendor: 'Nano test fixture' })
  })
  const clients = [
    createClient(),
    createClient({}),
    new NanoClient(),
    createRpcClient(),
    new NanoRpcClient(),
  ]
  assert.equal(calls.length, 0)
  for (const client of clients) {
    assert.deepEqual(await client.request('version'), {
      node_vendor: 'Nano test fixture',
    })
  }
  assert.equal(DEFAULT_RPC_URL, 'https://xno-rpc.berrypay.org/proxy')
  assert.deepEqual(
    calls,
    clients.map(() => ({ url: DEFAULT_RPC_URL, body: { action: 'version' } })),
  )
})

test('default-node clients honor custom fetch, headers and cancellation', async () => {
  const calls = []
  const options = {
    headers: { 'x-application': 'test' },
    fetch: async (url, init) => {
      calls.push(url)
      assert.equal(init.headers.get('x-application'), 'test')
      return Response.json({ count: '42' })
    },
  }
  for (const client of [
    createClient(options),
    createRpcClient(undefined, options),
    new NanoClient(options),
    new NanoRpcClient(undefined, options),
  ]) {
    assert.deepEqual(await client.request('block_count'), { count: '42' })
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
      client.request('version', {}, { signal: controller.signal }),
      { name: 'AbortError' },
    )
  }
  assert.deepEqual(calls, Array(4).fill(DEFAULT_RPC_URL))
})

test('explicit endpoints never fall back to BerryPay, including after failures', async () => {
  const calls = []
  const url = 'https://private-node.example/rpc?network=dev'
  const options = {
    fetch: async (target) => {
      calls.push(target)
      throw new TypeError('Network unavailable')
    },
  }
  for (const client of [
    createClient({ ...options, rpcUrl: url }),
    createRpcClient(url, options),
    new NanoClient({ ...options, rpcUrl: url }),
    new NanoRpcClient(url, options),
  ]) {
    await assert.rejects(client.request('version'), (error) => {
      assert.equal(error.message, 'RPC request failed')
      assert.equal(error.cause.message, 'Network unavailable')
      return true
    })
  }
  assert.deepEqual(calls, Array(4).fill(url))
  for (const invalid of ['', 'not a URL', 'file:///tmp/node', null]) {
    assert.throws(() => createClient({ rpcUrl: invalid }))
    assert.throws(() => createRpcClient(invalid))
  }
})
