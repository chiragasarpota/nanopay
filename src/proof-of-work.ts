/* Copyright (c) 2026 chiragasarpota. GPL-3.0-only. */
import { computeWork, type ComputeWorkParams } from './accelerated.js'
import { validateWork, DEFAULT_WORK_THRESHOLD } from './work.js'
import { getWorkRoot, type UnsignedBlock } from './state-blocks.js'
export interface WorkOptions extends Omit<ComputeWorkParams, 'workThreshold'> {
  threshold?: string
}
/** Local cancellable WASM search; null means the requested nonce range was exhausted. */
export function generateWork(
  root: string,
  options: WorkOptions = {},
): Promise<string | null> {
  const { threshold, ...rest } = options
  return computeWork(root, { ...rest, workThreshold: threshold })
}
export function verifyWork(params: {
  root: string
  work: string
  threshold?: string
}): boolean {
  try {
    return validateWork({
      blockHash: params.root,
      work: params.work,
      threshold: params.threshold,
    })
  } catch {
    return false
  }
}
/** Attach verified work. Pass RECEIVE_WORK_THRESHOLD for receive/open blocks. */
export function attachWork<T extends UnsignedBlock>(
  block: T,
  work: string,
  options: { threshold?: string } = {},
): T {
  if (
    !verifyWork({
      root: getWorkRoot(block),
      work,
      threshold: options.threshold ?? DEFAULT_WORK_THRESHOLD,
    })
  )
    throw new Error('Proof of work is not valid')
  return { ...block, work }
}
