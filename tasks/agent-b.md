# Agent B — Backend / Game Engine / Multiplayer

**DO NOT WRITE CODE UNTIL PHASE 0 IS ON `origin/main` and Agent A publishes the `PHASE_0_LOCKED` SHA.** Before then, read docs and send interface review/comments only.

## Phase 1 — exclusive owned files only

- [x] [US-13] Implement bearer Supabase JWT validation (issuer/audience/JWKS) and server-only verified `authenticatedUserId`; no raw `userId` authority.
- [x] [US-13] Implement identity sync/profile with an authorized guest or Google session.
- [x] [US-02] Implement saved team storage with exactly five validated agent prompts; prevent editing another account's team.
- [x] [US-07] Research/document original Boi-boian mechanics; implement state machine `KNOCKDOWN → REBUILD → HALFTIME → KNOCKDOWN → REBUILD → FINISHED` and side swap.
- [x] [US-07] Implement collision, throwing, pickup, dodge, chase, stack progress, stamina, hit elimination, actions/reasons, timeouts and deterministic seeded replay.
- [x] [US-07] Implement supported prompt behavior mapping and coach overrides; benchmark at least two sample prompts, bot-vs-bot and role-swapped seeds; propose final **TBD** balancing parameters for lead approval.
- [x] [US-05] Implement Easy/Medium/Hard bot presets without hidden physics advantages; `/practice/start` returns a real match.
- [x] [US-06] Implement MatchmakerDO waiting queue: pair two **different authenticated owners**, no false online user, cancellation and timeout.
- [x] [US-06] Implement MatchDO WebSockets with ticket auth, state snapshots/events, identical results, visible `COACH_ACK` and reconnect snapshot.
- [x] [US-08] Implement LedgerDO with once-per-identity starter credits, idempotent reservation/debit/settle/refund and 2-browser race tests. Keep amount **TBD** pending lead approval.
- [x] [US-09] Implement cosmetic inventory server validation and simulated ad rewards with bounded eligibility; no paid gateway.
- [x] [US-12] Implement results, replay event feed and leaderboard from trusted server state.
- [x] [US-13] Implement wallet link nonce issue/check, EIP-191 signature verification with expiry+nonce replay protection, authoritative winner lookup for C.
- [x] [US-16] Add real unit/integration tests for two-user queue, session authorization, live coach, duplicate payouts, invalid actions and disconnect/reconnect.
- [ ] [US-16] Verify server WebSocket room emits consistent state to two independent clients; make no claim of production multiplayer until deployed test passes.
- [ ] [US-11] Integrate C's `ChainAdapter.recordMatch()` at finalization on permitted path; distinguish pending/failed from confirmed chain tx; never edit `apps/worker/src/chain/**`.

## Phase 2 — backend QA / deployment

- [ ] [US-06,US-16] Deploy the Worker/SQLite Durable Objects on verified free tier; confirm production API/WSS URL, auth, queue, match, reconnect.
- [ ] [US-08,US-13] Run negative tests for cross-account state, unknown websocket users, replayed nonce, double credit claims and duplicate match settlements.
- [x] [US-07] Deliver deterministic replay/fairness report with seeds, role-swap results and known limitations.
- [ ] [US-16] Hand off production backend URL and build/test evidence to lead for locked README/env edits.

## Notes

### Branch / commit / PR
- Branch: `agent-b/backend`, based on `7612388` (Phase0 `f93769c` plus Agent A frontend).
- Commits: `d743c96` (engine, ledger, matchmaker), `113ea7d` (routes, websocket, authoritative scoring), `4327855` (task notes), `172ff66` (Durable Object `transactionSync` adapter), `ef05aa5` (HTTP read catch-up), `7cac18d` (first stack completion kept for tie-breaks), plus a docs commit recording the runtime fixes and the chain env keys.
- PR: not opened. The lead opens it at integration; see "Lead-owned changes" below for the files that are not mine.

### Worker URL / Durable Object bindings
- Not deployed. No production URL is claimed.
- Bindings as configured in Phase0 `apps/worker/wrangler.jsonc`: `MATCHMAKER`, `MATCHES`, `LEDGER`, all `new_sqlite_classes` under migration `v1`. `MATCHMAKER` is a singleton keyed `global`; `MATCHES` is keyed per match id; `LEDGER` is keyed per user id.
- Local run: `npm run dev:worker` (wrangler dev, local mode). `GET /health` returns `{ ok: true, service: 'boai-api', phase: 1 }`.

### Tested seeds, gameplay timing and fairness method
- Determinism is asserted, not assumed. `engine.test.ts` runs the same seed twice and requires byte-identical snapshots, then runs two different seeds and requires divergence.
- Role swap is asserted at the exact halftime boundary: half 1 is red `REBUILDERS`/blue `HUNTERS`, half 2 is the reverse.
- Fairness method: one `AGENT_PHYSICS` constant block for all agents. Difficulty presets (`easy`/`medium`/`hard`) change only bot reaction and aim error, never speed, stamina or throw accuracy. A test asserts all ten agents stay inside the arena and within stamina bounds.
- Final balancing constants, proposed for lead approval as `boai-blitz-v1`:
  - `halfDurationMs` 75 000, `halftimeDurationMs` 4 000, `knockdownPhaseMs` 25 000, `stackPieces` 5, `tickMs` 100.
  - `buildMsPerPiece` 8 000 with a shared team-level accumulator. This was measured, not guessed: at 1 200 the stack completed in 3.5 s of a 75 s half.
  - `starterCredits` 100, `adRewardCredits` 15, `adCooldownMs` 60 000, `practiceStake` 0.
