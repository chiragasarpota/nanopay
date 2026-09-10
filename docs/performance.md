# Performance

Measured on 2026-09-10 with Node.js 22.16.0 on an Apple M4 Pro (macOS arm64). These are local microbenchmarks, not guarantees for another machine or workload. Each number is the median of five warm samples. The comparison uses an unchanged installation of nanocurrency@2.5.0 on the same machine.

| Operation                                         | nanopay ops/sec | Upstream ops/sec |  Ratio |
| ------------------------------------------------- | --------------: | ---------------: | -----: |
| Nano → raw                                        |       9,203,866 |          142,730 | 64.48× |
| raw → Nano                                        |       6,441,972 |           30,458 | 211.5× |
| deriveSecretKey                                   |         421,014 |          295,757 |  1.42× |
| deriveAddress                                     |         432,914 |          248,444 |  1.74× |
| hashBlock                                         |          66,561 |           43,068 |  1.55× |
| signBlock                                         |             485 |              489 |  0.99× |
| verifyBlock                                       |             491 |              490 |     1× |
| WASM nonce attempts (including event-loop yields) |       4,894,464 |                — |      — |

The named deriveSecretKey/signBlock/verifyBlock rows measure the preserved legacy primitives (canonical derivePrivateKey/signHash/verifyHash call these). They do not measure full high-level transaction workflows. Signing and verification performance are essentially unchanged; the upstream curve arithmetic is preserved. Amount conversion, byte handling, and block hashing show the measured improvements above. The conversion rows exercise the general convert() function; nanoToRaw() adds a uint128 balance check. Work generation is measured over one million attempted nonces, including the default event-loop yields, after WASM compilation. It is not a comparison against upstream PoW and does not measure mainnet confirmation latency.

## Reproduce

```sh
npm run bench
```

To compare with upstream, install nanocurrency@2.5.0 into a separate temporary project and set `NANOPAY_BASELINE` to that installation's absolute module path before running `npm run bench`. The script prints JSON, including machine details and its measurement method. The checked-in results are in [benchmark-results.json](benchmark-results.json).

## Design choices

Exact conversions move the decimal point in a string instead of repeatedly dividing a BigNumber. Hex conversions use a precomputed byte table. Address generation decodes its input once. Proof of work calls a specialized one-block BLAKE2b compression loop in optimized C/WASM, with no per-nonce JavaScript call, hex parsing, or heap allocation. The module compiles once per JavaScript realm and gives each request separate memory.

The default work batch is 16,384 attempts. Larger batches reduce scheduling overhead and increase the maximum time before cancellation can run. The maximum batch is 1,048,576 attempts. Place long-running generation in a Worker to keep the UI/main thread responsive, and use a GPU-backed work server for sustained production work.

RPC reads use native fetch with no shared request queue or response cache. High-level writes serialize per account within a client instance. Independent calls can run in parallel. Request latency is determined mainly by the node and network; no local microbenchmark can establish that latency for a caller's deployment.

## API composition

Focused package imports keep the mnemonic word list and local WASM out of keys-only consumers. Mnemonic wallets run native Web Crypto PBKDF2 once and prederive the common path; selecting more accounts requires only hardened HMAC derivation and Nano public-key expansion. `getBalances` uses one node request, and `receiveAll` reuses the account frontier and balance returned by its own preceding submissions. These choices reduce loading and repeated work; the microbenchmarks above do not measure their end-to-end latency.
