import { fileURLToPath } from 'node:url'
import { build } from 'vitepress'

process.env.DOCS_BASE = '/'
await build(fileURLToPath(new URL('.', import.meta.url)))
