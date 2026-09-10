/*!
 * Derived from nanocurrency-js, Copyright (c) 2019 Marvin ROGER.
 * Modified for nanopay by chiragasarpota, 2026-09-10. GPL-3.0-only.
 */
const HEX = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0').toUpperCase(),
)
const NIBBLES = new Int16Array(128).fill(-1)
for (let i = 0; i < 16; i++) {
  NIBBLES['0123456789abcdef'.charCodeAt(i)] = i
  NIBBLES['0123456789ABCDEF'.charCodeAt(i)] = i
}

/** @hidden */
export async function getRandomBytes(count: number): Promise<Uint8Array> {
  return globalThis.crypto.getRandomValues(new Uint8Array(count))
}

/** @hidden */
export function byteArrayToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += HEX[bytes[i]]
  return hex
}

/** @hidden Input is validated at each public API boundary. */
export function hexToByteArray(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] =
      (NIBBLES[hex.charCodeAt(i * 2)] << 4) | NIBBLES[hex.charCodeAt(i * 2 + 1)]
  }
  return bytes
}

/** @hidden */
export function compareArrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  return difference === 0
}
