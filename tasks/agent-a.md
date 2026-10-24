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

- Branch / feature commit / merge commit: `integration/trial`, `6a65685`, merged as `2b91318717f39a99c015902e55f3ba47dfc15600`. PR #4: https://github.com/arkha10/monad_hack_dev/pull/4.
- Phase0 locked SHA: 5b0d41be10674acd97e9120588ff04c28ea424d7, merged to origin/main by commit a29d453
- Frontend and backend are deployed together as Worker static assets and same-origin API at https://boai-api.arkha10-boai.workers.dev. Latest deployed Worker version: `4b7635ef-9a97-474b-a665-2af53cba8329`. `/health` returns HTTP 200 and the Phase 2 ruleset.
- Agent C Wallet and Rewards pages are mounted at `/wallet` and `/rewards`. The BOAI Sundanese 2D pixel art redesign is deployed. The Google button is disabled until Supabase frontend configuration is provisioned. Guest play uses the signed HttpOnly Secure cookie session.
- Worker production configuration includes the Monad testnet RPC, chain ID 10143, contract address, internal secret, and commitment salt. `CHAIN_RELAYER_PRIVATE_KEY` is not provisioned.
- Local QA: `npm run lint` passed, `npm run typecheck` passed, `npm run build` passed, `npm test` passed with 13 files and 167 tests, `forge test --root contracts --network monad` passed with 12 tests, and `git diff --check` passed.
- Browser QA on the HTTPS deployment: homepage and all images loaded, guest sign-in and team save passed, `/wallet` and `/rewards` rendered, guest sign-out returned 200 and cleared its Secure cookie. The post-sign-out team request returned the expected 401. No uncaught page errors were observed.
- PvP smoke used two isolated Chrome contexts on one host. Both players joined the zero-credit queue, reached the same match, opened WSS, received authoritative snapshots, and the coach command was accepted. A second remote practice match ran to `FINISHED`, returned winner, scores, replay hash, and ruleset hash. The result currently has no chain transaction hash.
- A live full-match result read returned HTTP 200. Reward eligibility returned HTTP 200 and `ineligible` for an unrelated guest account without a linked wallet. Queue join, waiting status, and leave also passed.
- Live contract evidence: address `0x5cA83f6072ABFF68fcaA84264830224B57EA12B1`, chain ID 10143, 2,926 bytes of deployed code, deployment transaction `0xf0480d5c5d9d784693719910a50a06d4358ee508fab222838951dad4e4b4d11a`, block 73,729,260, receipt status 1. [MonadScan transaction](https://testnet.monadscan.com/tx/0xf0480d5c5d9d784693719910a50a06d4358ee508fab222838951dad4e4b4d11a).
- Chain write and claim remain blocked. The contract recorder is `0x97971c36721cE32d53745457Fea44b42d397b54D`. A human must securely provision an authorized relayer secret or grant `RECORDER_ROLE` to a funded relayer and configure that secret in Cloudflare. Do not send private keys in chat.
- Google OAuth remains unavailable until the Supabase project URL, JWT settings, frontend publishable key, and Google provider are configured. Guest gameplay is live. The browser QA did not use an injected wallet or claim a reward. Testing on a separate physical device remains outstanding.
- Handoff: BLOCKED on the human owner provisioning a Monad testnet relayer with `RECORDER_ROLE` and configuring Supabase if Google login is required. The live Worker and guest gameplay are ready for review at https://boai-api.arkha10-boai.workers.dev.
