# Application integration

## Node and TypeScript

Use Node.js 22 or newer. For an ESM TypeScript project, set `"type": "module"` in your package and use a NodeNext configuration:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Install `typescript` and `@types/node` as development dependencies. Compile with your normal TypeScript build and run the resulting JavaScript. Both ESM and CommonJS declaration modes ship with nanopay.

```js
const { createClient, nanoToRaw } = require('nanopay')
const nano = createClient()
console.log(nanoToRaw('1'))
```

The library does not load `.env` files itself. Configure environment variables through your runtime or application. Reuse a client for an account-writing service so its in-memory serialization applies across payment requests.

## Browser applications

Use a bundler to import from `nanopay` or a focused entry point. Native browser use of package specifiers requires bundling or appropriate module resolution; a raw browser cannot resolve an npm package name on its own.

```ts
import { createWallet } from 'nanopay/keys'
import { createClient } from 'nanopay/rpc'

const wallet = createWallet()
const nano = createClient()
const funds = await nano.getBalance(wallet.account().address)
```

Use HTTPS or localhost for Web Crypto. The RPC provider must allow your origin through CORS. BerryPay's public endpoint supports credential-free browser requests; choose a different node by passing `rpcUrl` when needed.

Browser code cannot use Node's `process.env` at runtime unless a build tool explicitly replaces it. Never place wallet seeds in public build-time environment variables. Obtain secret material through your application's wallet flow and keep it out of logs, URL parameters and analytics.

## Browser script bundle

The package includes `dist/nanopay.js`, an IIFE exposing `globalThis.NanoPay`. Copy that installed file to your app's public assets as part of its build:

```html
<script src="/vendor/nanopay.js"></script>
<script>
  const wallet = NanoPay.createWallet()
  document.body.textContent = wallet.account().address
</script>
```

This only displays an address. Persist the generated wallet seed appropriately before accepting funds. Pin the package version used to copy the bundle so deployment does not change cryptographic code unexpectedly.

## Focused imports

| Import                  | Intended use                              |
| ----------------------- | ----------------------------------------- |
| `nanopay/keys`          | Accounts, seeds, keys and addresses       |
| `nanopay/amounts`       | Exact conversion and units                |
| `nanopay/blocks`        | Offline state-block building and signing  |
| `nanopay/rpc`           | RPC and transaction clients               |
| `nanopay/work`          | Local WASM work generation                |
| `nanopay/mnemonic`      | BIP39 and SLIP-0010 wallets               |
| `nanopay/payments`      | Payment URI creation/parsing              |
| `nanopay/confirmations` | WebSocket confirmation streams            |
| `nanopay/legacy`        | Compatibility with upstream toolkit names |

The keys entry point does not include WASM or the mnemonic word list. Import local work only where WASM compilation and its CPU budget are supported. The full root entry includes the complete toolkit.

## Workers and other surfaces

Web Workers are tested for local work. Each worker has its own WASM module cache; use work partition options when sharing a search across workers. The library does not start workers for you.

Bun, Deno, Electron, edge/serverless and React Native support depends on their Web Crypto, fetch, BigInt and WASM capabilities. They are not all tested in CI, and no React Native polyfills are bundled. [Runtime support](../runtimes.md) distinguishes tested surfaces from expected compatibility.

## Payment service responsibilities

Keep durable records of invoices, transaction candidates and confirmed hashes. Coordinate writers across processes or devices. Monitor your provider's availability and reconcile after restarts or WebSocket gaps. These application-level responsibilities are separate from the library's local block validation and per-client write queue.
