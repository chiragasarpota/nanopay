/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
export {
  generateSeed,
  generatePrivateKey,
  derivePrivateKey,
  derivePublicKey,
  publicKeyFromAddress,
  addressFromPrivateKey,
  normalizeAddress,
  createAccount,
  accountFromPrivateKey,
  accountFromSeed,
  createWallet,
  walletFromSeed,
  type Account,
  type SeedWallet,
} from './accounts.js'
export { deriveAddress, type DeriveAddressParams } from './keys.js'
export {
  generateMnemonic,
  isValidMnemonic,
  entropyToMnemonic,
  mnemonicToEntropy,
  deriveMnemonicSeed,
  deriveMnemonicPrivateKey,
  walletFromMnemonic,
  type MnemonicOptions,
  type MnemonicWallet,
} from './mnemonic.js'
export {
  checkAddress as isValidAddress,
  checkAmount as isValidRawAmount,
  checkHash as isValidHash,
  checkIndex as isValidAccountIndex,
  checkKey as isValidPrivateKey,
  checkKey as isValidPublicKey,
  checkSeed as isValidSeed,
  checkSignature as isValidSignature,
  checkThreshold as isValidWorkThreshold,
  checkWork as isValidWorkFormat,
} from './check.js'
export { nanoToRaw, rawToNano } from './amounts.js'
export { convert, Unit, type ConvertParams } from './conversion.js'
export { hashBlock, type HashBlockParams } from './hash.js'
export {
  buildBlock,
  buildSendBlock,
  buildReceiveBlock,
  buildChangeBlock,
  signHash,
  verifyHash,
  signBlock,
  verifyBlock,
  attachSignature,
  getWorkRoot,
  ZERO_HASH,
  type UnsignedBlock,
  type SignedBlock,
  type Amount,
  type BuildBlockParams,
  type BuildTransactionParams,
  type BuildSendParams,
  type BuildReceiveParams,
} from './state-blocks.js'
export {
  createSendBlock,
  createReceiveBlock,
  createChangeBlock,
  type CreateSendParams,
  type CreateReceiveParams,
  type CreateChangeParams,
  type CreatedBlock,
} from './state-blocks.js'
export {
  generateWork,
  verifyWork,
  attachWork,
  type WorkOptions,
} from './proof-of-work.js'
export {
  DEFAULT_WORK_THRESHOLD,
  SEND_WORK_THRESHOLD,
  RECEIVE_WORK_THRESHOLD,
  LEGACY_WORK_THRESHOLD,
} from './work.js'
export { createRpcClient, NanoRpcClient, NanoRpcError } from './rpc.js'
export type {
  RpcClientOptions,
  RequestOptions,
  AccountBalance,
  AccountInfo,
  Receivable,
  HistoryEntry,
  AccountHistory,
  BlockInfo,
  BlockSubtype,
} from './rpc.js'
export {
  createClient,
  NanoClient,
  createSigner,
  TransactionError,
  ReceiveAllError,
  type Signer,
  type SigningAccount,
  type WorkProvider,
  type WorkRequest,
  type ClientOptions,
  type PreparedTransaction,
  type TransactionResult,
  type ReceiveAllResult,
  type PrepareSendOptions,
  type PrepareReceiveOptions,
  type PrepareChangeOptions,
  type SendOptions,
  type ReceiveOptions,
  type ChangeRepresentativeOptions,
  type ReceiveAllOptions,
  type ConfirmationOptions,
} from './client.js'
export {
  createPaymentUri,
  parsePaymentUri,
  type PaymentRequest,
  type CreatePaymentRequest,
} from './payment-uri.js'
export {
  watchConfirmations,
  type Confirmation,
  type WatchConfirmationsOptions,
} from './confirmations.js'
