# Changelog

## 0.2.0 — 2026-09-12

- Default `createClient()`, `new NanoClient()`, `createRpcClient()` and `new NanoRpcClient()` to BerryPay's public Nano mainnet RPC when the URL is omitted. Export `DEFAULT_RPC_URL`; explicit URLs still select your own node and invalid URLs still fail validation.
- Add a searchable documentation site with TypeScript guides, a complete API reference, provider configuration, transaction recovery and deployment instructions.
- Add a separate docs build, CI checks and Cloudflare Workers deployment with Wrangler. Site tooling and built assets are excluded from the npm package.

## 0.1.0 — 2026-09-11

First toolkit implementation, based on nanocurrency-js commit `5a0d9957c50f00a848476b20efc9e06335ba5209`. Modified by chiragasarpota on 2026-09-10.

- Added canonical private-key terminology, independent accounts, deterministic multi-account wallets, and granular native seed/key/address functions.
- Added English BIP39 mnemonics, explicit entropy/seed conversion and Nano SLIP-0010 derivation, checked against official vectors.
- Separated unsigned block construction, hash signing, block signing, external signature attachment, work generation and publication. Preserved upstream signatures under nanopay/legacy.
- Added send/receive/receiveAll/changeRepresentative workflows, external signer and work hooks, per-account serialization, partial failure recovery, and confirmation polling.
- Blocked queued and future account writes after failed submissions until explicit reconciliation and resumption; added `AccountBlockedError` and `resumeAccount`.
- Matched Nano's signature scalar-bit validation and preserved client/error class identities across root, RPC, and legacy entry points in both ESM and CommonJS.
- Supported unavailable block amounts and confirmation polling on pruned nodes; added paged receivable fallback for single receives whose history has been pruned.
- Invoked npm's JavaScript CLI directly for package checks and bootstrap publishing, with argument-preservation tests and Windows CI coverage.
- Added batch balances, payment URIs, bounded WebSocket confirmation streams, focused package imports and a complete API reference.
- Added an explicit-endpoint RPC client following the official Nano documentation, with confirmed balance reads, receivable/history queries, block info, verified work generation, and locally checked publishing with explicit subtypes.
- Replaced decimal-library loops with exact string conversion and native bigint bounds; removed bignumber.js.
- Optimized byte/hex handling and removed redundant address decoding.
- Rebuilt proof of work as a 6.6 KiB standalone WASM module with batched computation, cancellation, bounded attempts, per-request memory, and full-width worker ranges. Preserved BLAKE2b compression and Nano's signing implementation.
- Updated defaults to nano_ addresses and epoch 2 send/change work difficulty. Historical values remain explicit options.
- Replaced the old monorepo tooling with TypeScript 7, esbuild, native Node tests, browser/worker tests, and a CLI using native argument parsing.
- Added ESM/CommonJS entry points, corresponding TypeScript declarations, a standalone browser bundle, reproducible benchmarks, clean-install verification, and CI.
- Added real Nano dev-node integration tests for payment workflows, WebSocket confirmations, and interrupted-submission recovery; verified the same workflows on mainnet.
- Included source, build instructions, original copyright notices, GPL-3.0, and third-party licenses.

## 0.0.1 — 2026-09-11

Initial package bootstrap published under chiragasarpota. Exports version metadata only; the toolkit begins with 0.1.0.
