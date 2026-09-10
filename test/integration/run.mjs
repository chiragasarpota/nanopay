import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, appendFileSync } from 'node:fs'
import {
  NanoClient,
  accountFromPrivateKey,
  walletFromSeed,
  verifyWork,
} from '../../dist/index.js'
import { runWorkflows, submissionFault } from './workflows.mjs'

const mode = process.argv[2]
if (!['dev', 'mainnet'].includes(mode) || process.argv.length !== 3)
  throw new Error(
    'Select dev or mainnet explicitly; see docs/testing.md before running transactions',
  )
if (
  mode === 'mainnet' &&
  (!process.env.NANOPAY_TEST_RPC_URL || !process.env.NANOPAY_TEST_WS_URL)
)
  throw new Error(
    'Mainnet testing requires explicit NANOPAY_TEST_RPC_URL and NANOPAY_TEST_WS_URL',
  )
const dir = '.git/nanopay-releases'
mkdirSync(dir, { recursive: true, mode: 0o700 })
const report = `${dir}/integration-${mode}-${Date.now()}.jsonl`
const record = (value) => {
  const entry = JSON.stringify({ time: new Date().toISOString(), ...value })
  appendFileSync(report, entry + '\n', { mode: 0o600 })
  console.log(entry)
}
const fault = submissionFault(record)
const workFixtures = JSON.parse(
  readFileSync(new URL('../data/dev-work.json', import.meta.url), 'utf8'),
)
const work = ({ root, threshold }) => {
  const key = `${root.toUpperCase()}:${threshold.toLowerCase()}`
  assert.ok(workFixtures[key], `Missing dev work fixture for ${key}`)
  assert.ok(verifyWork({ root, threshold, work: workFixtures[key] }))
  return workFixtures[key]
}
const client = new NanoClient({
  rpcUrl:
    mode === 'dev'
      ? 'http://127.0.0.1:45976'
      : process.env.NANOPAY_TEST_RPC_URL,
  timeoutMs: 180000,
  fetch: fault.fetch,
  ...(mode === 'dev' ? { work } : {}),
})

try {
  let wallet
  let representative
  if (mode === 'dev') {
    const version = await client.request('version')
    assert.equal(
      version.network,
      'dev',
      'Public dev keys must never be used on another network',
    )
    assert.equal(
      version.network_identifier,
      '04270D7F11C4B2B472F2854C5A59F2A7E84226CE9ED799DE75744BD7D85FC9D9',
    )
    // Exercise the actual work RPC separately; block fixtures avoid costly mainnet-difficulty searches in CI.
    // Nano V28.2 dev epoch-2 threshold (nano/lib/constants.cpp).
    const devThreshold = 'ffc0000000000000'
    const generated = await client.generateWork('0'.repeat(64), {
      threshold: devThreshold,
    })
    assert.ok(
      verifyWork({
        root: '0'.repeat(64),
        work: generated,
        threshold: devThreshold,
      }),
    )
    // Public Nano dev-network fixture, not a mainnet secret.
    const genesis = accountFromPrivateKey(
      '34F0A37AAD20F4A260F0A5B3CB3D7FB50673212263E58A380BC10474BB039CE4',
    )
    representative = genesis.address
    record({ event: 'create-dev-voting-wallet' })
    const voting = await client.request('wallet_create')
    record({ event: 'import-public-dev-voting-key' })
    await client.request('wallet_add', {
      wallet: voting.wallet,
      key: genesis.privateKey,
      work: false,
    })
    wallet = walletFromSeed('1'.repeat(64))
    assert.equal(
      await client.getAccountInfo(wallet.account().address),
      null,
      'Start a fresh dev node for every run',
    )
    record({ event: 'fund-dev-account' })
    const funding = await client.send({
      account: genesis,
      to: wallet.account().address,
      amount: '0.000001',
    })
    record({
      event: 'dev-funded',
      hash: funding.hash,
      node: version.node_vendor,
    })
    await client.waitForConfirmation(funding.hash, { timeoutMs: 120000 })
  } else {
    const data = JSON.parse(
      readFileSync(`${dir}/live-test-wallet.json`, 'utf8'),
    )
    assert.equal(
      data.purpose,
      'Dedicated nanopay release integration tests only',
    )
    wallet = walletFromSeed(data.seed)
    assert.equal(
      await client.getAccountInfo(wallet.account().address),
      null,
      'Use an unopened dedicated account; reconcile any previous run before continuing',
    )
    const pending = await client.getReceivable(wallet.account().address)
    assert.equal(
      pending.length,
      1,
      'Use a fresh dedicated account with its single funding send',
    )
    const source = await client.getBlock(pending[0].hash)
    assert.equal(source.confirmed, true)
    assert.equal(source.subtype, 'send')
    assert.equal(source.block.link.toUpperCase(), wallet.account().publicKey)
    representative = source.block.representative
    record({
      event: 'mainnet-funding-confirmed',
      hash: pending[0].hash,
      address: wallet.account().address,
      amountRaw: pending[0].amountRaw,
    })
  }
  await runWorkflows({
    client,
    accounts: [wallet.account(), wallet.account(1)],
    representative,
    wsUrl:
      mode === 'dev' ? 'ws://127.0.0.1:45978' : process.env.NANOPAY_TEST_WS_URL,
    fault,
    record,
  })
} catch (error) {
  record({
    event: 'failed',
    name: error.name,
    message: error.message,
    cause: error.cause?.message,
  })
  process.exitCode = 1
}
