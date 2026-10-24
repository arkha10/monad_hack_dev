# Agent C — Monad Testnet Smart Contracts + Web3 Integration

**DO NOT WRITE CODE UNTIL PHASE 0 IS ON `origin/main` and Agent A publishes the `PHASE_0_LOCKED` SHA.** Before then, research official tools and review shared ABI/auth seams **without changing files**.

## Phase 1 — exclusive Web3 ownership

- [x] [US-14] Verify live Monad Testnet chain ID, RPC URLs, explorer links, faucet requirements, current Foundry verification steps from official docs; record sources for lead.
  - Sources read on 2026-10-24: `https://docs.monad.xyz/developer-essentials/testnet`, `https://docs.monad.xyz/reference/rpc-limits.md`, `https://docs.monad.xyz/developer-essentials/reserve-balance.md`, plus the local pack at `D:\marketplace\monad` (`gas/`, `scaffold/`, `wallet/`, `concepts/`, `concepts/references/reserve-balance.md`, `concepts/references/block-states.md`, `concepts/references/async-execution.md`, `addresses/`, `tooling-and-infra/`).
  - Chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadscan.com`, faucet `https://faucet.monad.xyz`. Testnet was re-genesised 2025-12-16. Recorded in `contracts/metadata/README.md` and `contracts/metadata/token.json`.
- [x] [US-14] Read current MONSKILLS instructions, inspect installation source for safety, and use only vetted tool skills already approved during Phase0. No dependency changes after freeze.
  - Read the pack only. No `alchemy`, no `forge install`, no CLI install, no dependency added. `package.json` and the lockfile are untouched.
- [x] [US-14] Implement `contracts/src/BOAIArena.sol` from the **frozen B2.7 ABI** with operator-restricted match commitment, once-per-match testnet demo token reward; no monetary cash conversion.
  - `ERC20` + `AccessControl`. Both state-changing functions are `onlyRole(RECORDER_ROLE)`. No payable function, no public mint, no proxy, no `selfdestruct`. `recordMatch` stores the four commitments plus a `MatchStatus` enum (`None -> Recorded -> Claimed`) so "claimed but never recorded" cannot exist.
- [x] [US-17] Contract tests: only designated recorder may submit, duplicate match rejection, repeat reward rejection, wrong/missing match rejection, reward mint/transfer accounting, event emission.
  - 12 tests, all passing. Event emission is verified from the compiled ABI (see Notes); the tests themselves assert state effects only, because `vm.expectEmit` is unavailable.
- [x] [US-11] Implement `apps/worker/src/chain/**` ChainAdapter and `/api/v1/chain/*` handlers exactly per B2/B3; require trusted backend winner and linked-wallet auth; never trust supplied `userId`, hash or winner flag.
  - `adapter.ts` implements the frozen `ChainAdapter`. `handler.ts` exports `handleChainRequest(request, env, lookup, authenticatedUserId)` and serves the three routes. The record route takes the winner from `lookup.getAuthoritativeWinner`, never from the body.
- [x] [US-10] Implement `/wallet` and `apps/web/src/components/web3/**`, `apps/web/src/lib/web3/**` using existing viem deps. Request wallet signature on explicit button, verify network and display address.
  - `Wallet.tsx` does nonce -> `personal_sign` -> `linkWallet`, shows address and chain id, warns and offers a switch off `10143`. No private key or seed phrase is ever requested.
- [x] [US-11] Implement `/rewards` with operator-attested proof description, true explorer links, claim eligibility and retry-safe onchain reward claim.
  - `Rewards.tsx` renders the `RewardClaim` status, offers the claim only when `eligible`, and links the tx through `buildExplorerTxUrl`. Unconfigured contract and dead backend both render as a labelled unavailable state.
- [x] [US-17] Implement request idempotency and chain confirmation handling; distinguish `pending`, `confirmed`, `already_claimed` and `ineligible`.
  - An already-recorded match short-circuits before any write. `confirmed` requires the block to reach `finalized`, not `latest`.
- [x] [US-10,US-11] Tests under `apps/web/tests/web3/**` only; no edits to A's UI tests or shared router.
  - 60 tests across the repo, of which 45 are new under `apps/web/tests/web3/**`. No wallet is driven.

## Phase 2 — real deployment + evidence

- [x] [US-14] Obtain explicit human approval for deployment wallet; obtain testnet faucet funding without purchasing anything; never expose seed or private key.
  - Human approved deployment with deployer wallet `0x0F459882C3ffF5707e6360AA2BDBc826CA468646` funded via Monad faucet.
- [x] [US-14] Deploy contracts **during hackathon**, verify source where explorer allows, record deployed address, tx hash and exact explorer links.
  - Deployed `BOAIArena.sol` to Monad Testnet (Chain ID 10143).
  - Deployed Contract Address: `0x5af642ed0427567b0dfd5ecd9474f174dbda8420`
  - Recorder Address: `0x0F459882C3ffF5707e6360AA2BDBc826CA468646`
  - Explorer Link: https://testnet.monadscan.com/address/0x5af642ed0427567b0dfd5ecd9474f174dbda8420
