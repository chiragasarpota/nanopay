// Adapted from nanocurrency-js tests (GPL-3.0), 2026-09-10.
import { describe, test } from 'node:test'
import { expect } from 'expect'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const nano = require('../../dist/index.cjs')
const INVALID_NUMBERS = [12, '.01', '0.1.', '0..1', 'z']
const INVALID_UNITS = [12, '', 'nona', 'Kanano']

const VALID_CONVERSIONS = [
  {
    value: '1',
    from: 'Nano',
    to: 'raw',
    result: '1000000000000000000000000000000',
  },
  {
    value: '1',
    from: 'raw',
    to: 'Nano',
    result: '0.000000000000000000000000000001',
  },
  {
    value: '9',
    from: 'raw',
    to: 'MNano',
    result: '0.000000000000000000000000000000000009',
  },
  {
    value: '2000000000000000000000000000000',
    from: 'raw',
    to: 'Nano',
    result: '2',
  },
  {
    value: '3',
    from: 'nano',
    to: 'knano',
    result: '0.003',
  },
  {
    value: '3.3',
    from: 'nano',
    to: 'knano',
    result: '0.0033',
  },
  {
    value: '0',
    from: 'Nano',
    to: 'KNano',
    result: '0',
  },
  {
    value: '000.000',
    from: 'Nano',
    to: 'KNano',
    result: '0',
  },
  {
    value: '000.00900',
    from: 'KNano',
    to: 'Nano',
    result: '9',
  },
  {
    value: '10000000000000000000000000000000',
    from: 'raw',
    to: 'hex',
    result: '0000007e37be2022c0914b2680000000',
  },
  {
    value: '0000007e37be2022c0914b2680000000',
    from: 'hex',
    to: 'raw',
    result: '10000000000000000000000000000000',
  },
]

describe('conversion', () => {
  test('converts correctly', () => {
    for (let validConversion of VALID_CONVERSIONS) {
      expect(
        nano.convert(validConversion.value, {
          from: validConversion.from,
          to: validConversion.to,
        }),
      ).toBe(validConversion.result)
    }
  })

  test('throws with no explicit from and to units', () => {
    const errorMsg = 'From or to is not valid'
    expect(() => nano.convert('1')).toThrow(errorMsg)
    expect(() => nano.convert('1', { from: 'raw' })).toThrow(errorMsg)
    expect(() => nano.convert('1', { to: 'Nano' })).toThrow(errorMsg)
  })

  test('throws with invalid numbers', () => {
    for (let invalidNumber of INVALID_NUMBERS) {
      expect(() =>
        nano.convert(invalidNumber, { from: 'raw', to: 'Nano' }),
      ).toThrow('Value is not valid')
    }
  })

  test('throws with invalid hex', () => {
    expect(() =>
      nano.convert('0000007e37be2022c0914b268000000', {
        from: 'hex',
        to: 'Nano',
      }),
    ).toThrow('Value is not valid')
  })

  test('throws with invalid from unit', () => {
    for (let invalidUnit of INVALID_UNITS) {
      expect(() =>
        nano.convert('1', { from: invalidUnit, to: 'Nano' }),
      ).toThrow('From or to is not valid')
    }
  })

  test('throws with invalid to unit', () => {
    for (let invalidUnit of INVALID_UNITS) {
      expect(() =>
        nano.convert('1', { from: 'Nano', to: invalidUnit }),
      ).toThrow('From or to is not valid')
    }
  })
})
