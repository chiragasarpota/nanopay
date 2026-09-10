// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/index.cjs')
const {
  INVALID_SEEDS,
  INVALID_INDEXES,
  INVALID_SECRET_KEYS,
  INVALID_ADDRESSES,
  INVALID_PUBLIC_KEYS,
} = require('./data/invalid.cjs')

const VALID_KEYS = require('./data/valid_keys.json')
const RANDOM_VALID_KEY = VALID_KEYS[0]

describe('seeds', () => {
  test('generates different seeds', async () => {
    const seed1 = await nano.generateSeed()
    const seed2 = await nano.generateSeed()

    expect(nano.checkSeed(seed1)).toBe(true)
    expect(nano.checkSeed(seed2)).toBe(true)
    expect(seed1).not.toBe(seed2)
  })
})

describe('secret keys', () => {
  test('creates correct secret keys', () => {
    for (let key of VALID_KEYS) {
      expect(nano.deriveSecretKey(key.seed, key.index)).toBe(key.secretKey)
    }
  })

  test('throws with invalid seeds', () => {
    for (let invalidSeed of INVALID_SEEDS) {
      expect(() => nano.deriveSecretKey(invalidSeed, 0)).toThrow(
        'Seed is not valid',
      )
    }
  })

  test('throws with invalid indexes', () => {
    for (let invalidIndex of INVALID_INDEXES) {
      expect(() =>
        nano.deriveSecretKey(RANDOM_VALID_KEY.seed, invalidIndex),
      ).toThrow('Index is not valid')
    }
  })
})

describe('public keys', () => {
  test('creates correct public keys from secret keys', () => {
    for (let key of VALID_KEYS) {
      expect(nano.derivePublicKey(key.secretKey)).toBe(key.publicKey)
    }
  })

  test('creates correct public keys from addresses', () => {
    for (let key of VALID_KEYS) {
      expect(nano.derivePublicKey(key.account)).toBe(key.publicKey)
    }
  })

  test('throws with invalid secret keys', () => {
    for (let invalidSecretKey of INVALID_SECRET_KEYS) {
      expect(() => nano.derivePublicKey(invalidSecretKey)).toThrow(
        'Secret key or address is not valid',
      )
    }
  })

  test('throws with invalid addresses', () => {
    for (let invalidAddress of INVALID_ADDRESSES) {
      expect(() => nano.derivePublicKey(invalidAddress)).toThrow(
        'Secret key or address is not valid',
      )
    }
  })
})

describe('addresses', () => {
  test('creates correct addresses', () => {
    for (let key of VALID_KEYS) {
      expect(nano.deriveAddress(key.publicKey, { useNanoPrefix: false })).toBe(
        key.account,
      )
    }
  })

  test('creates correct addresses with nano prefix', () => {
    for (let key of VALID_KEYS) {
      expect(nano.deriveAddress(key.publicKey, { useNanoPrefix: true })).toBe(
        key.account.replace('xrb_', 'nano_'),
      )
    }
  })

  test('throws with invalid public keys', () => {
    for (let invalidPublicKey of INVALID_PUBLIC_KEYS) {
      expect(() => nano.deriveAddress(invalidPublicKey)).toThrow(
        'Public key is not valid',
      )
    }
  })
})
