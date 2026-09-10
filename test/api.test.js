import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as nano from '../dist/index.js'
import * as legacy from '../dist/legacy.js'
const seed = '0'.repeat(64)
const account = nano.accountFromSeed(seed)
const previous = '1'.repeat(64)
const base = {
  account: account.address,
  previous,
  representative: account.address,
  balanceRaw: nano.nanoToRaw('2'),
}

test('granular key functions agree with all upstream derivation vectors', () => {
  const vectors = JSON.parse(
    readFileSync(new URL('./upstream/data/valid_keys.json', import.meta.url)),
  )
  for (const vector of vectors) {
    const key = nano.derivePrivateKey(vector.seed, vector.index)
    assert.equal(key, vector.secretKey)
    const recovered = nano.accountFromPrivateKey(key)
    assert.equal(recovered.publicKey, vector.publicKey)
    assert.deepEqual(
      recovered,
      nano.walletFromSeed(vector.seed).account(vector.index),
    )
    assert.equal(
      nano.publicKeyFromAddress(recovered.address),
      recovered.publicKey,
    )
    assert.equal(nano.addressFromPrivateKey(key), recovered.address)
  }
  assert.throws(() => nano.derivePublicKey(account.address), /Private key/)
  assert.throws(() => nano.publicKeyFromAddress(account.privateKey), /Address/)
  assert.equal(
    nano.normalizeAddress(account.address.replace('nano_', 'xrb_')),
    account.address,
  )
  assert.throws(() => nano.derivePrivateKey(seed, 2 ** 32))
  assert.ok(nano.isValidPrivateKey(nano.derivePrivateKey(seed, 2 ** 32 - 1)))
})
test('wallets contain multiple deterministic accounts; random generation is synchronous', () => {
  const wallet = nano.createWallet()
  assert.ok(nano.isValidSeed(wallet.seed))
  assert.deepEqual(wallet.account(), nano.accountFromSeed(wallet.seed))
  assert.notEqual(wallet.account().address, wallet.account(1).address)
  assert.ok(Object.isFrozen(wallet))
  assert.ok(Object.isFrozen(wallet.account()))
  assert.ok(nano.isValidPrivateKey(nano.generatePrivateKey()))
  assert.notEqual(
    nano.createAccount().privateKey,
    nano.createAccount().privateKey,
  )
})
test('BIP39/SLIP-0010 matches official Nano mnemonic test vectors', async () => {
  const mnemonic =
    'edge defense waste choose enrich upon flee junk siren film clown finish luggage leader kid quick brick print evidence swap drill paddle truly occur'
  const options = { passphrase: 'some password' }
  const bip39Seed = await nano.deriveMnemonicSeed(mnemonic, options)
  assert.equal(
    bip39Seed.toLowerCase(),
    '0dc285fde768f7ff29b66ce7252d56ed92fe003b605907f7a4f683c3dc8586d34a914d3c71fc099bb38ee4a59e5b081a3497b7a323e90cc68f67b5837690310c',
  )
  const wallet = await nano.walletFromMnemonic(mnemonic, options)
  const keys = [
    '3be4fc2ef3f3b7374e6fc4fb6e7bb153f8a2998b3b3dab50853eabe128024143',
    'ce7e429e683d652446261c17a96da9ed1897aea96c8046f2b8036f6b05cb1a83',
    '1257df74609b9c6461a3f4e7fd6e3278f2ddcf2562694f2c3aa0515af4f09e38',
  ]
  const addresses = [
    'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d',
    'nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz',
    'nano_3b5fnnerfrkt4me4wepqeqggwtfsxu8fai4n473iu6gxprfq4xd8pk9gh1dg',
  ]
  for (let index = 0; index < 3; index++) {
    assert.equal(wallet.account(index).privateKey.toLowerCase(), keys[index])
    assert.equal(
      nano.deriveMnemonicPrivateKey(bip39Seed, index),
      wallet.account(index).privateKey,
    )
    assert.equal(wallet.account(index).address, addresses[index])
  }
  const short = await nano.walletFromMnemonic(
    'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade',
  )
  assert.equal(
    short.account().address,
    'nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr',
  )
  assert.throws(() => wallet.account(2 ** 31), /index/)
  assert.ok(nano.isValidPrivateKey(wallet.account(2 ** 31 - 1).privateKey))
  assert.throws(() => nano.derivePrivateKey(bip39Seed), /Seed/)
  assert.throws(() => nano.deriveMnemonicPrivateKey(seed), /BIP39 seed/)
})
test('mnemonic entropy round trips and passphrases remain distinct from native seeds', async () => {
  for (const words of [12, 15, 18, 21, 24]) {
    const phrase = nano.generateMnemonic({ words })
    assert.equal(phrase.split(' ').length, words)
    assert.ok(nano.isValidMnemonic(phrase))
    assert.equal(nano.entropyToMnemonic(nano.mnemonicToEntropy(phrase)), phrase)
  }
  const phrase = nano.entropyToMnemonic(seed)
  assert.equal(nano.mnemonicToEntropy(phrase), seed)
  assert.notEqual(
    (await nano.walletFromMnemonic(phrase)).account().address,
    account.address,
  )
  assert.notEqual(
    await nano.deriveMnemonicSeed(phrase),
    await nano.deriveMnemonicSeed(phrase, { passphrase: 'extra' }),
  )
  assert.equal(
    await nano.deriveMnemonicSeed('  ' + phrase.split(' ').join('  ') + '  '),
    await nano.deriveMnemonicSeed(phrase),
  )
  assert.equal(nano.isValidMnemonic('abandon '.repeat(12)), false)
  assert.equal(nano.isValidMnemonic(null), false)
  await assert.rejects(nano.walletFromMnemonic('not a valid phrase'))
  assert.throws(() => nano.entropyToMnemonic('00'))
})
test('unsigned and signed builders agree with the inherited Nano protocol implementation', () => {
  const unsigned = nano.buildSendBlock({
    ...base,
    to: account.address,
    amount: '0.125',
  })
  assert.equal(Object.hasOwn(unsigned, 'signature'), false)
  assert.equal(unsigned.balance, nano.nanoToRaw('1.875'))
  const signed = nano.signBlock(unsigned, account.privateKey)
  assert.equal(nano.verifyBlock(signed), true)
  assert.deepEqual(
    signed,
    legacy.createSendBlock({
      ...base,
      privateKey: account.privateKey,
      to: account.address,
      amount: '0.125',
    }).block,
  )
  assert.deepEqual(
    nano.attachSignature(
      unsigned,
      nano.signHash(nano.hashBlock(unsigned), account.privateKey),
    ),
    signed,
  )
  assert.equal(nano.verifyBlock({ ...signed, balance: '0' }), false)
  assert.equal(
    nano.verifyHash({ hash: 'bad', signature: 'bad', publicKey: 'bad' }),
    false,
  )
  assert.throws(
    () => nano.signBlock(unsigned, nano.createAccount().privateKey),
    /does not match/,
  )
  assert.throws(
    () => nano.attachSignature(unsigned, '0'.repeat(128)),
    /signature/,
  )
  assert.equal(
    Object.hasOwn(
      nano.signBlock(
        { ...unsigned, privateKey: 'extra secret' },
        account.privateKey,
      ),
      'privateKey',
    ),
    false,
  )
  const raw = nano.createSendBlock({
    ...base,
    privateKey: account.privateKey,
    to: account.address,
    amountRaw: nano.nanoToRaw('0.125'),
  })
  assert.deepEqual(raw.block, signed)
})
test('builders reject amount ambiguity, impossible state transitions and uint128 overflow', () => {
  for (const invalid of [
    { amount: '0' },
    { amount: '3' },
    {},
    { amount: '1', amountRaw: '1' },
  ])
    assert.throws(() =>
      nano.buildSendBlock({ ...base, to: account.address, ...invalid }),
    )
  assert.throws(() =>
    nano.buildSendBlock({
      ...base,
      previous: nano.ZERO_HASH,
      to: account.address,
      amount: '1',
    }),
  )
  assert.throws(() =>
    nano.buildChangeBlock({ ...base, previous: nano.ZERO_HASH }),
  )
  assert.throws(() =>
    nano.buildReceiveBlock({
      ...base,
      sourceHash: previous,
      amountRaw: '1',
      balanceRaw: ((1n << 128n) - 1n).toString(),
    }),
  )
  assert.throws(() =>
    nano.buildReceiveBlock({
      ...base,
      previous: null,
      sourceHash: previous,
      amountRaw: '1',
    }),
  )
  const open = nano.buildReceiveBlock({
    ...base,
    previous: null,
    balanceRaw: '0',
    sourceHash: previous,
    amountRaw: '1',
  })
  assert.equal(nano.getWorkRoot(open), account.publicKey)
  assert.equal(nano.getWorkRoot(nano.buildChangeBlock(base)), previous)
})
test('canonical local work supports cancellation and validates attachment', async () => {
  const block = nano.buildChangeBlock(base)
  const work = await nano.generateWork(previous, {
    threshold: '0000000000000000',
    maxIterations: 1,
  })
  assert.equal(work, '0000000000000000')
  assert.equal(
    nano.verifyWork({ root: previous, work, threshold: '0000000000000000' }),
    true,
  )
  assert.equal(
    nano.attachWork(block, work, { threshold: '0000000000000000' }).work,
    work,
  )
  assert.equal(block.work, null)
  assert.throws(() => nano.attachWork(block, work), /work/)
  assert.equal(nano.verifyWork({ root: 'bad', work }), false)
  await assert.rejects(
    nano.generateWork(previous, { signal: AbortSignal.abort() }),
    { name: 'AbortError' },
  )
})
test('payment URIs encode raw exactly and preserve Unicode labels', () => {
  const uri = nano.createPaymentUri({
    address: account.address,
    amount: '1.25',
    label: 'Coffee ☕',
    message: 'Thanks & cheers',
  })
  assert.match(uri, /amount=1250000000000000000000000000000/)
  assert.deepEqual(nano.parsePaymentUri(uri), {
    address: account.address,
    amount: '1.25',
    amountRaw: nano.nanoToRaw('1.25'),
    label: 'Coffee ☕',
    message: 'Thanks & cheers',
  })
  assert.equal(
    nano.parsePaymentUri(uri.replace('nano:', 'nano://')).address,
    account.address,
  )
  for (const suffix of [
    '?amount=1&amount=2',
    '?amount=0.1',
    '?amount=-1',
    '?amount=01',
    '#fragment',
    '?unknown=1',
  ])
    assert.throws(() =>
      nano.parsePaymentUri('nano:' + account.address + suffix),
    )
  assert.throws(() => nano.parsePaymentUri('https://node.example'))
})

test('payment URI accepts explicit raw and preserves question marks inside query values', () => {
  assert.equal(
    nano.parsePaymentUri(
      nano.createPaymentUri({ address: account.address, amountRaw: '1' }),
    ).amountRaw,
    '1',
  )
  assert.throws(
    () =>
      nano.createPaymentUri({
        address: account.address,
        amount: '1',
        amountRaw: '1',
      }),
    /not both/,
  )
  assert.equal(
    nano.parsePaymentUri('nano:' + account.address + '?label=why?yes').label,
    'why?yes',
  )
})
