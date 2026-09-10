import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runNpm } from './npm.mjs'

const require = createRequire(import.meta.url)
const temp = mkdtempSync(join(tmpdir(), 'nanopay-package-'))
try {
  const [packed] = JSON.parse(
    runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp], {
      encoding: 'utf8',
    }),
  )
  const files = packed.files.map((file) => file.path)
  for (const file of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/legacy.js',
    'dist/legacy.cjs',
    'dist/scure-bip39-LICENSE',
    'dist/noble-hashes-LICENSE',
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
  runNpm(
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
      `${loader}\nconst wallet = nano.accountFromSeed('0'.repeat(64)); if (!nano.isValidAddress(wallet.address) || nano.nanoToRaw('1') !== '1000000000000000000000000000000') throw new Error('Invalid package result'); nano.generateWork('0'.repeat(64), { threshold: '0000000000000000', maxIterations: 1 }).then(work => { if(work !== '0000000000000000') throw new Error('WASM missing'); });\n`,
    )
    execFileSync(process.execPath, [file], { cwd: temp, stdio: 'pipe' })
    const subpaths = [
      'keys',
      'blocks',
      'work',
      'rpc',
      'amounts',
      'mnemonic',
      'payments',
      'confirmations',
      'legacy',
    ]
    const imports = subpaths
      .map((name, index) =>
        extension === 'mjs'
          ? `import * as part${index} from 'nanopay/${name}';`
          : `const part${index} = require('nanopay/${name}');`,
      )
      .join('\n')
    const subpathFile = join(temp, `subpaths.${extension}`)
    writeFileSync(
      subpathFile,
      imports +
        `\nif (part0.derivePrivateKey('0'.repeat(64)) !== part8.deriveSecretKey('0'.repeat(64), 0)) throw new Error('Key entry point mismatch'); if (!part5.isValidMnemonic(part5.generateMnemonic())) throw new Error('Mnemonic entry point failure'); if (!part2.verifyWork({root:'0'.repeat(64),work:'0'.repeat(16),threshold:'0'.repeat(16)})) throw new Error('Work entry point failure');`,
    )
    execFileSync(process.execPath, [subpathFile], { cwd: temp, stdio: 'pipe' })
  }
  const identityTest = join(temp, 'entry-points.test.mjs')
  writeFileSync(identityTest, readFileSync('test/entry-points.test.js', 'utf8'))
  execFileSync(process.execPath, ['--test', identityTest], {
    cwd: temp,
    stdio: 'pipe',
  })
  const ts = `import { accountFromSeed, nanoToRaw, createRpcClient, createSendBlock, type Account } from 'nanopay';\nconst wallet: Account = accountFromSeed('0'.repeat(64));\nconst amount: string = nanoToRaw('1.25');\ncreateRpcClient('https://node.example').getBalance(wallet.address).then(balance => balance.balanceRaw);\ncreateSendBlock({ privateKey: wallet.privateKey, representative: wallet.address, balanceRaw: amount, previous: '1'.repeat(64), to: wallet.address, amount: '1' });\n`
  const typedWorkflows = `
import { createClient, createWallet, walletFromMnemonic, type Signer, buildSendBlock, signBlock, attachSignature, hashBlock, signHash } from 'nanopay';
import { derivePrivateKey } from 'nanopay/keys';
import { generateWork } from 'nanopay/work';
import { createClient as focusedClient } from 'nanopay/rpc';
const local = createWallet().account(1);
const external: Signer = { publicKey: local.publicKey, sign: hash => signHash(hash, local.privateKey) };
const client = createClient({ rpcUrl: 'https://node.example', work: async ({ root, threshold, signal }) => { const work = await generateWork(root, { threshold, signal }); if (work === null) throw new Error('exhausted'); return work } });
client.send({ account: external, to: local.address, amountRaw: '1' });
client.receiveAll({ account: local, representative: local.address });
client.resumeAccount(local.address, '1'.repeat(64));
client.getBlock('1'.repeat(64)).then(block => {
  const amount: string | undefined = block.amountRaw;
  // @ts-expect-error: a pruned predecessor makes the amount unavailable.
  const requiredAmount: string = block.amountRaw;
});
client.getReceivable(local.address, { count: 1000, offset: 1000 });
client.prepareSend({ account: local.address, to: local.address, amount: '1' });
walletFromMnemonic('example').then(wallet => wallet.account(1));
// @ts-expect-error: amount and amountRaw are mutually exclusive.
client.send({ account: local, to: local.address, amount: '1', amountRaw: '1' });
// @ts-expect-error: sending requires an explicit amount.
client.send({ account: local, to: local.address });
`
  writeFileSync(join(temp, 'consumer.mts'), ts + typedWorkflows)
  writeFileSync(join(temp, 'consumer.cts'), ts + typedWorkflows)
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
  assert.ok(
    !readFileSync(
      join(temp, 'node_modules/nanopay/dist/keys.js'),
      'utf8',
    ).includes('WebAssembly'),
  )
  assert.ok(
    !readFileSync(
      join(temp, 'node_modules/nanopay/dist/keys.js'),
      'utf8',
    ).includes('abandon'),
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
