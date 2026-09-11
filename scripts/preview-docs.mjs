import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createDocsServer } from './docs-server.mjs'

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '4173' },
  },
})
const port = Number(values.port)
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('--port must be an integer between 0 and 65535')
}
const root = fileURLToPath(new URL('../.build/docs/', import.meta.url))
await access(new URL('../.build/docs/index.html', import.meta.url)).catch(
  () => {
    throw new Error('Build the documentation first: npm run docs:build')
  },
)
const base = process.env.DOCS_BASE ?? '/nanopay/'
const server = createDocsServer({ root, base })
server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
server.listen(port, values.host, () => {
  const host = values.host.includes(':') ? `[${values.host}]` : values.host
  console.log(`Docs preview: http://${host}:${server.address().port}${base}`)
  console.log('Refresh after rebuilding to load the latest documentation.')
})