- Draw rate after the fix: 0 of 60 seeded asymmetric matches. Before the fix it was 28 percent.

### Test commands, observed output and failures
```
npm run lint        -> exit 0
npm run typecheck   -> exit 0
npm run build       -> exit 0, Total Upload 259.27 KiB / gzip 65.16 KiB
npm test            -> 7 files, 109 tests passed
```
Per-slice observed output during development: engine 10/10, ledger 26/26, matchmaker 17/17, match/ws 30/30, routes 22/22.

Two real defects were found by parallel review and fixed by the lead, both in `game/engine.ts`:
1. `resolveBuilding` accumulated build progress into a per-agent field and zeroed it every tick, so the stack never built and every match ended 0-0. Fixed with a team-level accumulator; the test that hid it (`toBeGreaterThanOrEqual(0)`) was replaced with `toBeGreaterThan(0)` plus a 40-seed draw sweep.
2. `CHASE_BALL` was used as an `AgentAction` in three places; it is a `Behavior`. Fixed to `PICKUP_BALL`.

Three more defects were found only by running the Worker live, not by the unit suite:

3. Durable Object SQL transactions never ran. Cloudflare names the synchronous transaction `transactionSync`, but `ledgerDo.ts` and `matchDo.ts` cast `state.storage.sql` straight to `SqlStore`, whose test fake implements `transaction`. Every DO call failed at runtime with `this.sql.transaction is not a function`. Fixed with a `durableObjectSql(state)` adapter in `storage/sql.ts` that converts `transaction` to `transactionSync` and rejects ArrayBuffer rows; `ledgerDo.ts` and `matchDo.ts` import it, and the test fakes now expose `transactionSync` so the mismatch cannot come back. Commit `172ff66`. Known residue: `matchmakerDo.ts` still carries a byte-identical private copy of the adapter instead of importing the shared one, so it can drift; folding it in is a follow-up.
4. A match started over plain HTTP never advanced, because the tick interval only started on a WebSocket upgrade. `/view` and `/events` now catch up to the wall clock on read. Test: "advances a match read over plain HTTP with no socket attached". Commit `ef05aa5`.
5. `completionMs` was overwritten by a rebuild. The stack can be knocked down and rebuilt inside one half, so red could show a completion at 73 000 ms when it actually completed near 10 000 ms; `authoritativeWinner` compares `completionMs` to break ties between two sides that both completed. `resolveBuilding` now records the first completion only and ignores later rebuilds. Regression test: "keeps the first stack completion time when the stack is knocked down and rebuilt". It uses seed `s-67`, where red completes at 13 600 ms, blue knocks the stack down at 16 100 ms and red rebuilds it at 24 200 ms. The test asserts red has more than one full stack with a knockdown in between, then requires the stored time to equal the first `STACK_COMPLETE`. With the guard reverted the test fails with `expected 24200 to be 13600`; with the guard restored it passes. Commit `7cac18d`.

### Known limitations
- The 101 WebSocket upgrade path cannot be unit tested in Node because `WebSocketPair` only exists in workerd. The ticket-burn rule is asserted instead. A real two-browser WSS check still requires a deployed Worker.
- `authoritativeWinner` returns `null` when the winning side is the practice bot, so a bot id can never be handed to Agent C as a claim recipient.
- `getChainMatch().replayHash` returns `null` by Agent C's accepted limitation; the frozen ABI has no replay-hash getter.
- Gameplay is a server-ticked simulation with `setInterval` in the DO plus wall-clock catch-up via `advanceTo`, so an evicted isolate resumes rather than drifts. It has not been soak-tested beyond the unit suite.

### Hand-offs to A/C and needed lead changes
- Agent C imports `getAuthoritativeWinner` and `getVerifiedLinkedWallet` from `apps/worker/src/routes/authority.ts`. Both satisfy the frozen `AuthoritativeGameLookup` shape.
- Agent B calls `ChainAdapter.recordMatch` nowhere yet: `apps/worker/src/chain/**` is C-owned and is not present on this branch, so finalization currently leaves `chainTxHash` as `null`. This is the one unmet Phase 1 item above and it is deliberately deferred to the integration merge.
- Lead-owned files this branch touches, all requiring sign-off: `apps/worker/src/index.ts` (locked; rewrote to delegate to `handleApiRequest`, export the three DO classes, and forward `/ws/v1/matches/*`). The chain mount is intentionally left as a labelled 501 on this branch so it builds without C's module.
- Lead still needs to: mount `handleChainRequest` for `/api/v1/chain/*` and wire `WalletPage`/`RewardsPage` in the locked `App.tsx`. The six chain keys (`CHAIN_INTERNAL_SECRET`, `CHAIN_RELAYER_PRIVATE_KEY`, `BOAI_COMMITMENT_SALT`, `MONAD_RPC_URL`, `MONAD_CHAIN_ID`, `BOAI_CONTRACT_ADDRESS`) are now in the locked `.env.example` with lead sign-off and empty values; only the non-secret testnet RPC URL and chain id are filled in.
- Client contract note: the frozen `apps/web/src/lib/api.ts` `linkWallet` sends only `{address, signature}`. B resolves this server-side by re-serving the issued message from `LedgerDO /nonce/current` and verifying the signature against it, so no client change is required and nonce replay protection is intact.

### Status
READY FOR INTEGRATION for the backend surface. BLOCKED only on the two deferred items above: deployed WSS verification, and chain finalization which needs C's module present.
