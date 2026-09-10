/*!
 * nanocurrency-js: A toolkit for the Nano cryptocurrency.
 * Copyright (c) 2019 Marvin ROGER <dev at marvinroger dot fr>
 * Licensed under GPL-3.0 (https://git.io/vAZsK)
 * Modified for nanopay by chiragasarpota, 2026-09-10. See CHANGELOG.md.
 */
import blake from 'blakejs'
const { blake2b } = blake

import { compareArrays } from './utils.js'
import { checkString } from './check.js'
import { decodeNanoBase32 } from './nano-base32.js'

/** @hidden */
export interface ParseAddressResult {
  valid: boolean
  publicKeyBytes: Uint8Array | null
}

/** @hidden */
export function parseAddress(address: unknown): ParseAddressResult {
  const invalid = { valid: false, publicKeyBytes: null }
  if (
    !checkString(address) ||
    !/^(xrb_|nano_)[13][13-9a-km-uw-z]{59}$/.test(address)
  ) {
    return invalid
  }

  let prefixLength
  if (address.startsWith('xrb_')) {
    prefixLength = 4
  } else {
    // nano_
    prefixLength = 5
  }

  const publicKeyBytes = decodeNanoBase32(
    address.slice(prefixLength, prefixLength + 52),
  )
  const checksumBytes = decodeNanoBase32(address.slice(prefixLength + 52))

  const computedChecksumBytes = blake2b(publicKeyBytes, undefined, 5).reverse()

  const valid = compareArrays(checksumBytes, computedChecksumBytes)

  if (!valid) return invalid

  return {
    publicKeyBytes,
    valid: true,
  }
}
