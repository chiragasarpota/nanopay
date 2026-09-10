import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runNpm } from './npm.mjs'

// This root commit contains the exact 0.0.1 package, independent of current sources.
const commit = 'e059de2264777282a3f22632c1ad78fa3a354ad8'
const dryRun = process.argv.slice(2).includes('--dry-run')
if (process.argv.slice(2).some((arg) => arg !== '--dry-run'))
  throw new Error(
    'Only --dry-run is supported; npm handles interactive authentication.',
  )
if (!dryRun) {
  const user = runNpm(['whoami', '--registry=https://registry.npmjs.org'], {
    encoding: 'utf8',
  }).trim()
  if (user !== 'chiragasarpota')
    throw new Error('Log in to npm as chiragasarpota before publishing.')
}
const temp = mkdtempSync(join(tmpdir(), 'nanopay-bootstrap-'))
try {
  const archive = execFileSync('git', ['archive', '--format=tar', commit])
  execFileSync('tar', ['-xf', '-', '-C', temp], { input: archive })
  runNpm(
    [
      'publish',
      temp,
      '--access=public',
      '--tag=latest',
      '--registry=https://registry.npmjs.org',
      ...(dryRun ? ['--dry-run'] : []),
    ],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(temp, { recursive: true, force: true })
}
