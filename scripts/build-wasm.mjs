import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

// Set NANOPAY_CLANG / NANOPAY_WASM_LD to use a specific LLVM installation.
const clang =
  process.env.NANOPAY_CLANG ||
  (existsSync('/opt/homebrew/opt/llvm/bin/clang')
    ? '/opt/homebrew/opt/llvm/bin/clang'
    : 'clang')
const linker =
  process.env.NANOPAY_WASM_LD ||
  (existsSync('/opt/homebrew/opt/lld/bin/wasm-ld')
    ? '/opt/homebrew/opt/lld/bin/wasm-ld'
    : 'wasm-ld')
mkdirSync('.build', { recursive: true })
execFileSync(
  clang,
  [
    '--target=wasm32',
    '-O3',
    '-flto',
    '-ffreestanding',
    '-mbulk-memory',
    '-DNATIVE_LITTLE_ENDIAN',
    '-Inative/include',
    '-c',
    'native/work.c',
    '-o',
    '.build/work.o',
  ],
  { stdio: 'inherit' },
)
execFileSync(
  linker,
  [
    '--no-entry',
    '--strip-all',
    '--export=work_batch',
    '--export=root_ptr',
    '--export=result_value',
    '--export-memory',
    '--initial-memory=131072',
    '--max-memory=131072',
    '-O3',
    '.build/work.o',
    '-o',
    'src/work.wasm',
  ],
  { stdio: 'inherit' },
)
rmSync('.build/work.o')
console.log('Built src/work.wasm from native/work.c')
