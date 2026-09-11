import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createDocsServer } from './docs-server.mjs'

for (const base of ['/nanopay/', '/']) {
  test(`preview serves rebuilt HTML and new hashed assets at ${base}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'nanopay-docs-preview-'))
    const server = createDocsServer({ root, base })
    try {
      await mkdir(join(root, 'assets'))
      await writeFile(
        join(root, 'index.html'),
        '<script src="assets/old.js"></script>',
      )
      await writeFile(join(root, 'assets/old.js'), 'window.oldBuild = true')
      await new Promise((done) => server.listen(0, '127.0.0.1', done))
      const url = `http://127.0.0.1:${server.address().port}${base}`
      const first = await fetch(url)
      assert.match(await first.text(), /old.js/)
      assert.equal(first.headers.get('cache-control'), 'no-store')

      // Reproduce a build replacing files without restarting the preview.
      const html = '<script src="assets/new.js"></script>'
      await writeFile(join(root, 'index.html'), html)
      await writeFile(join(root, 'assets/new.js'), 'window.newBuild = true')
      await rm(join(root, 'assets/old.js'))
      const refreshed = await fetch(url, {
        headers: {
          'If-None-Match': 'W/"previous-build"',
          'If-Modified-Since': new Date(Date.now() + 60_000).toUTCString(),
        },
      })
      assert.equal(refreshed.status, 200)
      assert.equal(await refreshed.text(), html)
      const asset = await fetch(url + 'assets/new.js')
      assert.equal(asset.status, 200)
      assert.match(asset.headers.get('content-type'), /^text\/javascript/)
      assert.equal(await asset.text(), 'window.newBuild = true')
      assert.equal((await fetch(url + 'assets/old.js')).status, 404)
      const head = await fetch(url, { method: 'HEAD' })
      assert.equal(head.status, 200)
      assert.equal(
        Number(head.headers.get('content-length')),
        Buffer.byteLength(html),
      )
      assert.equal(await head.text(), '')
    } finally {
      await new Promise((done) => server.close(done))
      await rm(root, { recursive: true, force: true })
    }
  })
}
