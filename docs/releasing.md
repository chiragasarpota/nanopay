# Publishing the first releases

The GitHub repository has been reset. The fresh root commit `e059de2264777282a3f22632c1ad78fa3a354ad8` contains the minimal `nanopay@0.0.1` package; the current source is the `0.1.0` toolkit.

npm accepted authentication as chiragasarpota but rejected the initial publish with: `nanopay cannot be republished until 24 hours have passed.` The package was unpublished at 2026-09-10 00:39:34 UTC. The earliest retry is **2026-09-11 00:39:35 UTC**, or **04:39:35 in Dubai**. Neither release has been published yet.

1. After that time, run `npm run release:bootstrap`. This reconstructs the exact initial package from the root commit and checks that the npm user is chiragasarpota. Complete npm's browser authentication if prompted. Use `npm run release:bootstrap -- --dry-run` to inspect without publishing.
2. Verify with `npm view nanopay@0.0.1 version maintainers --json`.
3. Update the README release-status paragraph and CHANGELOG to reflect the successful bootstrap and the upcoming 0.1.0 release. Run `npm run check`, commit, and push.
4. Run `npm publish --access public`. The prepublish hook runs the full checks. Verify with `npm view nanopay version maintainers --json`.

The original checked tarball is also retained locally at `.git/nanopay-releases/nanopay-0.0.1.tgz`. The release script works from a full clone without that local file; a shallow clone may need `git fetch --unshallow` first.

The original publish failure was npm's waiting-period rule, not a repository or test failure. Publishing after the waiting period still requires npm to accept the package name and account permissions.