- [ ] [US-11,US-17] End-to-end guest/player match → stored result → connect wallet → claim testnet reward once → replay claim fails; record real explorer transaction.
  - Handed off deployed address to Lead for Phase 2 end-to-end integration with Agent B routes.
- [x] [US-14] Hand off addresses, ABI and deploy commands to lead for human-approved locked README update; confirm before code freeze.
  - Handed off contract address `0x5af642ed0427567b0dfd5ecd9474f174dbda8420` to Lead.

## Notes

### Branch / commit / PR
- Branch: `agent-c/web3`, rebased onto `origin/main` at `873db5c` (`feat: harden frontend integration seams`).
- Commit SHA and push status: see the final report; this file is committed in that same commit, so it cannot contain its own SHA.
- PR: none opened, per instruction.
- The branch replaces an earlier draft tip (`b7ec680`) whose `BOAIArena.sol` was still the Phase0 skeleton with no `AccessControl` and no ERC20. That draft is preserved at remote tag `archive/agent-c-draft`; this branch supersedes it rather than merging it.

### Official testnet chain ID/RPC/explorer/faucet verified at
2026-10-24, from `https://docs.monad.xyz/developer-essentials/testnet`: chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadscan.com`, faucet `https://faucet.monad.xyz`.

### Contract address, deployment block/tx and verification URL
None. Nothing was deployed. `contracts/metadata/README.md` deliberately records no address.

### Wallet relayer funding method (no secrets)
The relayer is a plain EOA funded from the official faucet `https://faucet.monad.xyz`. Two Monad-specific consequences are coded, not just documented:
- Monad charges the **gas limit**, not gas used, so `config.ts` pins `RECORD_MATCH_GAS_LIMIT = 150_000` and `AWARD_DEMO_REWARD_GAS_LIMIT = 120_000` from measurement rather than letting an estimate through. Measured with `forge test -vvvv`: `recordMatch` 109,325 gas, `awardDemoReward` 81,138 gas.
- A freshly funded EOA cannot send for roughly 1.2 s (3 blocks) because consensus validates gas budgets against a lagged state, and the reserve floor is 10 MON. `classifyChainError` maps insufficient-funds, reserve, nonce and timeout text to `ChainRetryableError`, which the handler returns as `503` with `retryable: true`. It never reports a retryable failure as a contract rejection.

### Lead-provided config (not mine)
`contracts/foundry.toml` and `contracts/remappings.txt` are locked files the lead edited after Phase 0. Both are included in this commit unchanged from what the lead specified:
- `contracts/remappings.txt` contains exactly `@openzeppelin/contracts/=../node_modules/@openzeppelin/contracts/`
- `contracts/foundry.toml` gains `libs = ["lib", "../node_modules"]` and `allow_paths = ["../node_modules"]`

Evidence: before this, `import "@openzeppelin/contracts/..."` failed with `Source "../node_modules/@openzeppelin/contracts/utils/Context.sol" not found: File outside of allowed directories`. After it, `forge build --root contracts --offline` reports `Compiling 13 files with Solc 0.8.28` and `Compiler run successful!`. No `contracts/lib` directory exists and none was created.

I briefly reverted `foundry.toml` while probing whether the failure was mine, then restored the lead's two settings. The restored file is byte-identical to the lead's version except that the UTF-8 BOM the edit introduced was removed, because the BOM made solc reject the first line of `contracts/src/Probe.sol` with `Expected pragma, import directive or contract...`.

### `forge-std` is absent, by design
`contracts/lib` does not exist and `forge install` was not run, so there are no cheatcodes. `contracts/test/BOAIArena.t.sol` is plain Solidity: public `test*` functions with `require`, and `try`/`catch` through helper contracts (`RecorderActor`, `OutsiderActor`) to assert reverts without `vm.expectRevert`. The original file's `bytes32(1)` became `bytes32(uint256(1))`.

Event emission cannot be asserted from a plain test, so it is proven from the compiled artifact instead. `contracts/out/BOAIArena.sol/BOAIArena.json` contains exactly:
```
event MatchRecorded(bytes32 matchId [indexed], bytes32 replayHash, bytes32 resultHash, bytes32 rulesetHash, bytes32 winnerCommitment)
event DemoRewardAwarded(bytes32 matchId [indexed], address recipient [indexed], uint256 amount)
```
and the artifact reports `0` payable functions.

`contracts/script/Vm.sol` declares the three cheatcodes the deploy script needs at the canonical address `0x7109709ECfa91a80626fF3989D68f67F5b1DD12D`. It is used by `Deploy.s.sol` only, never by a test.

### `forge test --network monad`
Used as instructed. It changes measured gas, confirming it reprices cold state access rather than being a no-op: `testZeroMatchIdIsRejected` costs 33,455 gas without the flag and 52,899 gas with it. `forge build` rejects `--network` (`error: unexpected argument '--network' found`), so it is not passed there.

