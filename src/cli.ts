#!/usr/bin/env node
/*
 * CLI derived from nanocurrency-cli by Marvin ROGER (GPL-3.0).
 * Reimplemented for nanopay by chiragasarpota, 2026-09-10.
 */
import { parseArgs } from 'node:util'
import * as nano from './index.js'

declare const __NANOPAY_VERSION__: string

const HELP = `nanopay <command> <item> [options]

  generate seed
  generate wallet
  derive secret --from <seed> [--index 0]
  derive public --from <private-key-or-address>
  derive address --from <public-key> [--legacy]
  check <seed|index|amount|hash|key|address|work|signature|threshold> --candidate <value>
  convert amount --input <amount> --from <unit> --to <unit>
  sign block --hash <hash> --secret <private-key>
  verify block --hash <hash> --public <public-key> --signature <signature>
  hash block --account <address> --previous <hash> --representative <address> --balance <raw> --link <hash-or-address>
  create block --secret <private-key> --previous <hash-or-null> --representative <address> --balance <raw> --link <hash-or-address-or-null> --work <work-or-null>
  compute work --hash <root> [--threshold <hex>] [--max-iterations <count>]
  validate work --hash <root> --work <work> [--threshold <hex>]

Amounts are strings; NANO means 10^30 raw. Legacy unit nano means 10^24 raw.
Avoid passing real private keys in shell commands because shell history may retain them.
Docs: https://github.com/chiragasarpota/nanopay
`

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      legacy: { type: 'boolean' },
      from: { type: 'string' },
      to: { type: 'string' },
      index: { type: 'string' },
      candidate: { type: 'string' },
      input: { type: 'string' },
      hash: { type: 'string' },
      secret: { type: 'string' },
      public: { type: 'string' },
      signature: { type: 'string' },
      account: { type: 'string' },
      previous: { type: 'string' },
      representative: { type: 'string' },
      balance: { type: 'string' },
      link: { type: 'string' },
      work: { type: 'string' },
      threshold: { type: 'string' },
      'max-iterations': { type: 'string' },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }
  if (values.version) {
    console.log(__NANOPAY_VERSION__)
    return
  }
  const required = (name: keyof typeof values): string => {
    const value = values[name]
    if (typeof value !== 'string' || value === '')
      throw new Error(`--${name} is required`)
    return value
  }
  const [command, item] = positionals
  if (positionals.length !== 2)
    throw new Error('Specify a command and item. Run nanopay --help.')
  let result: unknown
  switch (`${command} ${item}`) {
    case 'generate seed':
      result = await nano.generateSeed()
      break
    case 'generate wallet':
      result = await nano.createWallet()
      break
    case 'derive secret':
      result = nano.deriveSecretKey(required('from'), Number(values.index ?? 0))
      break
    case 'derive public':
      result = nano.derivePublicKey(required('from'))
      break
    case 'derive address':
      result = nano.deriveAddress(required('from'), {
        useNanoPrefix: !values.legacy,
      })
      break
    case 'convert amount':
      result = nano.convert(required('input'), {
        from: required('from') as nano.Unit,
        to: required('to') as nano.Unit,
      })
      break
    case 'sign block':
      result = nano.signBlock({
        hash: required('hash'),
        secretKey: required('secret'),
      })
      break
    case 'verify block':
      result = nano.verifyBlock({
        hash: required('hash'),
        publicKey: required('public'),
        signature: required('signature'),
      })
      break
    case 'validate work':
      result = nano.validateWork({
        blockHash: required('hash'),
        work: required('work'),
        threshold: values.threshold,
      })
      break
    case 'compute work':
      result = await nano.computeWork(required('hash'), {
        workThreshold: values.threshold,
        maxIterations:
          values['max-iterations'] === undefined
            ? undefined
            : Number(values['max-iterations']),
      })
      break
    case 'hash block':
      result = nano.hashBlock({
        account: required('account'),
        previous: required('previous'),
        representative: required('representative'),
        balance: required('balance'),
        link: required('link'),
      })
      break
    case 'create block': {
      const nullable = (name: keyof typeof values) => {
        const value = required(name)
        return value === 'null' ? null : value
      }
      result = nano.createBlock(required('secret'), {
        previous: nullable('previous'),
        link: nullable('link'),
        representative: required('representative'),
        balance: required('balance'),
        work: nullable('work'),
      } as nano.BlockData)
      break
    }
    default: {
      const checks: Record<string, (candidate: string) => boolean> = {
        seed: nano.checkSeed,
        index: (value) => nano.checkIndex(Number(value)),
        amount: nano.checkAmount,
        hash: nano.checkHash,
        key: nano.checkKey,
        address: nano.checkAddress,
        work: nano.checkWork,
        signature: nano.checkSignature,
        threshold: nano.checkThreshold,
      }
      if (command !== 'check' || !Object.hasOwn(checks, item))
        throw new Error('Unknown command. Run nanopay --help.')
      result = checks[item](required('candidate'))
    }
  }
  console.log(
    typeof result === 'object' ? JSON.stringify(result) : String(result),
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
