// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/legacy.cjs')
const {
  INVALID_HASHES,
  INVALID_SECRET_KEYS,
  INVALID_PUBLIC_KEYS,
  INVALID_SIGNATURES,
} = require('./data/invalid.cjs')

const VALID_BLOCKS = require('./data/valid_blocks.json')
const RANDOM_VALID_BLOCK = VALID_BLOCKS[0]

const INVALID_SIGNATURE =
  '8029FCD2F48C685296E525392898D5022260F10D19B0D6AAF435D9ED9FC2A41D91933A4BC99CDEE48AD40D363ED81BCDB68871A212CF26F65AD24CC8F4234795'

describe('sign', () => {
  test('signs correctly', () => {
    for (let block of VALID_BLOCKS) {
      expect(
        nano.signBlock({ hash: block.block.hash, secretKey: block.secretKey }),
      ).toBe(block.block.data.signature)
    }
  })

  test('throws with invalid hashes', () => {
    for (let invalidHash of INVALID_HASHES) {
      expect(() =>
        nano.signBlock({
          hash: invalidHash,
          secretKey: RANDOM_VALID_BLOCK.secretKey,
        }),
      ).toThrow('Hash is not valid')
    }
  })

  test('throws with invalid secret keys', () => {
    for (let invalidSecretKey of INVALID_SECRET_KEYS) {
      expect(() =>
        nano.signBlock({
          hash: RANDOM_VALID_BLOCK.block.hash,
          secretKey: invalidSecretKey,
        }),
      ).toThrow('Secret key is not valid')
    }
  })
})

describe('verify', () => {
  test('validates correct signature', () => {
    for (let block of VALID_BLOCKS) {
      expect(
        nano.verifyBlock({
          hash: block.block.hash,
          signature: block.block.data.signature,
          publicKey: block.publicKey,
        }),
      ).toBe(true)
    }
  })

  test('does not validate incorrect signature', () => {
    expect(
      nano.verifyBlock({
        hash: RANDOM_VALID_BLOCK.block.hash,
        signature: INVALID_SIGNATURE,
        publicKey: RANDOM_VALID_BLOCK.publicKey,
      }),
    ).toBe(false)
  })

  test('throws with invalid hashes', () => {
    for (let invalidHash of INVALID_HASHES) {
      expect(() =>
        nano.verifyBlock({
          hash: invalidHash,
          signature: RANDOM_VALID_BLOCK.block.signature,
          publicKey: RANDOM_VALID_BLOCK.publicKey,
        }),
      ).toThrow('Hash is not valid')
    }
  })

  test('throws with invalid signatures', () => {
    for (let invalidSignature of INVALID_SIGNATURES) {
      expect(() =>
        nano.verifyBlock({
          hash: RANDOM_VALID_BLOCK.block.hash,
          signature: invalidSignature,
          publicKey: RANDOM_VALID_BLOCK.publicKey,
        }),
      ).toThrow('Signature is not valid')
    }
  })

  test('throws with invalid public keys', () => {
    for (let invalidPublicKey of INVALID_PUBLIC_KEYS) {
      expect(() =>
        nano.verifyBlock({
          hash: RANDOM_VALID_BLOCK.block.hash,
          signature: RANDOM_VALID_BLOCK.block.data.signature,
          publicKey: invalidPublicKey,
        }),
      ).toThrow('Public key is not valid')
    }
  })
})
