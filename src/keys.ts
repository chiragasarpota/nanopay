/*!
 * nanocurrency-js: A toolkit for the Nano cryptocurrency.
 * Copyright (c) 2019 Marvin ROGER <dev at marvinroger dot fr>
 * Licensed under GPL-3.0 (https://git.io/vAZsK)
 * Modified for nanopay by chiragasarpota, 2026-09-10. See CHANGELOG.md.
 */
import blake from 'blakejs'
const { blake2b, blake2bFinal, blake2bInit, blake2bUpdate } = blake
import { checkIndex, checkKey, checkSeed } from './check.js'
import { derivePublicFromSecret } from './nacl.js'
import { encodeNanoBase32 } from './nano-base32.js'
import { parseAddress } from './parse.js'
import { byteArrayToHex, getRandomBytes, hexToByteArray } from './utils.js'

/**
 * Generate a cryptographically secure seed.
 *
 * @returns Promise fulfilled with seed, in hexadecimal format
 */
export async function generateSeed(): Promise<string> {
  return byteArrayToHex(await getRandomBytes(32)).toLowerCase()
}

/**
 * Derive a secret key from a seed, given an index.
 *
 * @param seed - The seed to generate the secret key from, in hexadecimal format
 * @param index - The index to generate the secret key from
 * @returns Secret key, in hexadecimal format
 */
export function deriveSecretKey(seed: string, index: number): string {
  if (!checkSeed(seed)) throw new Error('Seed is not valid')
  if (!checkIndex(index)) {
    throw new Error('Index is not valid')
  }

  const seedBytes = hexToByteArray(seed)
  const indexBuffer = new ArrayBuffer(4)
  const indexView = new DataView(indexBuffer)
  indexView.setUint32(0, index)
  const indexBytes = new Uint8Array(indexBuffer)

  const context = blake2bInit(32)
  blake2bUpdate(context, seedBytes)
  blake2bUpdate(context, indexBytes)
  const secretKeyBytes = blake2bFinal(context)

  return byteArrayToHex(secretKeyBytes)
}

/**
 * Derive a public key from a secret key.
 *
 * @param secretKeyOrAddress - The secret key or address to generate the public key from, in hexadecimal or address format
 * @returns Public key, in hexadecimal format
 */
export function derivePublicKey(secretKeyOrAddress: string): string {
  const isSecretKey = checkKey(secretKeyOrAddress)
  const addressParseResult = parseAddress(secretKeyOrAddress)
  const isAddress = addressParseResult.valid
  if (!isSecretKey && !isAddress) {
    throw new Error('Secret key or address is not valid')
  }

  let publicKeyBytes: Uint8Array
  if (isSecretKey) {
    const secretKeyBytes = hexToByteArray(secretKeyOrAddress)
    publicKeyBytes = derivePublicFromSecret(secretKeyBytes)
  } else {
    // isAddress
    publicKeyBytes = addressParseResult.publicKeyBytes as Uint8Array
  }

  return byteArrayToHex(publicKeyBytes)
}

/** Derive address params. */
export interface DeriveAddressParams {
  /** Use the modern nano_ prefix (default: true). Set false for legacy xrb_. */
  useNanoPrefix?: boolean
}

/**
 * Derive address from a public key.
 *
 * @param publicKey - The public key to generate the address from, in hexadecimal format
 * @param params - Parameters
 * @returns Address
 */
export function deriveAddress(
  publicKey: string,
  params: DeriveAddressParams = {},
): string {
  if (!checkKey(publicKey)) throw new Error('Public key is not valid')

  const publicKeyBytes = hexToByteArray(publicKey)

  const prefix = params.useNanoPrefix === false ? 'xrb_' : 'nano_'

  const encodedPublicKey = encodeNanoBase32(publicKeyBytes)

  const checksum = blake2b(publicKeyBytes, undefined, 5).reverse()

  const encodedChecksum = encodeNanoBase32(checksum)

  return prefix + encodedPublicKey + encodedChecksum
}
