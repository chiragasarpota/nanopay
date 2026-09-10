/*!
 * Derived from nanocurrency-js, Copyright (c) 2019 Marvin ROGER.
 * Modified for nanopay by chiragasarpota, 2026-09-10. GPL-3.0-only.
 */
import wasmBytes from './work.wasm'
import { checkHash, checkThreshold } from './check.js'
import { DEFAULT_WORK_THRESHOLD } from './work.js'
import { hexToByteArray } from './utils.js'

interface WorkEngine {
  memory: WebAssembly.Memory
  root_ptr(): number
  result_value(): bigint
  work_batch(threshold: bigint, start: bigint, count: number): number
}
let compiledModule: Promise<WebAssembly.Module> | undefined
const NONCE_SPACE = 1n << 64n

export interface ComputeWorkParams {
  /** Which disjoint nonce range to search (default: 0). Does not spawn workers. */
  workerIndex?: number
  /** Number of disjoint ranges (default: 1). Run calls in Web Workers to use multiple cores. */
  workerCount?: number
  /** Default: mainnet send/change difficulty. */
  workThreshold?: string
  /** Stop generation with an AbortSignal. */
  signal?: AbortSignal
  /** Maximum nonce attempts, useful for bounded work. Returns null when exhausted. */
  maxIterations?: number
  /** Attempts between event-loop yields. Default: 16384, maximum: 1048576. */
  batchSize?: number
}

/**
 * Generate PoW in optimized WebAssembly, yielding between batches for cancellation.
 * Use an RPC work server or GPU for sustained mainnet workloads.
 */
export async function computeWork(
  blockHash: string,
  params: ComputeWorkParams = {},
): Promise<string | null> {
  const {
    workerIndex = 0,
    workerCount = 1,
    workThreshold = DEFAULT_WORK_THRESHOLD,
    signal,
    maxIterations,
    batchSize = 16384,
  } = params
  if (!checkHash(blockHash)) throw new Error('Hash is not valid')
  if (!checkThreshold(workThreshold)) throw new Error('Threshold is not valid')
  if (
    !Number.isSafeInteger(workerIndex) ||
    !Number.isSafeInteger(workerCount) ||
    workerIndex < 0 ||
    workerCount < 1 ||
    workerIndex >= workerCount
  )
    throw new Error('Worker parameters are not valid')
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1048576)
    throw new Error('Batch size must be an integer from 1 to 1048576')
  if (
    maxIterations !== undefined &&
    (!Number.isSafeInteger(maxIterations) || maxIterations < 0)
  )
    throw new Error('Maximum iterations must be a non-negative safe integer')
  signal?.throwIfAborted()
  if (maxIterations === 0) return null

  compiledModule ??= WebAssembly.compile(wasmBytes).catch((error) => {
    compiledModule = undefined
    throw error
  })
  // Each call has its own memory, so concurrent requests cannot overwrite roots/results.
  const instance = await WebAssembly.instantiate(await compiledModule)
  signal?.throwIfAborted()
  const engine = instance.exports as unknown as WorkEngine
  new Uint8Array(engine.memory.buffer, engine.root_ptr(), 32).set(
    hexToByteArray(blockHash),
  )
  const threshold = BigInt(`0x${workThreshold}`)
  let nonce = (NONCE_SPACE * BigInt(workerIndex)) / BigInt(workerCount)
  let end = (NONCE_SPACE * BigInt(workerIndex + 1)) / BigInt(workerCount)
  if (maxIterations !== undefined && nonce + BigInt(maxIterations) < end)
    end = nonce + BigInt(maxIterations)

  while (nonce < end) {
    signal?.throwIfAborted()
    const count = Number(
      end - nonce < BigInt(batchSize) ? end - nonce : BigInt(batchSize),
    )
    if (engine.work_batch(threshold, nonce, count)) {
      return BigInt.asUintN(64, engine.result_value())
        .toString(16)
        .padStart(16, '0')
    }
    nonce += BigInt(count)
    if (nonce < end)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  return null
}
