# Command-line tools

Installing nanopay includes the `nanopay` executable. Run it through your project's package tools:

```sh
npx nanopay --help
npx nanopay --version
npx nanopay convert amount --input 1.25 --from NANO --to raw
```

`NANO` means `10^30` raw. Historical lowercase `nano` means `10^24` raw. CLI amounts remain strings.

## Commands

| Command                                                                     | Purpose                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `generate seed`, `generate private`, `generate mnemonic`, `generate wallet` | Generate local secret/account material                                   |
| `derive private --from <seed> --index 0`                                    | Native seed derivation; `derive secret` is an alias                      |
| `derive public --from <private-key-or-address>`                             | Legacy public-key derivation/decoding                                    |
| `derive address --from <public-key>`                                        | Address encoding; `--legacy` selects `xrb_`                              |
| `check <item> --candidate <value>`                                          | Check seed/index/amount/hash/key/address/work/signature/threshold format |
| `convert amount --input <amount> --from <unit> --to <unit>`                 | Exact conversion                                                         |
| `hash block`, `sign block`, `verify block`, `create block`                  | Granular block operations; see `--help` for fields                       |
| `compute work --hash <root>`                                                | Local work, with optional `--threshold` and `--max-iterations`           |
| `validate work --hash <root> --work <nonce>`                                | Work verification with an optional threshold                             |

The CLI is local tooling. It has no high-level network send/receive commands; use the JavaScript client for RPC workflows. The default BerryPay endpoint therefore does not cause these CLI commands to make network requests.

## Secret-bearing commands

Generation commands print secrets to standard output. `generate wallet` uses the legacy flat wallet shape. Key-derivation and signing arguments can be retained in shell history or visible in process information. Use the programmatic API and your application's secret storage for real signing services instead of placing live private keys into a shell command.

Validation commands check their stated property. A valid key format does not prove account ownership, and valid work is not proof that a block has settled.
