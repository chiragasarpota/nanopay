/*
 * nanopay proof of work, Copyright (c) 2026 chiragasarpota. GPL-3.0-only.
 * Derived from nanocurrency-js (c) 2019 Marvin ROGER.
 * Uses the unmodified BLAKE2b compression function by Samuel Neves (CC0).
 */
#include "blake2/blake2b-ref.c"

static uint8_t root[32];
static uint64_t result;

uint8_t *root_ptr(void) { return root; }
uint64_t result_value(void) { return result; }

/* The 40-byte PoW payload always fits in one BLAKE2b block. No heap allocation. */
int work_batch(uint64_t threshold, uint64_t start, uint32_t count) {
  uint8_t block[128] = {0};
  memcpy(block + 8, root, 32);
  for (uint32_t i = 0; i < count; i++) {
    uint64_t nonce = start + i;
    store64(block, nonce);
    blake2b_state state = {0};
    for (unsigned j = 0; j < 8; j++) state.h[j] = blake2b_IV[j];
    state.h[0] ^= 0x01010008; /* digest = 8 bytes, fanout = 1, depth = 1 */
    state.t[0] = 40;
    state.f[0] = UINT64_MAX;
    blake2b_compress(&state, block);
    if (state.h[0] >= threshold) {
      result = nonce;
      return 1;
    }
  }
  return 0;
}

/* Standalone WASM support. Volatile accesses prevent recursive builtin lowering. */
void *memcpy(void *dst, const void *src, size_t count) {
  volatile unsigned char *d = dst;
  const volatile unsigned char *s = src;
  for (size_t i = 0; i < count; i++) d[i] = s[i];
  return dst;
}
void *memset(void *dst, int value, size_t count) {
  volatile unsigned char *d = dst;
  for (size_t i = 0; i < count; i++) d[i] = (unsigned char)value;
  return dst;
}
