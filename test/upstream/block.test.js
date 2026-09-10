// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/legacy.cjs')
const {
  INVALID_HASHES,
  INVALID_SECRET_KEYS,
  INVALID_AMOUNTS,
  INVALID_ADDRESSES,
  INVALID_HASHES_AND_ADDRESSES,
  INVALID_BLOCK_COMBINATIONS,
} = require('./data/invalid.cjs')

const VALID_STATE_BLOCKS = require('./data/valid_blocks.json')
const RANDOM_VALID_STATE_BLOCK = VALID_STATE_BLOCKS[0]

describe('state', () => {
  test('creates correct state block', async () => {
    for (let validStateBlock of VALID_STATE_BLOCKS) {
      const result = nano.createBlock(validStateBlock.secretKey, {
        work: validStateBlock.block.data.work,
        previous: validStateBlock.block.data.previous,
        representative: validStateBlock.block.data.representative,
        balance: validStateBlock.block.data.balance,
        link: validStateBlock.originalLink,
      })
      expect(result).toEqual({
        hash: validStateBlock.block.hash,
        block: {
          ...validStateBlock.block.data,
          account: validStateBlock.block.data.account.replace('xrb_', 'nano_'),
          link_as_account: validStateBlock.block.data.link_as_account.replace(
            'xrb_',
            'nano_',
          ),
        },
      })
    }
  })

  test('throws with invalid secret key', () => {
    for (let invalidSecretKey of INVALID_SECRET_KEYS) {
      expect(() => {
        nano.createBlock(invalidSecretKey, {
          work: RANDOM_VALID_STATE_BLOCK.block.data.work,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        })
      }).toThrow('Secret key is not valid')
    }
  })

  test('throws with unset work', () => {
    expect(() => {
      nano.createBlock(RANDOM_VALID_STATE_BLOCK.secretKey, {
        previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
        representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
        balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
        link: RANDOM_VALID_STATE_BLOCK.originalLink,
      })
    }).toThrow('Work is not set')
  })

  test('throws with invalid previous', () => {
    for (let invalidPrevious of INVALID_HASHES) {
      expect(() => {
        nano.createBlock(RANDOM_VALID_STATE_BLOCK.secretKey, {
          work: RANDOM_VALID_STATE_BLOCK.block.data.work,
          previous: invalidPrevious,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        })
      }).toThrow('Previous is not valid')
    }
  })

  test('throws with invalid previous', () => {
    for (let invalidRepresentative of INVALID_ADDRESSES) {
      expect(() => {
        nano.createBlock(RANDOM_VALID_STATE_BLOCK.secretKey, {
          work: RANDOM_VALID_STATE_BLOCK.block.data.work,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: invalidRepresentative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        })
      }).toThrow('Representative is not valid')
    }
  })

  test('throws with invalid balance', () => {
    for (let invalidBalance of INVALID_AMOUNTS) {
      expect(() => {
        nano.createBlock(RANDOM_VALID_STATE_BLOCK.secretKey, {
          work: RANDOM_VALID_STATE_BLOCK.block.data.work,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: invalidBalance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        })
      }).toThrow('Balance is not valid')
    }
  })

  test('throws with invalid link', () => {
    for (let invalidLink of INVALID_HASHES_AND_ADDRESSES) {
      expect(() => {
        nano.createBlock(RANDOM_VALID_STATE_BLOCK.secretKey, {
          work: RANDOM_VALID_STATE_BLOCK.block.data.work,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: invalidLink,
        })
      }).toThrow('Link is not valid')
    }
  })

  test('throws with invalid combination', () => {
    for (let invalidBlockCombination of INVALID_BLOCK_COMBINATIONS) {
      expect(() => {
        nano.createBlock(invalidBlockCombination.secretKey, {
          work: invalidBlockCombination.work,
          previous: invalidBlockCombination.previous,
          representative: invalidBlockCombination.representative,
          balance: invalidBlockCombination.balance,
          link: invalidBlockCombination.link,
        })
      }).toThrow('Block is impossible')
    }
  })
})
