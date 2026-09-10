import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const helper = new URL('../scripts/npm.mjs', import.meta.url).href
test('npm invocation runs a JavaScript CLI without shell interpretation of paths or arguments', () => {
  const temp = mkdtempSync(join(tmpdir(), 'nanopay npm & paths '))
  try {
    const dir = join(temp, 'npm cli')
    mkdirSync(dir)
    const cli = join(dir, 'npm-cli.js')
    writeFileSync(
      cli,
      'process.stdout.write(JSON.stringify({ node: process.execPath, args: process.argv.slice(2) }))',
    )
    const args = [
      'pack',
      join(temp, 'package name.tgz'),
      '& echo unintended',
      '"quoted"',
      '%PATH%',
      '$HOME',
      '--dry-run',
    ]
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { runNpm } from ${JSON.stringify(helper)}; process.stdout.write(runNpm(${JSON.stringify(args)}, { encoding: 'utf8' }))`,
      ],
      { encoding: 'utf8', env: { ...process.env, npm_execpath: cli } },
    )
    assert.deepEqual(JSON.parse(output), { node: process.execPath, args })
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
test('npm invocation gives a useful error outside an npm lifecycle or with another package manager', () => {
  for (const cli of ['', 'npm.cmd', join(tmpdir(), 'yarn.js')]) {
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import { runNpm } from ${JSON.stringify(helper)}; runNpm(['--version'])`,
          ],
          { stdio: 'pipe', env: { ...process.env, npm_execpath: cli } },
        ),
      (error) => {
        assert.match(error.stderr.toString(), /using npm run/)
        return true
      },
    )
  }
})
