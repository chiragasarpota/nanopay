import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import * as root from 'nanopay'
import * as rpc from 'nanopay/rpc'
import * as legacy from 'nanopay/legacy'

const require = createRequire(import.meta.url)
for (const [format, main, focused, compatible] of [
  ['ESM', root, rpc, legacy],
  [
    'CommonJS',
    require('nanopay'),
    require('nanopay/rpc'),
    require('nanopay/legacy'),
  ],
]) {
  test(`${format} entry points share client and error constructors`, async () => {
    for (const name of [
      'NanoRpcClient',
      'NanoRpcError',
      'NanoClient',
      'TransactionError',
      'AccountBlockedError',
      'ReceiveAllError',
    ]) {
      assert.equal(main[name], focused[name], `${name} must have one identity`)
      if (name in compatible) assert.equal(main[name], compatible[name])
    }
    const client = focused.createClient({
      rpcUrl: 'https://node.example',
      fetch: async () => Response.json({ error: 'Fork' }),
    })
    assert.ok(client instanceof main.NanoClient)
    assert.ok(client instanceof main.NanoRpcClient)
    await assert.rejects(client.request('process'), main.NanoRpcError)
    const failure = new focused.TransactionError(
      { hash: '0'.repeat(64) },
      new Error('Disconnected'),
    )
    assert.ok(failure instanceof main.TransactionError)
    assert.ok(
      new focused.AccountBlockedError(failure) instanceof
        main.AccountBlockedError,
    )
    assert.ok(
      new focused.ReceiveAllError({ transactions: [] }, failure) instanceof
        main.ReceiveAllError,
    )
  })
}
