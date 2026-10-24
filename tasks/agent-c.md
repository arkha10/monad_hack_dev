# Agent C — Monad Testnet Smart Contracts + Web3 Integration

**DO NOT WRITE CODE UNTIL PHASE 0 IS ON `origin/main` and Agent A publishes the `PHASE_0_LOCKED` SHA.** Before then, research official tools and review shared ABI/auth seams **without changing files**.

## Phase 1 — exclusive Web3 ownership

- [ ] [US-14] Verify live Monad Testnet chain ID, RPC URLs, explorer links, faucet requirements, current Foundry verification steps from official docs; record sources for lead.
- [ ] [US-14] Read current MONSKILLS instructions, inspect installation source for safety, and use only vetted tool skills already approved during Phase0. No dependency changes after freeze.
- [ ] [US-14] Implement `contracts/src/BOAIArena.sol` from the **frozen B2.7 ABI** with operator-restricted match commitment, once-per-match testnet demo token reward; no monetary cash conversion.
- [ ] [US-17] Contract tests: only designated recorder may submit, duplicate match rejection, repeat reward rejection, wrong/missing match rejection, reward mint/transfer accounting, event emission.
- [ ] [US-11] Implement `apps/worker/src/chain/**` ChainAdapter and `/api/v1/chain/*` handlers exactly per B2/B3; require trusted backend winner and linked-wallet auth; never trust supplied `userId`, hash or winner flag.
- [ ] [US-10] Implement `/wallet` and `apps/web/src/components/web3/**`, `apps/web/src/lib/web3/**` using existing viem deps. Request wallet signature on explicit button, verify network and display address.
- [ ] [US-11] Implement `/rewards` with operator-attested proof description, true explorer links, claim eligibility and retry-safe onchain reward claim.
- [ ] [US-17] Implement request idempotency and chain confirmation handling; distinguish `pending`, `confirmed`, `already_claimed` and `ineligible`.
- [ ] [US-10,US-11] Tests under `apps/web/tests/web3/**` only; no edits to A's UI tests or shared router.

## Phase 2 — real deployment + evidence

- [ ] [US-14] Obtain explicit human approval for deployment wallet; obtain testnet faucet funding without purchasing anything; never expose seed or private key.
- [ ] [US-14] Deploy contracts **during hackathon**, verify source where explorer allows, record deployed address, tx hash and exact explorer links.
- [ ] [US-11,US-17] End-to-end guest/player match → stored result → connect wallet → claim testnet reward once → replay claim fails; record real explorer transaction.
- [ ] [US-14] Hand off addresses, ABI and deploy commands to lead for human-approved locked README update; confirm before code freeze.

## Notes

- Branch / commit / PR: TBD
- Official testnet chain ID/RPC/explorer/faucet verified at: TBD
- Contract address, deployment block/tx and verification URL: TBD
- Wallet relayer funding method (no secrets): TBD
- Tests with observed results, known risks/limitations: TBD
