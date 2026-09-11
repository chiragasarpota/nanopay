<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { withBase } from 'vitepress'
import LandingExamples from './LandingExamples.vue'
import LandingArtwork from './LandingArtwork.vue'
import '../landing.css'

const features = [
  {
    title: 'Accounts & keys',
    text: 'Create wallets, recover mnemonics, and derive every key and address yourself.',
    link: 'guides/accounts.html',
    icon: 'M8 15a5 5 0 1 1 3.8-8.2L21 7v4h-3v3h-4l-2.2-2.2M6.5 7.5h.01',
  },
  {
    title: 'Blocks & signatures',
    text: 'Build, hash, sign, and publish blocks. Bring your own signing device when you need to.',
    link: 'guides/blocks.html',
    icon: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9',
  },
  {
    title: 'Exact amounts',
    text: 'Convert between Nano and raw with strings and bigint. Keep every decimal place.',
    link: 'guides/amounts.html',
    icon: 'M4 8h16M4 16h16M8 4v16M16 4v16',
  },
  {
    title: 'Proof of work',
    text: 'Validate work locally. Generate it with WebAssembly, an RPC node, or your own service.',
    link: 'guides/work.html',
    icon: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  },
  {
    title: 'RPC & WebSockets',
    text: 'Read balances and history, page through receivables, and follow confirmations.',
    link: 'guides/rpc.html',
    icon: 'M3 12h4l3-8 4 16 3-8h4',
  },
  {
    title: 'Your application, your stack',
    text: 'Use typed ESM and CommonJS modules, browser bundles, Web Workers, and the CLI.',
    link: 'runtimes.html',
    icon: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  },
]
const resources = [
  {
    number: '01',
    title: 'Your first Nano integration',
    text: 'Install the package, connect a node, and work with an account.',
    link: 'getting-started.html',
    tag: 'Quick start',
  },
  {
    number: '02',
    title: 'Every function, explained',
    text: 'Find signatures, parameters, and examples for the complete API.',
    link: 'api.html',
    tag: 'API reference',
  },
  {
    number: '03',
    title: 'Build a payment workflow',
    text: 'Handle sends, receives, confirmations, and recovery in your app.',
    link: 'guides/integration.html',
    tag: 'Integration guide',
  },
]
const copied = ref(false)
const copyError = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))
async function copyInstall() {
  try {
    await navigator.clipboard.writeText('npm install nanopay')
    copied.value = true
    copyError.value = ''
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch {
    copyError.value = 'Select the command to copy it.'
  }
}
</script>

<template>
  <main class="np-landing">
    <div class="np-frame">
      <section class="np-hero" aria-labelledby="landing-title">
        <div class="np-hero-copy">
          <p class="np-eyebrow">Nano for developers</p>
          <h1 id="landing-title">
            Everything you need to <span>build with Nano.</span>
          </h1>
          <p class="np-lead">
            A JavaScript and TypeScript toolkit for Nano wallets, payments, and
            integrations.
          </p>
          <div class="np-actions">
            <a
              class="np-button np-primary"
              :href="withBase('/getting-started.html')"
              >Start building</a
            ><a class="np-button np-secondary" :href="withBase('/api.html')"
              >Explore the API</a
            >
          </div>
          <div class="np-install">
            <span aria-hidden="true">$</span><code>npm install nanopay</code
            ><button aria-label="Copy install command" @click="copyInstall">
              <svg
                v-if="!copied"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V4H4v12h4" /></svg
              ><svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" /></svg
              ><span class="np-sr-only" aria-live="polite">{{
                copied ? 'Copied' : copyError
              }}</span>
            </button>
          </div>
        </div>
        <LandingArtwork />
      </section>
      <section id="examples" class="np-section" aria-label="Code examples">
        <LandingExamples
          ><template #send><slot name="send" /></template
          ><template #receive><slot name="receive" /></template
          ><template #keys><slot name="keys" /></template
          ><template #request><slot name="request" /></template
          ><template #watch><slot name="watch" /></template
        ></LandingExamples>
      </section>
      <section
        id="use-cases"
        class="np-section"
        aria-labelledby="use-cases-title"
      >
        <div class="np-section-heading">
          <h2 id="use-cases-title">Use cases</h2>
        </div>
        <div class="np-use-cases">
          <a class="np-use-case" :href="withBase('/guides/accounts.html')"
            ><div class="np-use-visual np-wallet-visual" aria-hidden="true">
              <div class="np-wallet-back">
                <span>Account 01</span><span class="np-small-mark">n</span>
              </div>
              <div class="np-wallet-front">
                <span class="np-wallet-label">Your Nano account</span
                ><strong>Your keys.<br />Your control.</strong
                ><span class="np-wallet-address"
                  >nano_1… <span>Locally derived</span></span
                >
              </div>
            </div>
            <div class="np-use-copy">
              <h3>Wallets</h3>
              <p>
                Build a wallet with seed recovery, deterministic accounts, and
                signing that stays local.
              </p>
            </div></a
          >
          <a class="np-use-case" :href="withBase('/guides/payment-links.html')"
            ><div class="np-use-visual np-payment-visual" aria-hidden="true">
              <div class="np-invoice">
                <div>
                  <span class="np-invoice-icon">Ӿ</span
                  ><span
                    >Payment request<br /><small
                      >Order #1042 · Example</small
                    ></span
                  >
                </div>
                <strong>1.25 <span>XNO</span></strong
                ><span class="np-invoice-status"><i></i> Ready to share</span>
              </div>
            </div>
            <div class="np-use-copy">
              <h3>Payments</h3>
              <p>
                Create payment links, send exact amounts, and receive funds into
                the right account.
              </p>
            </div></a
          >
          <a class="np-use-case" :href="withBase('/guides/confirmations.html')"
            ><div class="np-use-visual np-events-visual" aria-hidden="true">
              <span class="np-log-label">EXAMPLE ACTIVITY</span>
              <div class="np-log">
                <span class="np-log-dot"></span
                ><span
                  >Socket connected<small>Ready for subscriptions</small></span
                ><code>01</code>
              </div>
              <div class="np-log">
                <span class="np-log-dot"></span
                ><span
                  >Account subscribed<small
                    >Listening for confirmations</small
                  ></span
                ><code>02</code>
              </div>
              <div class="np-log">
                <span class="np-log-dot np-green"></span
                ><span
                  >Block confirmed<small
                    >Reconcile account activity</small
                  ></span
                ><code>03</code>
              </div>
            </div>
            <div class="np-use-copy">
              <h3>Integrations</h3>
              <p>
                Read account state and subscribe to confirmations to keep your
                application up to date.
              </p>
            </div></a
          >
        </div>
      </section>
      <section id="toolkit" class="np-section" aria-labelledby="toolkit-title">
        <div class="np-section-heading">
          <h2 id="toolkit-title">Features</h2>
        </div>
        <div class="np-feature-grid">
          <a
            v-for="feature in features"
            :key="feature.title"
            class="np-feature"
            :href="withBase('/' + feature.link)"
            ><span class="np-feature-icon"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path :d="feature.icon" /></svg
            ></span>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.text }}</p>
          </a>
        </div>
      </section>
      <section
        id="resources"
        class="np-section"
        aria-labelledby="resources-title"
      >
        <div class="np-section-heading">
          <h2 id="resources-title">Documentation</h2>
        </div>
        <div class="np-resource-grid">
          <a
            v-for="resource in resources"
            :key="resource.number"
            class="np-resource"
            :href="withBase('/' + resource.link)"
            ><span class="np-resource-top"
              ><span>{{ resource.tag }}</span></span
            >
            <h3>{{ resource.title }}</h3>
            <p>{{ resource.text }}</p></a
          >
        </div>
      </section>
      <section class="np-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Start building with Nano.</h2>
        <div class="np-actions">
          <a
            class="np-button np-primary"
            :href="withBase('/getting-started.html')"
            >Read the quick start</a
          ><a
            class="np-button np-secondary"
            href="https://github.com/chiragasarpota/nanopay"
            >View on GitHub</a
          >
        </div>
      </section>
    </div>
    <div class="np-bottom">
      <a :href="withBase('/getting-started.html')">Documentation</a
      ><a :href="withBase('/api.html')">API reference</a
      ><a href="https://www.npmjs.com/package/nanopay">npm</a
      ><span>Built for Nano.</span>
    </div>
    <div class="np-wordmark" aria-hidden="true">nanopay</div>
  </main>
</template>
