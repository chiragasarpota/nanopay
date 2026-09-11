import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { createDocsServer } from './docs-server.mjs'

const root = resolve('.build/docs')
const base = process.env.DOCS_BASE ?? '/nanopay/'
const artifacts = resolve('.build/docs-qa')
mkdirSync(artifacts, { recursive: true })
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}
const files = walk(root)
const pages = files.filter(
  (path) => path.endsWith('.html') && !path.endsWith('/404.html'),
)
assert.ok(pages.length >= 20, 'Expected the complete documentation site')
const server = createDocsServer({ root, base })
await new Promise((done) => server.listen(0, '127.0.0.1', done))
let browser
try {
  browser = await chromium.launch({
    channel: existsSync(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    )
      ? 'chrome'
      : undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const origin = `http://127.0.0.1:${server.address().port}`
  const failedResponses = []
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      failedResponses.push(response.url())
  })
  await page.goto(origin + base)
  await page
    .getByRole('heading', { name: 'Everything you need to build with Nano.' })
    .waitFor()
  // First visits default to dark, even when the operating system prefers light.
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(page.locator('.np-blocks-canvas')).toHaveClass(/is-ready/, {
    timeout: 30_000,
  })
  await page.screenshot({
    path: join(artifacts, 'home-desktop.png'),
    fullPage: true,
  })
  const landingExamples = [
    ['Send a payment', 'nano.send'],
    ['Receive funds', 'nano.receiveAll'],
    ['Derive your keys', 'derivePrivateKey'],
    ['Request a payment', 'createPaymentUri'],
    ['Watch confirmations', 'watchConfirmations'],
  ]
  for (const [title, functionName] of landingExamples) {
    await page.getByRole('tab', { name: new RegExp(title) }).click()
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
    await expect(page.getByRole('tabpanel')).toContainText(functionName)
  }
  const lastTab = page.getByRole('tab', { name: /Watch confirmations/ })
  await lastTab.press('Home')
  await expect(page.getByRole('tab', { name: /Send a payment/ })).toBeFocused()
  await page.getByRole('tab', { name: /Send a payment/ }).press('ArrowDown')
  await expect(page.getByRole('tab', { name: /Receive funds/ })).toBeFocused()
  await expect(page.getByRole('tabpanel')).toContainText('nano.receiveAll')
  await page.getByRole('button', { name: 'Copy code example' }).click()
  await expect(
    page.getByRole('button', { name: 'Copy code example' }),
  ).toContainText('Copied')
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    await page.getByRole('tabpanel').locator('pre code').textContent(),
    'Copy should use the selected example, without hidden panels or UI text',
  )
  await page.getByRole('button', { name: 'Copy install command' }).click()
  await expect(
    page.getByRole('button', { name: 'Copy install command' }),
  ).toContainText('Copied')
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'npm install nanopay',
  )
  await page.getByRole('tab', { name: /Send a payment/ }).click()
  await expect(page.getByRole('tabpanel')).toHaveCSS('opacity', '1')
  await expect(page.getByRole('tabpanel')).toHaveCSS('filter', 'blur(0px)')
  await page
    .locator('.np-examples')
    .screenshot({ path: join(artifacts, 'landing-code-tabs.png') })
  await page.getByRole('switch', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  await page.screenshot({
    path: join(artifacts, 'home-light.png'),
    fullPage: true,
  })

  const documents = pages.map((path) => ({
    url: origin + base + relative(root, path).split(sep).join('/'),
    html: readFileSync(path, 'utf8'),
  }))
  const broken = await page.evaluate(
    ({ documents, origin, assets }) => {
      const parsed = new Map(
        documents.map(({ url, html }) => [
          url,
          new DOMParser().parseFromString(html, 'text/html'),
        ]),
      )
      const failures = []
      for (const [url, doc] of parsed) {
        for (const anchor of doc.querySelectorAll('a[href]')) {
          const target = new URL(anchor.getAttribute('href'), url)
          if (target.origin !== origin) continue
          let pathname = target.pathname
          if (pathname.endsWith('/')) pathname += 'index.html'
          const destination = parsed.get(origin + pathname)
          if (!destination) {
            if (assets.includes(origin + pathname) && !target.hash) continue
            failures.push(`${new URL(url).pathname} → ${target.pathname}`)
            continue
          }
          if (
            target.hash &&
            !destination.getElementById(
              decodeURIComponent(target.hash.slice(1)),
            )
          ) {
            failures.push(
              `${new URL(url).pathname} → ${target.pathname}${target.hash}`,
            )
          }
        }
      }
      return [...new Set(failures)]
    },
    {
      documents,
      origin,
      assets: files.map(
        (path) => origin + base + relative(root, path).split(sep).join('/'),
      ),
    },
  )
  assert.deepEqual(broken, [], 'Broken documentation links or anchors')

  await page.getByRole('link', { name: 'Start building', exact: true }).click()
  await page.getByRole('heading', { name: /^Quick start/ }).waitFor()
  await page.screenshot({
    path: join(artifacts, 'guide-desktop.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Search' }).click()
  const search = page.getByRole('searchbox')
  await search.fill('resumeAccount')
  const result = page
    .locator('.VPLocalSearchBox a')
    .filter({ hasText: /recovery|RPC|reference/i })
    .first()
  await result.waitFor()
  await result.click()
  await page.locator('.VPLocalSearchBox').waitFor({ state: 'hidden' })
  assert.ok(
    /errors|api/.test(page.url()),
    'Search should navigate to a relevant result',
  )

  await page.goto(origin + base + 'api.html')
  await page.getByRole('heading', { name: /^Complete API reference/ }).waitFor()
  await page.screenshot({
    path: join(artifacts, 'api-desktop.png'),
    fullPage: true,
  })
  await page.getByRole('switch', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await page.screenshot({ path: join(artifacts, 'guide-dark.png') })

  const mobile = await context.newPage()
  await mobile.setViewportSize({ width: 390, height: 844 })
  mobile.on('pageerror', (error) => errors.push(error.message))
  await mobile.goto(origin + base + 'getting-started.html')
  await mobile.getByRole('button', { name: 'Menu', exact: true }).click()
  await mobile
    .getByRole('link', { name: 'Choose your node', exact: true })
    .click()
  await mobile.getByRole('heading', { name: /^Choose your node/ }).waitFor()
  const dimensions = await mobile.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  assert.ok(
    dimensions.content <= dimensions.width + 1,
    'Mobile page should not overflow horizontally',
  )
  await mobile.screenshot({
    path: join(artifacts, 'guide-mobile.png'),
  })
  await mobile.getByRole('button', { name: 'mobile navigation' }).click()
  await mobile.getByRole('switch', { name: 'Switch to light theme' }).click()
  await expect(mobile.locator('html')).not.toHaveClass(/\bdark\b/)
  await mobile.goto(origin + base)
  await expect(mobile.locator('html')).not.toHaveClass(/\bdark\b/)
  await mobile.getByRole('tab', { name: /Derive your keys/ }).click()
  await expect(mobile.getByRole('tabpanel')).toContainText('derivePrivateKey')
  await expect(
    mobile.getByRole('tablist', { name: 'Nano code examples' }),
  ).toHaveAttribute('aria-orientation', 'horizontal')
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'The landing page and its code tabs should fit on mobile',
  )
  await expect(mobile.getByRole('tabpanel')).toHaveCSS('opacity', '1')
  await expect(mobile.getByRole('tabpanel')).toHaveCSS('filter', 'blur(0px)')
  await mobile
    .locator('.np-examples')
    .screenshot({ path: join(artifacts, 'landing-code-mobile.png') })
  await mobile.evaluate(() => window.scrollTo(0, 0))
  await mobile.screenshot({ path: join(artifacts, 'home-mobile.png') })
  assert.deepEqual(errors, [], 'Browser runtime errors')
  assert.deepEqual(failedResponses, [], 'Missing site assets')
  console.log(
    `Docs verified: ${pages.length} pages; internal links, anchors, navigation, search, five code tabs, keyboard controls, clipboard, desktop/mobile, default dark mode and persisted theme switching. Screenshots: .build/docs-qa/`,
  )
} finally {
  await browser?.close()
  await new Promise((done) => server.close(done))
}
