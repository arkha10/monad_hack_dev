# Agent A — Frontend Lead / Repo Coordinator

## Phase 0 — AGENT A ALONE; no Agent B/C edits until on main

- [ ] [US-15] Read all docs, confirm the human product lead/repo; publicly document exact blockers, source links and verified free-tier availability.
- [ ] [US-15] Check local Node/npm/Git/GitHub CLI/Cloudflare/Supabase/Foundry tooling (availability only; no credential guessing or unauthorized deployment).
- [ ] [US-15] Decide and lock package manager, plugin/dependency set, scripts and verified versions before installing; vet MONSKILLS readme/install source if used; no paid dependencies.
- [ ] [US-15] Bootstrap React Vite/Tailwind web, Worker+SQLite Durable Objects, Supabase auth client, Foundry contracts, scripts/tests and `.env.example` based on SPEC; commit single lockfile.
- [ ] [US-15] Write `packages/shared/src/{types,contracts,helpers,seed}.ts` matching **B2 exact signatures and stable IDs**; freeze API/events/routes; define secure winner lookup seam and auth context.
- [ ] [US-15] Add placeholder page for **all 12 public routes**, including Agent C future pages; create locked `apps/web/src/router.tsx`, `App.tsx`, `main.tsx`, `apps/worker/src/index.ts` and dispatch B vs C handlers.
- [ ] [US-15] Create B/C owned folder placeholders **only in Phase0** so each can compile without changing locked files; confirm route registry maps exact path to owner.
- [ ] [US-15] Establish no-op builds/tests only temporarily if clearly marked, then replace with real bootstrap compile/test; never claim placeholder tests are full tests.
- [ ] [US-15] Run dependency install/lint/typecheck/build/contract compile and basic dev smoke; save results.
- [ ] [US-15] Create approved `PHASE_0_LOCKED` main commit SHA; tell B/C they may branch. No Phase1 A edits until freeze approved.

## Phase 1 — exclusive frontend ownership

- [ ] [US-01] Implement real Supabase Google + anonymous Guest login, callback and session restoration; failure UX.
- [ ] [US-02] Implement five-slot prompt/team edit/save/load and supported behavior badges; label as simulation.
- [ ] [US-03] Implement animated 2D top-down arena and authoritative state viewer with score, timer, tiles, ball, 10 agents, stamina.
- [ ] [US-04] Implement coach panel with recognized instruction vocabulary and WebSocket ACK/rejection UX.
- [ ] [US-05] Implement practice selection and link to backend practice startup on `/practice`.
- [ ] [US-06] Implement `/queue` polling state and same-match navigation; never fake online opponents.
- [ ] [US-09] Implement `/shop` with purely cosmetic skins/ball effects, clearly labeled simulated ad reward, no active real top-up.
- [ ] [US-12] Implement results, match history visibility, leaderboard from API.
- [ ] [US-15] Implement homepage guided demo, navigation, responsive desktop states, errors/loading/empty state, simulated/testnet disclosures.
- [ ] [US-01,US-02,US-03,US-04,US-09,US-12,US-15] Add tests only under `apps/web/tests/{auth,team,game,shop,smoke}/**`; B/C tasks cannot edit these.

## Phase 2 — lead-led integration

- [ ] [US-15] Coordinate merge in owner-approved PRs every 30–45 minutes, verify actual changed paths, protect frozen files.
- [ ] [US-03,US-06] Lead full two-browser/two-device test against deployed Worker, not local simulated multiplayer.
- [ ] [US-14] With Agent C, record verified contract address, chain explorer transaction and live URL in **locked README** via human-approved edit.
- [ ] [US-15] Lead screenshot/video, 3-minute demo rehearsal, public repo reproducibility, production browser smoke and submission.

## Notes

- Branch / commit / PR: agent-a/frontend, Phase 0 bootstrap in progress
- Phase0 locked SHA: TBD
- Chosen package manager, pinned dependencies and build commands: npm 11.19.0, Node 26.7.0, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
- Live frontend / backend URLs: TBD
- Tests executed and observed outputs: lint, typecheck, and build passed. Shared helper test passed after fixture correction. Forge unavailable on this laptop.
- Blockers, owner approvals, limitations: Human must review and merge Phase 0 to origin/main. Cloudflare, Supabase, and wallet access remain human setup actions.
