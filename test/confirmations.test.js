import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as n from '../dist/index.js'
const account = n.accountFromSeed('0'.repeat(64))
class Socket extends EventTarget {
  sent = []
  closed = false
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
  }
  message(data) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(data) }),
    )
  }
  open() {
    this.dispatchEvent(new Event('open'))
  }
  ack() {
    this.message({ ack: 'subscribe', id: 'nanopay-confirmations' })
  }
  confirm(hash = '1'.repeat(64)) {
    this.message({
      topic: 'confirmation',
      message: {
        hash,
        account: account.address,
        amount: '1',
        confirmation_type: 'active_quorum',
        block: { type: 'state' },
      },
    })
  }
}
function stream(options = {}) {
  const socket = new Socket()
  const iterator = n.watchConfirmations('wss://node.example', {
    ...options,
    webSocket: () => socket,
  })
  return { socket, iterator }
}
test('confirmation streams subscribe with account filters and clean up on break', async () => {
  const { socket, iterator } = stream({ accounts: [account.address] })
  const event = iterator.next()
  socket.open()
  socket.ack()
  socket.confirm()
  const result = await event
  assert.equal(result.value.amountRaw, '1')
  assert.equal(result.value.amount, n.rawToNano('1'))
  assert.deepEqual(socket.sent[0].options, {
    accounts: [account.address],
    include_block: true,
  })
  await iterator.return()
  assert.equal(socket.closed, true)
})
test('unfiltered streams omit options, abort pending reads and close the socket', async () => {
  const controller = new AbortController()
  const { socket, iterator } = stream({ signal: controller.signal })
  const event = iterator.next()
  socket.open()
  socket.ack()
  assert.equal(Object.hasOwn(socket.sent[0], 'options'), false)
  controller.abort()
  await assert.rejects(event, { name: 'AbortError' })
  assert.equal(socket.closed, true)
})
test('stream failures are explicit on overflow, malformed notifications, timeout and disconnect', async () => {
  for (const mode of ['overflow', 'malformed', 'disconnect', 'timeout']) {
    const { socket, iterator } = stream({ bufferSize: 1, timeoutMs: 10 })
    const event = iterator.next()
    socket.open()
    if (mode !== 'timeout') socket.ack()
    if (mode === 'overflow') {
      socket.confirm()
      socket.confirm()
    }
    if (mode === 'malformed')
      socket.message({ topic: 'confirmation', message: {} })
    if (mode === 'disconnect') socket.dispatchEvent(new Event('close'))
    await assert.rejects(event)
    assert.equal(socket.closed, true)
  }
  await assert.rejects(stream({ accounts: [] }).iterator.next(), /empty filter/)
})
