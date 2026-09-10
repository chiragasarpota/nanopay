# Real-node workflow tests

Run `npm run check` for the ordinary tests, browser checks and installed-package validation. Run `npm run test:integration` with Docker running to test an actual Nano V28.2 dev node. The integration job also runs in GitHub CI.

The runner starts a fresh container from the pinned official Nano image, binds RPC and WebSocket ports 45976/45978 to loopback, and removes that container afterward. Those ports must be free. It uses public dev-network keys and refuses to initialize its voting wallet unless the node reports the expected dev network and genesis hash. No mainnet funds are involved.

The workflow covers queued sends, opening an account, single receives, bounded receiveAll, representative changes, confirmation polling, history, confirmed balances and WebSocket delivery. It then forwards real submissions and discards their accepted responses to test disconnect and cancellation recovery. Already queued writes must remain blocked; the runner confirms the exact candidate before explicitly resuming. All test funds return to the starting account.

Dev transactions use checked-in work fixtures, verified by both the library and the node. These keep CI independent of work services and expensive searches at mainnet difficulty. A separate request exercises the node's real work_generate RPC. Public transaction hashes and test outcomes are recorded under `.git/nanopay-releases/`.

## Optional mainnet validation

Mainnet testing requires explicit authorization and a separately funded, dedicated wallet. It is never part of npm test, npm publish, or CI.

The manual runner is `node test/integration/run.mjs mainnet`. Set `NANOPAY_TEST_RPC_URL` and `NANOPAY_TEST_WS_URL` to the chosen standard Nano services. It loads `.git/nanopay-releases/live-test-wallet.json`, which must contain the dedicated seed and the purpose string `Dedicated nanopay release integration tests only`. Keep that file private; never commit it or paste its seed into a command or conversation.

The first two derived accounts must be dedicated to this test. Start with one confirmed funding send to the unopened first account and an empty second account. The test refuses to handle more than 0.000001 Nano, uses the funding sender's representative for opening, moves five raw between the two accounts, and returns those funds. A supported node/work service supplies work at mainnet thresholds.

If a run fails, inspect its recorded hashes and account state before taking further action. The runner does not automatically replay a failed run or transfer funds elsewhere. A proxy must support the documented Nano RPC commands and confirmation flags; the manual test uses the unmodified client.
