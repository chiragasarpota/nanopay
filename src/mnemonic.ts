/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import {
  generateMnemonic as generate,
  validateMnemonic,
  mnemonicToSeedWebcrypto,
  entropyToMnemonic as encode,
  mnemonicToEntropy as decode,
} from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha512 } from '@noble/hashes/sha2.js'
import { byteArrayToHex, hexToByteArray } from './utils.js'
import { accountFromPrivateKey, type Account } from './accounts.js'

export interface MnemonicOptions {
  passphrase?: string
}
export interface MnemonicWallet {
  readonly mnemonic: string
  /** Nano SLIP-0010 path m/44'/165'/index'. */
  account(index?: number): Account
}
function normalized(value: string): string {
  if (typeof value !== 'string') throw new Error('Mnemonic must be a string')
  return value.normalize('NFKD').trim().split(/\s+/u).join(' ')
}
export function isValidMnemonic(value: unknown): value is string {
  return (
    typeof value === 'string' && validateMnemonic(normalized(value), wordlist)
  )
}
export function generateMnemonic(
  options: { words?: 12 | 15 | 18 | 21 | 24 } = {},
): string {
  const words = options.words ?? 24
  if (![12, 15, 18, 21, 24].includes(words))
    throw new Error('Word count must be 12, 15, 18, 21 or 24')
  return generate(wordlist, (words / 3) * 32)
}
/** Encode 16–32 bytes of hex entropy as English BIP39 words. This does not derive a BIP39 seed. */
export function entropyToMnemonic(entropy: string): string {
  if (typeof entropy !== 'string' || !/^(?:[0-9a-f]{8}){4,8}$/i.test(entropy))
    throw new Error('Entropy must contain 16, 20, 24, 28 or 32 bytes of hex')
  return encode(hexToByteArray(entropy), wordlist)
}
/** Recover original entropy, not the 64-byte PBKDF2 seed. */
export function mnemonicToEntropy(mnemonic: string): string {
  return byteArrayToHex(decode(normalized(mnemonic), wordlist))
}
/** Standard 64-byte BIP39 seed, encoded as 128 hex characters. Native Nano seeds are a different format. */
export async function deriveMnemonicSeed(
  mnemonic: string,
  options: MnemonicOptions = {},
): Promise<string> {
  if (!isValidMnemonic(mnemonic))
    throw new Error('Mnemonic words or checksum are not valid')
  if (
    options.passphrase !== undefined &&
    typeof options.passphrase !== 'string'
  )
    throw new Error('Passphrase must be a string')
  return byteArrayToHex(
    await mnemonicToSeedWebcrypto(
      normalized(mnemonic),
      options.passphrase ?? '',
    ),
  )
}
function child(parent: Uint8Array, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff)
    throw new Error('Mnemonic index must be an integer from 0 to 2147483647')
  const input = new Uint8Array(37)
  input.set(parent.subarray(0, 32), 1)
  new DataView(input.buffer).setUint32(33, index + 0x80000000)
  return hmac(sha512, parent.subarray(32), input)
}
function nanoRoot(seed: string): Uint8Array {
  if (typeof seed !== 'string' || !/^[0-9a-f]{128}$/i.test(seed))
    throw new Error('BIP39 seed must be 128 hexadecimal characters')
  const master = hmac(
    sha512,
    new TextEncoder().encode('ed25519 seed'),
    hexToByteArray(seed),
  )
  return child(child(master, 44), 165)
}
/** Derive a private key at m/44'/165'/index' from a 64-byte BIP39 seed. */
export function deriveMnemonicPrivateKey(bip39Seed: string, index = 0): string {
  return byteArrayToHex(child(nanoRoot(bip39Seed), index).subarray(0, 32))
}
/** PBKDF2 and the common path are computed once; account derivation then stays synchronous. */
export async function walletFromMnemonic(
  mnemonic: string,
  options: MnemonicOptions = {},
): Promise<MnemonicWallet> {
  const root = nanoRoot(await deriveMnemonicSeed(mnemonic, options))
  return Object.freeze({
    mnemonic: normalized(mnemonic),
    account: (index = 0) =>
      accountFromPrivateKey(byteArrayToHex(child(root, index).subarray(0, 32))),
  })
}
