/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { createBlock, type Block } from './block.js'
import { nanoToRaw } from './amounts.js'
import { checkAddress, checkAmount, checkHash } from './check.js'

export interface TransactionParams {
  privateKey: string
  representative: string
  /** Current account balance in raw, from getAccountInfo(). */
  balanceRaw: string
  /** Omit work to attach it later. */
  work?: string | null
}
export interface SendParams extends TransactionParams {
  previous: string
  to: string
  /** Amount to send in Nano, as a decimal string. */
  amount: string
}
export interface ReceiveParams extends TransactionParams {
  /** null when opening a new account. */
  previous: string | null
  /** Confirmed incoming send block hash from getReceivable(). */
  sourceHash: string
  /** Incoming amount in raw from getReceivable(). */
  amountRaw: string
}
export interface ChangeParams extends TransactionParams {
  previous: string
}

/** Build and sign a send locally. Returns a block; does not contact the network. */
export function createSendBlock(params: SendParams): Block {
  if (!checkAddress(params.to))
    throw new Error('Destination address is not valid')
  if (!checkAmount(params.balanceRaw))
    throw new Error('Current raw balance is not valid')
  const amount = BigInt(nanoToRaw(params.amount))
  const balance = BigInt(params.balanceRaw)
  if (amount === 0n) throw new Error('Send amount must be greater than zero')
  if (amount > balance) throw new Error('Insufficient balance')
  return createBlock(params.privateKey, {
    previous: params.previous,
    representative: params.representative,
    balance: (balance - amount).toString(),
    link: params.to,
    work: params.work ?? null,
  })
}

/** Build and sign a receive/open locally. Amount and source hash must come from confirmed node data. */
export function createReceiveBlock(params: ReceiveParams): Block {
  if (!checkHash(params.sourceHash) || /^0{64}$/.test(params.sourceHash))
    throw new Error('Source block hash is not valid')
  if (!checkAmount(params.balanceRaw))
    throw new Error('Current raw balance is not valid')
  if (!checkAmount(params.amountRaw) || params.amountRaw === '0')
    throw new Error('Incoming raw amount must be greater than zero')
  if (
    (params.previous === null || /^0{64}$/.test(params.previous)) &&
    params.balanceRaw !== '0'
  )
    throw new Error('An unopened account must have zero current balance')
  return createBlock(params.privateKey, {
    previous: params.previous,
    representative: params.representative,
    balance: (BigInt(params.balanceRaw) + BigInt(params.amountRaw)).toString(),
    link: params.sourceHash,
    work: params.work ?? null,
  })
}

/** Change the representative without changing the balance. Does not publish the block. */
export function createChangeBlock(params: ChangeParams): Block {
  return createBlock(params.privateKey, {
    previous: params.previous,
    representative: params.representative,
    balance: params.balanceRaw,
    link: null,
    work: params.work ?? null,
  })
}
