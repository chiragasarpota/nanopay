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
await Promise.all([
  build({
    ...options,
    platform: 'neutral',
    format: 'esm',
    external: ['blakejs'],
    outfile: 'dist/index.js',
  }),
  build({
    ...options,
    platform: 'node',
    format: 'cjs',
    external: ['blakejs'],
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
    external: ['./index.js'],
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
