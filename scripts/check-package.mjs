import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const temp = mkdtempSync(join(tmpdir(), 'nanopay-package-'))
try {
  const [packed] = JSON.parse(
    execFileSync(
      npm,
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temp],
      { encoding: 'utf8' },
    ),
  )
  const files = packed.files.map((file) => file.path)
  for (const file of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/cli.js',
    'dist/types/index.d.ts',
    'dist/types-cjs/package.json',
    'src/work.wasm',
    'native/work.c',
    'LICENSE',
    'NOTICE',
  ])
    assert.ok(files.includes(file), `Missing ${file}`)
  assert.ok(
    files.every(
      (file) =>
        !file.startsWith('node_modules/') &&
        !file.startsWith('.git/') &&
        !file.startsWith('.env'),
    ),
  )
  assert.ok(files.every((file) => !/^(test|coverage)\//.test(file)))
  writeFileSync(join(temp, 'package.json'), '{"private":true,"type":"module"}')
  execFileSync(
    npm,
    [
      'install',
      join(temp, packed.filename),
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
    { cwd: temp, stdio: 'pipe' },
  )
  for (const [extension, loader] of [
    ['mjs', "import * as nano from 'nanopay'"],
    ['cjs', "const nano = require('nanopay')"],
  ]) {
    const file = join(temp, `consumer.${extension}`)
    writeFileSync(
      file,
      `${loader}\nconst wallet = nano.deriveWallet('0'.repeat(64)); if (!nano.checkAddress(wallet.address) || nano.nanoToRaw('1') !== '1000000000000000000000000000000') throw new Error('Invalid package result'); nano.computeWork('0'.repeat(64), { workThreshold: '0000000000000000', maxIterations: 1 }).then(work => { if(work !== '0000000000000000') throw new Error('WASM missing'); });\n`,
    )
    execFileSync(process.execPath, [file], { cwd: temp, stdio: 'pipe' })
  }
  const ts = `import { deriveWallet, nanoToRaw, createRpcClient, createSendBlock, type Wallet } from 'nanopay';\nconst wallet: Wallet = deriveWallet('0'.repeat(64));\nconst amount: string = nanoToRaw('1.25');\ncreateRpcClient('https://node.example').getBalance(wallet.address).then(balance => balance.balanceRaw);\ncreateSendBlock({ privateKey: wallet.privateKey, representative: wallet.address, balanceRaw: amount, previous: '1'.repeat(64), to: wallet.address, amount: '1' });\n`
  writeFileSync(join(temp, 'consumer.mts'), ts)
  writeFileSync(join(temp, 'consumer.cts'), ts)
  writeFileSync(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: [],
        lib: ['ES2022', 'DOM'],
      },
      files: ['consumer.mts', 'consumer.cts'],
    }),
  )
  const tsc = join(
    dirname(require.resolve('typescript/package.json')),
    'bin/tsc',
  )
  execFileSync(
    process.execPath,
    [tsc, '--project', join(temp, 'tsconfig.json')],
    { cwd: temp, stdio: 'pipe' },
  )
  const cli = resolve(temp, 'node_modules/nanopay/dist/cli.js')
  assert.equal(
    execFileSync(
      process.execPath,
      [
        cli,
        'convert',
        'amount',
        '--input',
        '1',
        '--from',
        'NANO',
        '--to',
        'raw',
      ],
      { encoding: 'utf8' },
    ).trim(),
    '1000000000000000000000000000000',
  )
  assert.equal(
    execFileSync(process.execPath, [cli, '--version'], {
      encoding: 'utf8',
    }).trim(),
    JSON.parse(readFileSync('package.json', 'utf8')).version,
  )
  console.log(
    `Package verified: ${packed.files.length} files, ${packed.size} bytes; ESM, CJS, both declaration modes, CLI and WASM work after installation.`,
  )
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout)
  if (error.stderr) process.stderr.write(error.stderr)
  throw error
} finally {
  rmSync(temp, { recursive: true, force: true })
}
