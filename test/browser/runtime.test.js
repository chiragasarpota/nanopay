import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { build } from 'esbuild'

test(
  'browser bundle, bundled ESM and Web Workers support keys, signing and WASM',
  { timeout: 30000 },
  async () => {
    const esm = await build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      loader: { '.wasm': 'binary' },
      write: false,
    })
    const server = createServer((req, res) => {
      res.setHeader(
        'content-type',
        req.url === '/' ? 'text/html' : 'text/javascript',
      )
      if (req.url === '/')
        res.end('<!doctype html><title>nanopay browser tests</title>')
      else if (req.url === '/module.js') res.end(esm.outputFiles[0].text)
      else if (req.url === '/nanopay.js')
        res.end(readFileSync('dist/nanopay.js'))
      else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    let browser
    try {
      browser = await chromium.launch({
        channel: existsSync(
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        )
          ? 'chrome'
          : undefined,
      })
      const page = await browser.newPage()
      const url = `http://127.0.0.1:${server.address().port}`
      await page.goto(url)
      await page.addScriptTag({ url: `${url}/nanopay.js` })
      const result = await page.evaluate(async () => {
        const nano = window.NanoPay
        const wallet = nano.createWallet().account()
        const hash = '1'.repeat(64)
        const signature = nano.signHash(hash, wallet.privateKey)
        const work = await nano.generateWork(hash, {
          threshold: 'f000000000000000',
          maxIterations: 10000,
        })
        const esm = await import('/module.js')
        return {
          addressValid: nano.isValidAddress(wallet.address),
          signatureValid: nano.verifyHash({
            hash,
            signature,
            publicKey: wallet.publicKey,
          }),
          workValid: nano.verifyWork({
            root: hash,
            work,
            threshold: 'f000000000000000',
          }),
          amount: esm.nanoToRaw('1.25'),
          mnemonicAddress: (
            await nano.walletFromMnemonic(
              'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade',
            )
          ).account().address,
          esmAddressValid: esm.isValidAddress(
            esm.accountFromSeed('0'.repeat(64)).address,
          ),
        }
      })
      assert.deepEqual(result, {
        addressValid: true,
        signatureValid: true,
        workValid: true,
        amount: '1250000000000000000000000000000',
        mnemonicAddress:
          'nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr',
        esmAddressValid: true,
      })
      const work = await page.evaluate(
        (url) =>
          new Promise((resolve, reject) => {
            const source = `importScripts(${JSON.stringify(url + '/nanopay.js')}); NanoPay.generateWork('b9cb6b51b8eb869af085c4c03e7dc539943d0bdde13b21436b687c9c7ea56cb0', { threshold: NanoPay.LEGACY_WORK_THRESHOLD }).then(work => postMessage(work));`
            const blob = URL.createObjectURL(
              new Blob([source], { type: 'text/javascript' }),
            )
            const worker = new Worker(blob)
            const done = () => {
              worker.terminate()
              URL.revokeObjectURL(blob)
            }
            worker.onmessage = (event) => {
              done()
              resolve(event.data)
            }
            worker.onerror = (error) => {
              done()
              reject(new Error(error.message))
            }
          }),
        url,
      )
      assert.equal(work, '0000000000010600')
    } finally {
      await browser?.close()
      await new Promise((resolve) => server.close(resolve))
    }
  },
)
