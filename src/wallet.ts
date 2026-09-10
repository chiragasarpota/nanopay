/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import {
  deriveSecretKey,
  derivePublicKey,
  deriveAddress,
  generateSeed,
} from './keys.js'

/** Sensitive wallet material. Store the seed securely; never send it to an RPC node. */
export interface Wallet {
  seed: string
  index: number
  privateKey: string
  publicKey: string
  address: string
}

/** Recover a deterministic wallet account from a Nano seed and index (default: 0). */
export function deriveWallet(seed: string, index = 0): Wallet {
  const privateKey = deriveSecretKey(seed, index)
  const publicKey = derivePublicKey(privateKey)
  return {
    seed,
    index,
    privateKey,
    publicKey,
    address: deriveAddress(publicKey),
  }
}

/** Create a wallet locally using the runtime's cryptographically secure random source. */
export async function createWallet(): Promise<Wallet> {
  return deriveWallet(await generateSeed())
}
