# Changelog

## 0.1.0 — unreleased

First toolkit implementation, based on nanocurrency-js commit `5a0d9957c50f00a848476b20efc9e06335ba5209`. Modified by chiragasarpota on 2026-09-10.

- Added canonical private-key terminology, independent accounts, deterministic multi-account wallets, and granular native seed/key/address functions.
- Added English BIP39 mnemonics, explicit entropy/seed conversion and Nano SLIP-0010 derivation, checked against official vectors.
- Separated unsigned block construction, hash signing, block signing, external signature attachment, work generation and publication. Preserved upstream signatures under nanopay/legacy.
- Added send/receive/receiveAll/changeRepresentative workflows, external signer and work hooks, per-account serialization, partial failure recovery, and confirmation polling.
- Added batch balances, payment URIs, bounded WebSocket confirmation streams, focused package imports and a complete API reference.
- Added an explicit-endpoint RPC client following the official Nano documentation, with confirmed balance reads, receivable/history queries, block info, verified work generation, and locally checked publishing with explicit subtypes.
- Replaced decimal-library loops with exact string conversion and native bigint bounds; removed bignumber.js.
- Optimized byte/hex handling and removed redundant address decoding.
- Rebuilt proof of work as a 6.6 KiB standalone WASM module with batched computation, cancellation, bounded attempts, per-request memory, and full-width worker ranges. Preserved BLAKE2b compression and Nano's signing implementation.
- Updated defaults to nano_ addresses and epoch 2 send/change work difficulty. Historical values remain explicit options.
- Replaced the old monorepo tooling with TypeScript 7, esbuild, native Node tests, browser/worker tests, and a CLI using native argument parsing.
- Added ESM/CommonJS entry points, corresponding TypeScript declarations, a standalone browser bundle, reproducible benchmarks, clean-install verification, and CI.
- Included source, build instructions, original copyright notices, GPL-3.0, and third-party licenses.

## 0.0.1 — publication pending

Initial package bootstrap under chiragasarpota. Exports version metadata only. Prepared separately from the toolkit release so it can be published first when npm permits the package name to be reused.
