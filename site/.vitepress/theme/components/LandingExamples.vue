<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const examples = [
  {
    id: 'send',
    title: 'Send a payment',
    description: 'From your account to theirs, with confirmation.',
    file: 'send.ts',
  },
  {
    id: 'receive',
    title: 'Receive funds',
    description: 'Open an account and receive incoming transfers.',
    file: 'receive.ts',
  },
  {
    id: 'keys',
    title: 'Derive your keys',
    description: 'A seed, a private key, a public key, an address.',
    file: 'keys.ts',
  },
  {
    id: 'request',
    title: 'Request a payment',
    description: 'Create a payment link with an exact amount.',
    file: 'request.ts',
  },
  {
    id: 'watch',
    title: 'Watch confirmations',
    description: 'Subscribe to account activity over WebSockets.',
    file: 'watch.ts',
  },
]
const active = ref(0)
const narrow = ref(false)
const panels = ref<HTMLElement | null>(null)
const copyStatus = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined
let media: MediaQueryList | undefined
const updateOrientation = () => {
  narrow.value = media?.matches ?? false
}
onMounted(() => {
  media = window.matchMedia('(max-width: 767px)')
  updateOrientation()
  media.addEventListener('change', updateOrientation)
})
onBeforeUnmount(() => {
  media?.removeEventListener('change', updateOrientation)
  clearTimeout(copyTimer)
})
function select(index: number) {
  active.value = index
  copyStatus.value = ''
  clearTimeout(copyTimer)
}
async function onKeydown(event: KeyboardEvent, index: number) {
  const next = ['ArrowDown', 'ArrowRight'].includes(event.key)
  const previous = ['ArrowUp', 'ArrowLeft'].includes(event.key)
  if (!next && !previous && !['Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? examples.length - 1
        : (index + (next ? 1 : -1) + examples.length) % examples.length
  const tablist = (event.currentTarget as HTMLElement).parentElement
  select(target)
  await nextTick()
  tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus()
}
async function copy() {
  const text = panels.value?.querySelector(
    '[data-open="true"] pre code',
  )?.textContent
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = 'Copied'
  } catch {
    copyStatus.value = 'Select the code to copy'
  }
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyStatus.value = ''
  }, 2500)
}
</script>

<template>
  <div class="np-examples">
    <div
      class="np-tablist"
      role="tablist"
      aria-label="Nano code examples"
      :aria-orientation="narrow ? 'horizontal' : 'vertical'"
    >
      <button
        v-for="(example, index) in examples"
        :id="`example-tab-${example.id}`"
        :key="example.id"
        class="np-tab"
        role="tab"
        :aria-selected="active === index"
        :aria-controls="`example-panel-${example.id}`"
        :tabindex="active === index ? 0 : -1"
        @click="select(index)"
        @keydown="onKeydown($event, index)"
      >
        <span
          ><span class="np-tab-title">{{ example.title }}</span
          ><span class="np-tab-description">{{
            example.description
          }}</span></span
        >
      </button>
    </div>
    <div class="np-editor">
      <div class="np-editor-bar">
        <span
          ><span class="np-ts-icon" aria-hidden="true">TS</span>
          {{ examples[active].file }}</span
        >
        <button class="np-copy" aria-label="Copy code example" @click="copy">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V4H4v12h4" /></svg
          ><span aria-live="polite">{{ copyStatus || 'Copy' }}</span>
        </button>
      </div>
      <div ref="panels" class="np-panels">
        <div
          v-for="(example, index) in examples"
          :id="`example-panel-${example.id}`"
          :key="example.id"
          class="np-panel t-panel-slide"
          role="tabpanel"
          :aria-labelledby="`example-tab-${example.id}`"
          :aria-hidden="active !== index"
          :inert="active !== index"
          :tabindex="active === index ? 0 : -1"
          :data-open="active === index"
        >
          <div class="np-code vp-doc"><slot :name="example.id" /></div>
        </div>
      </div>
    </div>
  </div>
</template>
