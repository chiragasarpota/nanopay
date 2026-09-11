import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

// Preview builds can change while this server is running. Read files on every
// request so refreshed HTML and newly hashed assets always come from disk.
export function createDocsServer({ root, base = '/nanopay/' }) {
  root = resolve(root)
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('DOCS_BASE must start and end with /')
  }
  return createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      )
    } catch {
      res.writeHead(400).end()
      return
    }
    if (base !== '/' && pathname === base.slice(0, -1)) {
      res.writeHead(302, { Location: base }).end()
      return
    }
    if (!pathname.startsWith(base) || pathname.includes('\0')) {
      res.writeHead(404).end()
      return
    }
    const path = resolve(
      root,
      pathname.slice(base.length) +
        (pathname.endsWith('/') ? 'index.html' : ''),
    )
    if (!path.startsWith(root + sep)) {
      res.writeHead(404).end()
      return
    }
    try {
      const data = await readFile(path)
      res.writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
        'Content-Length': data.length,
      })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch (error) {
      const missing = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)
      res.writeHead(missing ? 404 : 500).end()
    }
  })
}
