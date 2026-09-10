import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as api from '../dist/index.js'
test('the API reference lists every public runtime export', () => {
  const reference = readFileSync(
    new URL('../docs/api.md', import.meta.url),
    'utf8',
  )
  for (const name of Object.keys(api))
    assert.ok(reference.includes(name), `Undocumented public export: ${name}`)
})