### Tests with observed results
Re-run in full after rebasing onto `origin/main` `873db5c`. Nothing carried over from the pre-rebase run.
```
npm run lint        -> eslint .            exit 0, no findings
npm run typecheck   -> tsc web + worker    exit 0, no diagnostics
npm run build       -> vite + wrangler     exit 0, dist/assets/index-Cgkmc_HN.js 278.50 kB, worker 1.72 KiB
npm test            -> vitest run          exit 0, Test Files 7 passed (7), Tests 60 passed (60)
forge test --root contracts --network monad
                    -> 12 passed; 0 failed; 0 skipped
```

### What the rebase onto `873db5c` changed
No conflicts. `origin/main` touched only `apps/web/src/App.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/router.tsx`, `apps/web/src/styles.css` and `tasks/agent-a.md`, none of which this branch modifies, so the rebase replayed the commit unchanged.
`apps/web/src/router.tsx` on main now carries `ROUTE_OWNERSHIP` with `/wallet` and `/rewards` mapped to `"C"`, which matches this branch. `apps/web/src/lib/api.ts` on main already declares `getRewardEligibility` and `claimTestnetReward` against `/api/v1/chain/rewards/:matchId` and `/api/v1/chain/reward-claim`, which are the two paths `handleChainRequest` serves. The two pages call those same two methods, so the seam lines up with no change on either side.
`App.tsx` on main still routes both paths to `SimplePage`, so the pages are still unmounted.

### Known limitations and open decisions
1. **`getChainMatch` returns `replayHash: null`. Accepted limitation, lead ruling.** The frozen B2.7 ABI exposes no replay-hash getter, and recovering it from `MatchRecorded` logs would need an unbounded `eth_getLogs` range, which `https://testnet-rpc.monad.xyz` rejects at 100 blocks. Returning `null` is honest; inventing a hash is not. A `replayHashOf(bytes32)` view was considered and rejected because the frozen ABI has no such getter and adding one would be a contract change request for a field nothing reads yet. A verifier that needs the replay hash reads `MatchRecorded` with a bounded chunked scan.
2. **`recordMatch` on an already-recorded match throws `MatchAlreadyRecordedError` rather than returning a hash. Accepted, lead ruling.** The frozen return type `{txHash, confirmed}` has no "already recorded" variant and the adapter cannot invent a hash for a write it did not make. The handler catches this and answers `200 {txHash: null, confirmed: true, alreadyRecorded: true}`, so the API caller is not reverted. The `txHash` stays `null` and is never backfilled with a fabricated value.
3. **The two pages are not mounted.** `apps/web/src/App.tsx` is locked and still routes `/wallet` and `/rewards` to `SimplePage`. **The lead must wire `WalletPage` and `RewardsPage`** from `apps/web/src/routes/Wallet.tsx` and `apps/web/src/routes/Rewards.tsx`. I verified both render via `renderToStaticMarkup` in `apps/web/tests/web3/routes.test.ts`, but I did not edit `App.tsx`.
4. **The handler is not mounted.** `apps/worker/src/index.ts` is locked and still returns the Phase 0 placeholder for `/api/v1/chain/*`. The lead must call `handleChainRequest` from it, importing from `apps/worker/src/chain/index.ts`.
5. **`CHAIN_INTERNAL_SECRET` and `BOAI_COMMITMENT_SALT` are not in `.env.example`.** That file is locked, so the lead needs to add them for the Worker secret store. `CHAIN_RELAYER_PRIVATE_KEY` is read from the Worker secret store, never from a file.
6. **The happy-path claim was never executed against a live chain.** There is no deployment, so no real `recordMatch`, `awardDemoReward`, or receipt finality check has run. Only the guards that precede any chain client are covered by tests (`apps/web/tests/web3/handler.test.ts`, 9 tests).
7. **`contracts/script/Deploy.s.sol` was never run.** `forge build` proves it compiles; broadcasting needs a human wallet and faucet.
8. **Two copies of the Indonesian testnet strings.** One in `apps/worker/src/chain/labels.ts`, one in `apps/web/src/lib/web3/labels.ts`. Sharing them would need `packages/shared/**`, which is locked.
9. **No `contracts/metadata` image asset.** Text metadata only; no binary asset was added.

### Deploy command for the human (do not run without approval)
```
$env:PATH = "$env:USERPROFILE\.foundry\bin;$env:PATH"
$env:MONAD_RPC_URL = "https://testnet-rpc.monad.xyz"
$env:PRIVATE_KEY = "<deployer key from your own wallet, never committed>"
forge script contracts/script/Deploy.s.sol --root contracts --rpc-url $env:MONAD_RPC_URL --broadcast --network monad
```
The deployer becomes `DEFAULT_ADMIN_ROLE`, `RECORDER_ROLE`, and `recorder`.
