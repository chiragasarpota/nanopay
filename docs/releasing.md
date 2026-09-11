# Publishing releases

The `0.0.1` bootstrap was published on September 11, 2026 under chiragasarpota. It contains version metadata only, reconstructed from root commit `e059de2264777282a3f22632c1ad78fa3a354ad8`. The `0.1.0` release introduces the Nano toolkit from the current repository sources.

Publish from the intended release commit after updating the package version and changelog. Confirm GitHub CI is green, including Windows and the real Nano dev-node integration job. Mainnet tests use dedicated funds and are run separately as described in [testing](testing.md); never replay a completed or partially completed funded test blindly.

1. Check `npm whoami --registry=https://registry.npmjs.org/`. Publishing uses the chiragasarpota account. Run `npm login --auth-type=web` if the saved login has expired.
2. Run `npm run check` to validate types, tests, browser/worker behavior, formatting and the installed package.
3. Run `npm publish --access public`. The prepublish hook also runs the full checks. Complete npm's separate publish authentication if prompted.
4. Verify the version, maintainer, dist-tag and tarball integrity with `npm view nanopay version maintainers dist-tags dist --json`, then test an installation from the registry in a fresh directory.

Check registry state before retrying a publish whose outcome is uncertain. Published versions cannot be overwritten.

The original checked bootstrap tarball is retained locally at `.git/nanopay-releases/nanopay-0.0.1.tgz`. `npm run release:bootstrap -- --dry-run` reconstructs it for inspection from a full clone without requiring that local file; a shallow clone may need `git fetch --unshallow` first. The bootstrap is already published, so do not publish that version again.

Run the package-check and bootstrap scripts through `npm run`, which supplies the npm CLI path. They launch that JavaScript file through Node on every platform, including Windows, without invoking `npm.cmd` or interpreting arguments through a shell.

The initial attempt on September 10 was delayed by npm's package-name reuse waiting period. That waiting period was resolved before the bootstrap publication.
