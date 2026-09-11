<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { createHeroBlocks } from './hero-blocks'

const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let blocks: ReturnType<typeof createHeroBlocks> | undefined
let resize: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
let motion: MediaQueryList | undefined
let visible = false
let destroyed = false
let loading = false

function updatePlayback() {
  if (!ready.value || !blocks) return
  if (visible && !document.hidden && !motion?.matches) blocks.play()
  else blocks.stop()
}
function pointer(event?: PointerEvent) {
  if (motion?.matches || !container.value) return
  const rect = container.value.getBoundingClientRect()
  blocks?.pointer(
    event ? ((event.clientX - rect.left) / rect.width - 0.5) * 2 : 0,
    event ? ((event.clientY - rect.top) / rect.height - 0.5) * 2 : 0,
    !!event,
  )
}
async function load() {
  if (loading || destroyed || !canvas.value || !container.value) return
  loading = true
  try {
    const { createHeroBlocks } = await import('./hero-blocks')
    if (destroyed || !canvas.value || !container.value) return
    const accent = getComputedStyle(container.value)
      .getPropertyValue('--nanopay-accent')
      .trim()
    blocks = createHeroBlocks(canvas.value, accent)
    const setSize = () => {
      if (!container.value) return
      const { width, height } = container.value.getBoundingClientRect()
      blocks?.resize(width, height)
    }
    setSize()
    resize = new ResizeObserver(setSize)
    resize.observe(container.value)
    ready.value = true
    updatePlayback()
  } catch {
    blocks?.dispose()
    blocks = undefined
  }
}
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', updatePlayback)
  document.addEventListener('visibilitychange', updatePlayback)
  intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) void load()
    updatePlayback()
  })
  if (container.value) intersection.observe(container.value)
})
onBeforeUnmount(() => {
  destroyed = true
  resize?.disconnect()
  intersection?.disconnect()
  motion?.removeEventListener('change', updatePlayback)
  document.removeEventListener('visibilitychange', updatePlayback)
  blocks?.dispose()
})
</script>

<template>
  <div
    ref="container"
    class="np-artwork"
    aria-hidden="true"
    @pointermove="pointer"
    @pointerleave="pointer()"
  >
    <canvas ref="canvas" :class="['np-blocks-canvas', { 'is-ready': ready }]" />
  </div>
</template>

<style scoped>
.np-artwork {
  position: relative;
  height: 420px;
  min-width: 0;
  margin-inline: -24px;
}
.np-blocks-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
}
.np-blocks-canvas.is-ready {
  opacity: 1;
}
@media (max-width: 767px) {
  .np-artwork {
    display: none;
  }
}
</style>
