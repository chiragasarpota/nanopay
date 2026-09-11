# Deploy the docs and publish the package

The library is published to npm as `nanopay`. The documentation is a static VitePress site deployed with Cloudflare Wrangler to [docs.nanopay.me](https://docs.nanopay.me). Publish the npm release first, then deploy the matching documentation.

Website dependencies live in the private `site/` package. Only Markdown documentation and benchmark data ship in the npm package; website configuration, fonts and built assets do not.

## Validate locally

Run from the repository root:

```sh
npm ci
npm ci --prefix site
npm run check
npm run docs:check
```

`npm run check` validates types, tests, browser and worker behavior, formatting and the installed npm artifact. `npm run docs:check` type-checks the TypeScript examples, builds the site and checks internal links, search, navigation and responsive layouts. Install Chromium with `npx playwright install chromium` if a compatible local Chrome is unavailable.

The Documentation workflow runs these site checks with `DOCS_BASE=/`, matching production. GitHub CI also checks the library on Windows, multiple Node versions, and a real Nano dev node. Mainnet funded tests are separate; do not replay them blindly. See [testing](testing.md).

## Publish the npm release

Update the package version and lockfile, date the changelog entry, and remove any upcoming-release wording. Commit the intended release and wait for CI to pass.

```sh
npm whoami --registry=https://registry.npmjs.org/
npm publish --access public --tag latest --registry=https://registry.npmjs.org/
npm view nanopay version dist-tags maintainers dist --json
```

The publishing account is `chiragasarpota`. If its login has expired, use `npm login --auth-type=web`. npm may require a separate browser authentication for publication. The prepublish hook runs the library checks.

Published versions cannot be overwritten. Check the registry before retrying an upload whose outcome is uncertain. After publication, install the exact version in a fresh project and verify its version and default-client API. See [publishing releases](releasing.md).

## Deploy with Wrangler

From the repository root:

```sh
npm exec --prefix site -- wrangler login
npm run docs:deploy
```

The deploy command uses the pinned Wrangler version in `site/package.json` and the configuration in `site/wrangler.jsonc`. Wrangler first builds the site with `DOCS_BASE=/`, then uploads `.build/docs/` to the `nanopay-docs` Worker in the `nanopay.me` Cloudflare account.

The site uses static assets with `html_handling: "none"` so existing `.html` links work directly. Missing pages return the generated `404.html` with a 404 status. Search is included in the build and requires no external search service.

The custom domain is `docs.nanopay.me`. Cloudflare manages its DNS record and HTTPS certificate when Wrangler attaches the custom domain. The zone must be active in that Cloudflare account. If an existing DNS record conflicts, resolve that specific record before retrying. No nameserver changes are needed when the zone is already active on Cloudflare.

Verify the homepage, a direct guide URL, search and theme switching after deployment. Wrangler prints the deployment URL and version ID. To inspect deployments:

```sh
npm exec --prefix site -- wrangler deployments list --config site/wrangler.jsonc
```

The GitHub documentation workflow validates changes; publishing the website is an explicit `npm run docs:deploy` step. It does not publish npm releases.

## Preview locally

```sh
npm run docs:dev
```

For a built preview:

```sh
npm run docs:build
npm run docs:preview -- --host 127.0.0.1
```

The local default is `/nanopay/`. The preview reads `.build/docs/` without caching, so rebuild and refresh to see changes. A production build uses `/`; preview that build with `DOCS_BASE=/ npm run docs:preview`.

These settings follow [Cloudflare static asset configuration](https://developers.cloudflare.com/workers/static-assets/) and [custom domain configuration](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
