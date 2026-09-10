// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/index.cjs')
const {
  INVALID_HASHES,
  INVALID_ADDRESSES,
  INVALID_HASHES_AND_ADDRESSES,
  INVALID_AMOUNTS,
} = require('./data/invalid.cjs')

const VALID_STATE_BLOCKS = require('./data/valid_blocks.json')
const RANDOM_VALID_STATE_BLOCK = VALID_STATE_BLOCKS[0]

describe('state', () => {
  test('creates correct state hash', () => {
    for (let validStateBlock of VALID_STATE_BLOCKS) {
      expect(
        nano.hashBlock({
          account: validStateBlock.block.data.account,
          previous: validStateBlock.block.data.previous,
          representative: validStateBlock.block.data.representative,
          balance: validStateBlock.block.data.balance,
          link: validStateBlock.originalLink,
        }),
      ).toBe(validStateBlock.block.hash)
    }
  })

  test('throws with invalid account', () => {
    for (let invalidAddress of INVALID_ADDRESSES) {
      expect(() =>
        nano.hashBlock({
          account: invalidAddress,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        }),
      ).toThrow('Account is not valid')
    }
  })

  test('throws with invalid previous', () => {
    for (let invalidHash of INVALID_HASHES) {
      expect(() =>
        nano.hashBlock({
          account: RANDOM_VALID_STATE_BLOCK.block.data.account,
          previous: invalidHash,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        }),
      ).toThrow('Previous is not valid')
    }
  })

  test('throws with invalid representative', () => {
    for (let invalidAddress of INVALID_ADDRESSES) {
      expect(() =>
        nano.hashBlock({
          account: RANDOM_VALID_STATE_BLOCK.block.data.account,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: invalidAddress,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        }),
      ).toThrow('Representative is not valid')
    }
  })

  test('throws with invalid balance', () => {
    for (let invalidAmount of INVALID_AMOUNTS) {
      expect(() =>
        nano.hashBlock({
          account: RANDOM_VALID_STATE_BLOCK.block.data.account,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: invalidAmount,
          link: RANDOM_VALID_STATE_BLOCK.originalLink,
        }),
      ).toThrow('Balance is not valid')
    }
  })

  test('throws with invalid link', () => {
    for (let invalidLink of INVALID_HASHES_AND_ADDRESSES) {
      expect(() =>
        nano.hashBlock({
          account: RANDOM_VALID_STATE_BLOCK.block.data.account,
          previous: RANDOM_VALID_STATE_BLOCK.block.data.previous,
          representative: RANDOM_VALID_STATE_BLOCK.block.data.representative,
          balance: RANDOM_VALID_STATE_BLOCK.block.data.balance,
          link: invalidLink,
        }),
      ).toThrow('Link is not valid')
    }
  })
})
