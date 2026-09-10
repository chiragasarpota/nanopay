import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import {
  readFileSync,
  rmSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  chmodSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'es2022',
  sourcemap: true,
  loader: { '.wasm': 'binary' },
  define: { __NANOPAY_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'inline',
  banner: {
    js: `/*! nanopay ${pkg.version}, GPL-3.0-only. Derived from nanocurrency-js; see LICENSE and NOTICE. */`,
  },
}
// Root and legacy consumers must use the same client/error constructors as /rpc.
// Reusing that entry point also works in CommonJS, where esbuild cannot split chunks.
function sharedRpc(format) {
  return {
    name: 'shared-rpc',
    setup(build) {
      build.onResolve({ filter: /^\.\/(rpc|client)\.js$/ }, () => ({
        path: format === 'esm' ? './rpc.js' : './rpc.cjs',
        external: true,
      }))
    },
  }
}
await Promise.all([
  ...Object.entries({
    keys: 'key-api',
    blocks: 'block-api',
    work: 'work-api',
    rpc: 'rpc-api',
    amounts: 'amount-api',
    mnemonic: 'mnemonic',
    payments: 'payment-uri',
    confirmations: 'confirmations',
  }).flatMap(([name, entry]) =>
    ['esm', 'cjs'].map((format) =>
      build({
        ...options,
        entryPoints: ['src/' + entry + '.ts'],
        platform: format === 'cjs' ? 'node' : 'neutral',
        format,
        external: ['blakejs'],
        outfile: 'dist/' + name + '.' + (format === 'esm' ? 'js' : 'cjs'),
      }),
    ),
  ),

  ...['esm', 'cjs'].map((format) =>
    build({
      ...options,
      entryPoints: ['src/legacy.ts'],
      platform: format === 'cjs' ? 'node' : 'neutral',
      format,
      external: ['blakejs'],
      plugins: [sharedRpc(format)],
      outfile: 'dist/legacy.' + (format === 'esm' ? 'js' : 'cjs'),
    }),
  ),
  build({
    ...options,
    platform: 'neutral',
    format: 'esm',
    external: ['blakejs'],
    plugins: [sharedRpc('esm')],
    outfile: 'dist/index.js',
  }),
  build({
    ...options,
    platform: 'node',
    format: 'cjs',
    external: ['blakejs'],
    plugins: [sharedRpc('cjs')],
    outfile: 'dist/index.cjs',
  }),
  build({
    ...options,
    platform: 'browser',
    format: 'iife',
    globalName: 'NanoPay',
    minify: true,
    outfile: 'dist/nanopay.js',
  }),
  build({
    ...options,
    platform: 'node',
    format: 'esm',
    entryPoints: ['src/cli.ts'],
    external: ['./legacy.js'],
    outfile: 'dist/cli.js',
  }),
])
execFileSync(
  process.execPath,
  [
    join(dirname(require.resolve('typescript/package.json')), 'bin/tsc'),
    '--emitDeclarationOnly',
  ],
  { stdio: 'inherit' },
)
cpSync('dist/types', 'dist/types-cjs', { recursive: true })
writeFileSync('dist/types-cjs/package.json', '{"type":"commonjs"}\n')
cpSync(
  join(dirname(require.resolve('blakejs/package.json')), 'LICENSE'),
  'dist/blakejs-LICENSE',
)
chmodSync('dist/cli.js', 0o755)

for (const [name, filename] of [
  ['@scure/bip39', 'scure-bip39'],
  ['@noble/hashes/sha2.js', 'noble-hashes'],
]) {
  cpSync(
    join(dirname(require.resolve(name)), 'LICENSE'),
    'dist/' + filename + '-LICENSE',
  )
}
