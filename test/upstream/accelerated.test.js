// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/legacy.cjs')
const { INVALID_HASHES } = require('./data/invalid.cjs')

const VALID_WORK = {
  hash: 'b9cb6b51b8eb869af085c4c03e7dc539943d0bdde13b21436b687c9c7ea56cb0',
  work: '0000000000010600',
}

describe('computeWork', () => {
  test('computes deterministic work', async () => {
    const result = await nano.computeWork(VALID_WORK.hash, {
      workThreshold: nano.LEGACY_WORK_THRESHOLD,
    })
    expect(result).toBe(VALID_WORK.work)
  })

  test('throws with invalid hashes', async () => {
    for (let invalidHash of INVALID_HASHES) {
      await expect(nano.computeWork(invalidHash)).rejects.toThrow(
        'Hash is not valid',
      )
    }
  })

  test('throws with invalid worker parameters', async () => {
    const INVALID_WORKER_PARAMETERS = [
      ['p', 1],
      [1.1, 1],
      [-1, 1],
      [0, 'p'],
      [0, 1.1],
      [0, -1],
      [1, 1],
    ]
    for (let invalidWorkerParameters of INVALID_WORKER_PARAMETERS) {
      await expect(
        nano.computeWork(VALID_WORK.hash, {
          workerIndex: invalidWorkerParameters[0],
          workerCount: invalidWorkerParameters[1],
        }),
      ).rejects.toThrow('Worker parameters are not valid')
    }
  })
})
