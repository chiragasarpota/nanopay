import { defineConfig } from 'vitepress'
import { readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'

const require = createRequire(import.meta.url)

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)
const pending = readFileSync(
  new URL('../../CHANGELOG.md', import.meta.url),
  'utf8',
).includes(`## ${pkg.version} — Unreleased`)
const base = process.env.DOCS_BASE ?? '/nanopay/'
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error('DOCS_BASE must start and end with /')
}

export default defineConfig({
  title: 'nanopay',
  description:
    'Build with Nano. Detailed JavaScript and TypeScript guides for accounts, payments, signing, proof of work and RPC.',
  lang: 'en-US',
  base,
  srcDir: '../docs',
  outDir: '../.build/docs',
  cacheDir: '../.build/docs-cache',
  cleanUrls: false,
  appearance: 'dark',
  lastUpdated: true,
  buildEnd(config) {
    copyFileSync(
      join(dirname(require.resolve('three')), '../LICENSE'),
      join(config.outDir, 'three-license.txt'),
    )
    copyFileSync(
      new URL('../../docs/benchmark-results.json', import.meta.url),
      join(config.outDir, 'benchmark-results.json'),
    )
    const licenses = ['geist', 'geist-mono'].map((font) => {
      const directory = dirname(
        require.resolve(`@fontsource-variable/${font}/package.json`),
      )
      return `${font}\n\n${readFileSync(join(directory, 'LICENSE'), 'utf8')}`
    })
    writeFileSync(
      join(config.outDir, 'font-licenses.txt'),
      licenses.join('\n\n'),
    )
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}mark.svg` }],
    ['meta', { name: 'theme-color', content: '#0a0a0a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'nanopay documentation' }],
  ],
  markdown: { lineNumbers: false },
  // Content lives outside the private site package; resolve Vue from this package.
  vite: {
    resolve: {
      alias: [
        {
          find: /^vue$/,
          replacement: require.resolve('vue/dist/vue.runtime.esm-bundler.js'),
        },
        {
          find: 'vue/server-renderer',
          replacement: require.resolve('vue/server-renderer'),
        },
      ],
    },
  },
  themeConfig: {
    siteTitle: 'nanopay',
    nav: [
      {
        text: 'Guides',
        link: '/getting-started',
        activeMatch: '/(getting-started|guides/)',
      },
      { text: 'API', link: '/api', activeMatch: '/api' },
      {
        text: `v${pkg.version}${pending ? ' preview' : ''}`,
        link: '/migration',
      },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Quick start', link: '/getting-started' },
          { text: 'Choose your node', link: '/guides/node-configuration' },
          { text: 'Runtime support', link: '/runtimes' },
        ],
      },
      {
        text: 'Build with Nano',
        items: [
          { text: 'Accounts & keys', link: '/guides/accounts' },
          { text: 'Mnemonics & recovery', link: '/guides/mnemonics' },
          { text: 'Amounts & validation', link: '/guides/amounts' },
          { text: 'Send & receive', link: '/guides/transactions' },
          { text: 'Confirmations & WebSockets', link: '/guides/confirmations' },
          { text: 'Payment links', link: '/guides/payment-links' },
        ],
      },
      {
        text: 'Take full control',
        items: [
          { text: 'Blocks & signing', link: '/guides/blocks' },
          { text: 'External signers', link: '/guides/external-signers' },
          { text: 'Proof of work', link: '/guides/work' },
          { text: 'RPC & pagination', link: '/guides/rpc' },
          { text: 'Errors & recovery', link: '/guides/errors' },
          { text: 'Application integration', link: '/guides/integration' },
        ],
      },
      {
        text: 'Reference & project',
        items: [
          { text: 'Complete API reference', link: '/api' },
          { text: 'Performance', link: '/performance' },
          { text: 'CLI', link: '/cli' },
          { text: 'Migration', link: '/migration' },
          { text: 'Testing', link: '/testing' },
          { text: 'Deployment', link: '/deployment' },
          { text: 'Publishing releases', link: '/releasing' },
        ],
      },
    ],
    outline: { level: [2, 3], label: 'On this page' },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/chiragasarpota/nanopay' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/nanopay' },
    ],
    editLink: {
      pattern: 'https://github.com/chiragasarpota/nanopay/edit/main/docs/:path',
      text: 'Improve this page',
    },
    footer: {
      message: `GPL-3.0-only · Based on nanocurrency-js. <a href="${base}font-licenses.txt">Font licenses</a>.`,
    },
  },
})
