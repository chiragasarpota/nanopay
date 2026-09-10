/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import {
  deriveSecretKey,
  derivePublicKey as upstreamPublicKey,
  deriveAddress,
} from './keys.js'
import { checkKey, checkAddress, checkSeed } from './check.js'
import { byteArrayToHex } from './utils.js'

/** Local signing material. Never send this object to a node or log it. */
export interface Account {
  readonly privateKey: string
  readonly publicKey: string
  readonly address: string
}
export interface SeedWallet {
  readonly seed: string
  account(index?: number): Account
}
/** 32 random bytes from the runtime's cryptographically secure source, encoded as hex. */
export function generateSeed(): string {
  return byteArrayToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)))
}
/** A new independent signing key, not derived from a wallet seed. */
export function generatePrivateKey(): string {
  return generateSeed()
}
/** Native Nano BLAKE2b derivation. Index defaults to zero; supports the full uint32 range. */
export function derivePrivateKey(seed: string, index = 0): string {
  return deriveSecretKey(seed, index)
}
/** Derive a Nano Ed25519-BLAKE2b public key from a private key. */
export function derivePublicKey(privateKey: string): string {
  if (!checkKey(privateKey))
    throw new Error('Private key must be 64 hexadecimal characters')
  return upstreamPublicKey(privateKey)
}
/** Decode and checksum-validate an address. Does not derive a signing key. */
export function publicKeyFromAddress(address: string): string {
  if (!checkAddress(address)) throw new Error('Address is not valid')
  return upstreamPublicKey(address)
}
export function addressFromPrivateKey(privateKey: string): string {
  return deriveAddress(derivePublicKey(privateKey))
}
/** Normalize nano_/xrb_ addresses to the modern nano_ prefix. */
export function normalizeAddress(address: string): string {
  return deriveAddress(publicKeyFromAddress(address))
}
export function accountFromPrivateKey(privateKey: string): Account {
  const publicKey = derivePublicKey(privateKey)
  return Object.freeze({
    privateKey: privateKey.toUpperCase(),
    publicKey,
    address: deriveAddress(publicKey),
  })
}
export function accountFromSeed(seed: string, index = 0): Account {
  return accountFromPrivateKey(derivePrivateKey(seed, index))
}
export function createAccount(): Account {
  return accountFromPrivateKey(generatePrivateKey())
}
export function walletFromSeed(seed: string): SeedWallet {
  if (!checkSeed(seed))
    throw new Error('Seed must be 64 hexadecimal characters')
  const normalized = seed.toUpperCase()
  return Object.freeze({
    seed: normalized,
    account: (index = 0) => accountFromSeed(normalized, index),
  })
}
export function createWallet(): SeedWallet {
  return walletFromSeed(generateSeed())
}
