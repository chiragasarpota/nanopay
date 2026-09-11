import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

// Guides identify these values as application context. Each example is a
// module, so its own imports and declarations take precedence over this context.
const context = {
  nano: "import('nanopay').NanoClient",
  rpc: "import('nanopay').NanoRpcClient",
  account: "import('nanopay').Account",
  state: "import('nanopay').AccountInfo",
  address: 'string',
  recipientAddress: 'string',
  recipientA: 'string',
  recipientB: 'string',
  chosenRepresentative: 'string',
  incomingSendHash: 'string',
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory()
      ? walk(child)
      : child.endsWith('.md')
        ? [child]
        : []
  })
}
const output = resolve('.build/docs-examples')
mkdirSync(output, { recursive: true })
const files = []
const sources = new Map()
for (const markdown of walk('docs')) {
  const content = readFileSync(markdown, 'utf8')
  let index = 0
  for (const match of content.matchAll(/^```ts\s*\n([\s\S]*?)^```/gm)) {
    const file = resolve(output, `example-${files.length}.mts`)
    writeFileSync(file, `${match[1]}\nexport {}\n`)
    files.push(file)
    sources.set(file, `${markdown}, TypeScript example ${++index}`)
  }
}
assert.ok(files.length >= 30, 'Expected TypeScript documentation examples')
const contextPath = join(output, 'context.d.ts')
writeFileSync(
  contextPath,
  Object.entries(context)
    .map(([name, type]) => `declare const ${name}: ${type};`)
    .join('\n'),
)
const config = join(output, 'tsconfig.json')
writeFileSync(
  config,
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: ['node'],
        lib: ['ES2022', 'DOM'],
      },
      files: [contextPath, ...files],
    },
    null,
    2,
  ),
)
const require = createRequire(import.meta.url)
const compiler = join(
  dirname(require.resolve('typescript/package.json')),
  'bin/tsc',
)
try {
  execFileSync(process.execPath, [compiler, '--project', config], {
    stdio: 'pipe',
  })
  console.log(
    `Type-checked ${files.length} documentation examples against the built package.`,
  )
} catch (error) {
  console.error(error.stdout?.toString() ?? error.message)
  console.error(error.stderr?.toString() ?? '')
  for (const [file, source] of sources) {
    if (error.stdout?.toString().includes(file.split('/').at(-1)))
      console.error(`${file}: ${source}`)
  }
  process.exitCode = 1
}
