# Agent B — Backend / Game Engine / Multiplayer

**DO NOT WRITE CODE UNTIL PHASE 0 IS ON `origin/main` and Agent A publishes the `PHASE_0_LOCKED` SHA.** Before then, read docs and send interface review/comments only.

## Phase 1 — exclusive owned files only

- [ ] [US-13] Implement bearer Supabase JWT validation (issuer/audience/JWKS) and server-only verified `authenticatedUserId`; no raw `userId` authority.
- [ ] [US-13] Implement identity sync/profile with an authorized guest or Google session.
- [ ] [US-02] Implement saved team storage with exactly five validated agent prompts; prevent editing another account's team.
- [ ] [US-07] Research/document original Boi-boian mechanics; implement state machine `KNOCKDOWN → REBUILD → HALFTIME → KNOCKDOWN → REBUILD → FINISHED` and side swap.
- [ ] [US-07] Implement collision, throwing, pickup, dodge, chase, stack progress, stamina, hit elimination, actions/reasons, timeouts and deterministic seeded replay.
- [ ] [US-07] Implement supported prompt behavior mapping and coach overrides; benchmark at least two sample prompts, bot-vs-bot and role-swapped seeds; propose final **TBD** balancing parameters for lead approval.
- [ ] [US-05] Implement Easy/Medium/Hard bot presets without hidden physics advantages; `/practice/start` returns a real match.
- [ ] [US-06] Implement MatchmakerDO waiting queue: pair two **different authenticated owners**, no false online user, cancellation and timeout.
- [ ] [US-06] Implement MatchDO WebSockets with ticket auth, state snapshots/events, identical results, visible `COACH_ACK` and reconnect snapshot.
- [ ] [US-08] Implement LedgerDO with once-per-identity starter credits, idempotent reservation/debit/settle/refund and 2-browser race tests. Keep amount **TBD** pending lead approval.
- [ ] [US-09] Implement cosmetic inventory server validation and simulated ad rewards with bounded eligibility; no paid gateway.
- [ ] [US-12] Implement results, replay event feed and leaderboard from trusted server state.
- [ ] [US-13] Implement wallet link nonce issue/check, EIP-191 signature verification with expiry+nonce replay protection, authoritative winner lookup for C.
- [ ] [US-16] Add real unit/integration tests for two-user queue, session authorization, live coach, duplicate payouts, invalid actions and disconnect/reconnect.
- [ ] [US-16] Verify server WebSocket room emits consistent state to two independent clients; make no claim of production multiplayer until deployed test passes.
- [ ] [US-11] Integrate C's `ChainAdapter.recordMatch()` at finalization on permitted path; distinguish pending/failed from confirmed chain tx; never edit `apps/worker/src/chain/**`.

## Phase 2 — backend QA / deployment

- [ ] [US-06,US-16] Deploy the Worker/SQLite Durable Objects on verified free tier; confirm production API/WSS URL, auth, queue, match, reconnect.
- [ ] [US-08,US-13] Run negative tests for cross-account state, unknown websocket users, replayed nonce, double credit claims and duplicate match settlements.
- [ ] [US-07] Deliver deterministic replay/fairness report with seeds, role-swap results and known limitations.
- [ ] [US-16] Hand off production backend URL and build/test evidence to lead for locked README/env edits.

## Notes

- Branch / commit / PR: TBD
- Worker URL / Durable Object bindings: TBD
- Tested seed, gameplay timing and fairness method/results: TBD
- Test commands, observed output and failures: TBD
- Hand-offs to A/C and needed lead changes: TBD
