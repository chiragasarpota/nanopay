import assert from 'node:assert/strict'
import {
  watchConfirmations,
  TransactionError,
  AccountBlockedError,
  verifyBlock,
  hashBlock,
} from '../../dist/index.js'

/** Exercise actual node acceptance, finality, WebSocket delivery and interrupted submissions. */
export async function runWorkflows({
  client,
  accounts: [first, second],
  representative,
  wsUrl,
  fault,
  record,
}) {
  const controller = new AbortController()
  const notifications = []
  let streamError
  let ready
  const subscribed = new Promise((resolve) => {
    ready = resolve
  })
  const iterator = watchConfirmations(wsUrl, {
    accounts: [first.address, second.address],
    signal: controller.signal,
    webSocket(url) {
      const socket = new WebSocket(url)
      socket.addEventListener('message', (event) => {
        try {
          const value = JSON.parse(event.data)
          if (
            value?.ack === 'subscribe' &&
            value.id === 'nanopay-confirmations'
          )
            ready()
        } catch {
          // The library's stream parser reports malformed messages.
        }
      })
      return socket
    },
  })
  const listening = (async () => {
    try {
      for await (const event of iterator) notifications.push(event)
    } catch (error) {
      if (!controller.signal.aborted) streamError = error
    }
  })()
  const settle = async (transaction) => {
    assert.ok(verifyBlock(transaction.block))
    assert.equal(hashBlock(transaction.block), transaction.hash.toUpperCase())
    record({
      event: 'submitted',
      hash: transaction.hash,
      subtype: transaction.subtype,
    })
    const block = await client.waitForConfirmation(transaction.hash, {
      timeoutMs: 120000,
      pollIntervalMs: 500,
    })
    assert.equal(block.confirmed, true)
    record({ event: 'confirmed', hash: transaction.hash })
    return transaction
  }
  try {
    await Promise.race([
      subscribed,
      new Promise((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error('WebSocket subscription did not acknowledge')),
          12000,
        )
        subscribed.then(() => clearTimeout(timer))
      }),
    ])
    const before = await client.getBalance(first.address)
    const total = BigInt(before.balanceRaw) + BigInt(before.receivableRaw)
    assert.ok(total >= 10n, 'Fund the dedicated test account before running')
    assert.ok(
      total <= 10n ** 24n,
      'Refusing to test with more than 0.000001 Nano',
    )
    const secondBefore = await client.getBalance(second.address)
    assert.equal(
      BigInt(secondBefore.balanceRaw) + BigInt(secondBefore.receivableRaw),
      0n,
    )

    const initial = await client.receiveAll({
      account: first,
      representative,
      maxBlocks: 10,
    })
    for (const transaction of initial.transactions) await settle(transaction)
    assert.equal(initial.hasMore, false)
    const sent = await Promise.all([
      client.send({ account: first, to: second.address, amountRaw: '1' }),
      client.send({ account: first, to: second.address, amountRaw: '2' }),
    ])
    for (const transaction of sent) await settle(transaction)
    assert.equal(
      sent[1].block.previous.toUpperCase(),
      sent[0].hash.toUpperCase(),
    )

    const partial = await client.receiveAll({
      account: second,
      representative,
      maxBlocks: 1,
    })
    assert.equal(partial.transactions.length, 1)
    assert.equal(partial.hasMore, true)
    await settle(partial.transactions[0])
    const remaining = await client.getReceivable(second.address)
    assert.equal(remaining.length, 1)
    await settle(
      await client.receive({ account: second, hash: remaining[0].hash }),
    )
    await settle(
      await client.changeRepresentative({
        account: second,
        representative: first.address,
      }),
    )

    for (const mode of ['disconnect', 'abort']) {
      const abort = new AbortController()
      fault.arm(mode, abort)
      const results = await Promise.allSettled([
        client.send({
          account: first,
          to: second.address,
          amountRaw: '1',
          signal: abort.signal,
        }),
        client.send({ account: first, to: second.address, amountRaw: '2' }),
      ])
      assert.equal(results[0].status, 'rejected')
      assert.ok(results[0].reason instanceof TransactionError)
      assert.equal(results[1].status, 'rejected')
      assert.ok(results[1].reason instanceof AccountBlockedError)
      assert.equal(
        fault.processCalls,
        1,
        'Queued writes must never reach process after an uncertain submission',
      )
      const candidate = results[0].reason.transaction
      assert.equal(candidate.hash, fault.acceptedHash.toUpperCase())
      await settle(candidate)
      client.resumeAccount(first.address, candidate.hash)
      record({ event: 'recovered', mode, hash: candidate.hash })
      fault.clear()
    }

    const received = await client.receiveAll({ account: second, maxBlocks: 10 })
    assert.equal(received.transactions.length, 2)
    for (const transaction of received.transactions) await settle(transaction)
    const balance = await client.getBalance(second.address)
    assert.equal(balance.balanceRaw, '5')
    await settle(
      await client.send({
        account: second,
        to: first.address,
        amountRaw: balance.balanceRaw,
      }),
    )
    const returned = await client.receiveAll({ account: first, maxBlocks: 10 })
    for (const transaction of returned.transactions) await settle(transaction)

    const final = await client.getBalances([first.address, second.address])
    assert.equal(final[first.address].balanceRaw, total.toString())
    assert.equal(final[first.address].receivableRaw, '0')
    assert.equal(final[second.address].balanceRaw, '0')
    assert.equal(final[second.address].receivableRaw, '0')
    const history = await client.getHistory(first.address, { count: 20 })
    assert.ok(
      history.entries.some(
        (entry) => entry.hash.toUpperCase() === sent[0].hash.toUpperCase(),
      ),
    )
    if (streamError) throw streamError
    assert.ok(
      notifications.some((event) => event.hash === sent[0].hash.toUpperCase()),
      'Actual send confirmation must arrive over WebSocket',
    )
    record({
      event: 'passed',
      balanceRaw: total.toString(),
      notifications: notifications.length,
      checks: [
        'send queue',
        'open',
        'receive',
        'bounded receiveAll',
        'representative change',
        'confirmation',
        'WebSocket',
        'disconnect recovery',
        'abort recovery',
        'funds returned',
      ],
    })
  } finally {
    controller.abort()
    await listening
  }
}

/** Forward real process requests, then discard an accepted response to simulate an uncertain connection. */
export function submissionFault(record) {
  let active
  const state = {
    processCalls: 0,
    acceptedHash: undefined,
    arm(mode, controller) {
      active = { mode, controller }
      state.processCalls = 0
      state.acceptedHash = undefined
    },
    clear() {
      active = undefined
    },
    async fetch(url, options) {
      const isProcess = JSON.parse(options.body).action === 'process'
      if (active && isProcess) state.processCalls++
      const response = await fetch(url, options)
      if (active && isProcess && !state.acceptedHash && response.ok) {
        const data = await response.clone().json()
        if (typeof data.hash === 'string') {
          state.acceptedHash = data.hash
          record({
            event: 'response-discarded-after-acceptance',
            mode: active.mode,
            hash: data.hash,
          })
          if (active.mode === 'abort')
            active.controller.abort(
              new DOMException(
                'Test cancellation after node acceptance',
                'AbortError',
              ),
            )
          throw new TypeError('Test disconnect after node acceptance')
        }
      }
      return response
    },
  }
  return state
}
