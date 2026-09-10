import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as nano from '../dist/legacy.js'
const wallet = nano.deriveWallet('0'.repeat(64))
const params = {
  privateKey: wallet.privateKey,
  representative: wallet.address,
  balanceRaw: nano.nanoToRaw('2'),
  previous: '1'.repeat(64),
}
function assertSigned(result) {
  assert.equal(nano.hashBlock(result.block), result.hash)
  assert.equal(
    nano.verifyBlock({
      hash: result.hash,
      signature: result.block.signature,
      publicKey: wallet.publicKey,
    }),
    true,
  )
}
test('send builder subtracts an exact Nano amount and signs locally', () => {
  const result = nano.createSendBlock({
    ...params,
    to: wallet.address,
    amount: '0.125',
  })
  assert.equal(result.block.balance, nano.nanoToRaw('1.875'))
  assert.equal(result.block.link, wallet.publicKey)
  assert.equal(result.block.work, null)
  assertSigned(result)
})
test('send builder rejects zero, insufficient funds and non-address destinations', () => {
  for (const amount of ['0', '3'])
    assert.throws(() =>
      nano.createSendBlock({ ...params, to: wallet.address, amount }),
    )
  assert.throws(
    () => nano.createSendBlock({ ...params, to: '1'.repeat(64), amount: '1' }),
    /Destination/,
  )
})
test('receive and open builders add raw exactly and enforce opening balance', () => {
  const result = nano.createReceiveBlock({
    ...params,
    sourceHash: '2'.repeat(64),
    amountRaw: '1',
  })
  assert.equal(
    result.block.balance,
    (BigInt(params.balanceRaw) + 1n).toString(),
  )
  assertSigned(result)
  const opened = nano.createReceiveBlock({
    ...params,
    previous: null,
    balanceRaw: '0',
    sourceHash: '2'.repeat(64),
    amountRaw: '1',
  })
  assert.equal(opened.block.previous, '0'.repeat(64))
  assertSigned(opened)
  assert.throws(
    () =>
      nano.createReceiveBlock({
        ...params,
        previous: null,
        sourceHash: '2'.repeat(64),
        amountRaw: '1',
      }),
    /zero current balance/,
  )
  assert.throws(
    () =>
      nano.createReceiveBlock({
        ...params,
        balanceRaw: ((1n << 128n) - 1n).toString(),
        sourceHash: '2'.repeat(64),
        amountRaw: '1',
      }),
    /Balance/,
  )
})
test('change builder leaves the raw balance unchanged', () => {
  const result = nano.createChangeBlock(params)
  assert.equal(result.block.balance, params.balanceRaw)
  assert.equal(result.block.link, '0'.repeat(64))
  assertSigned(result)
})
