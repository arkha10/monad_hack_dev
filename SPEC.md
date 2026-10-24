# SPEC.md — BOAI: Boi-boian Online Agentic Arena

> Source of truth for the one-day Monad Blitz MVP. Status: **IMPLEMENTATION PLAN — NOT YET BUILT**. Date: 2026-10-24 (Asia/Jakarta). Product owner: BOAI team (3 people). Technical lead: Agent A, with human approval for merges, credentials, and deployment.
>
> Decision provenance: **CONFIRMED** = user decision; **CHOSEN** = proposed by assistant with user permission to optimize; **TBD** = unknown requiring discovery; **STRETCH** = intentionally not in critical path. The game's agents are **deterministic rule/preset simulations, not LLM inference**. Public UI, demo, and pitch must disclose that.

# PART A — PRD (PRD skill's strict schema)

## 1. Executive Summary

**Problem Statement.** Casual players cannot easily create and watch competing strategy-driven agents in a culturally distinctive Indonesian traditional game, while typical Web3 integrations add little trust to match results. A one-day hackathon requires an online, demonstrable prototype instead of a speculative full economy.

**Proposed Solution.** BOAI is an online 2D top-down Boi-boian arena: each team configures five independent strategy prompts, plays a deterministic simulation against three bot presets or a real online human opponent controlling another five-agent team, and issues live coach commands. A narrow Monad Testnet contract records an operator-attested match commitment and enables a **nonredeemable, testnet-only demo reward** after connecting a wallet. Credits used for PvP are off-chain and cannot be redeemed, purchased for money, or converted into the token.

**Success Criteria (release gates, not claimed measurements):**

1. Public free-tier URL serves the app, Google OAuth *and* guest login tested where credentials exist; unavailable OAuth must be clearly marked as an explicit failure/limitation, never silently replaced by a fake Google flow.
2. End-to-end: guest → edit five agent prompts → save team → bot practice on Easy/Medium/Hard → inspect result; at least two intentionally different supported prompts yield visibly different decisions in a repeatable test.
3. Two separately authenticated browser contexts on separate machines can queue, enter the **same match ID**, receive the same server-authoritative match snapshots, send coach commands, and observe the identical final result; disconnect/reconnect retains authoritative state.
4. Monad Testnet smart contract deployed **during Blitz**, source verified when explorer supports it, real transaction hash displayed in UI and README; a live testnet write is demonstrated. Fake/locally mocked transactions are never counted as passing this gate.
5. Every mandatory scripted acceptance path and security invariant passes locally and in production smoke tests; one critical failure blocks 'DONE'. Three-minute demo is reproducible from README by a new reviewer.

**Constraints:** Rp0 hard ceiling; zero paid APIs/trials requiring payment; three human teammates/three different coding agents/three laptops/one public repository; one-day sprint and submission freeze; Bahasa Indonesia primary UI; no financial cash-out; simulated model behavior; real multiplayer and at least one real Monad Testnet transaction.

**Stakeholders / approval:** One designated human product lead approves scope, PR merges, account authorizations, wallet deploy action, and final submission. Lead name, repository owner, final product URL, contract address: **TBD**.

## 2. User Experience & Functionality

### User Personas

- **Casual guest:** wants to experiment instantly without a wallet or programming.
- **Strategy builder:** writes five player prompts and coaches the team in a game.
- **Online challenger:** queues against another active user in a real match.
- **Hackathon judge:** validates the live URL, real Web3 transaction, GitHub source, and demo within three minutes.

### User Stories (numbered, owner tag, acceptance criteria)

**US-01 [A] — Login and guest onboarding.** As a newcomer, I want to sign in with Google or enter as Guest so that I can immediately create a team.
- AC: `/` shows Google and Guest; Guest creates a persistent anonymous authenticated session, not an unrestricted local flag.
- AC: Google auth redirects through `/auth/callback` and lands on `/team` when provider is configured; cancel/failure shows a recoverable error.
- AC: Refresh retains active session and correct account; different browsers cannot share a guest identity.

**US-02 [A] — Five-agent team editor.** As a player, I want five independent text prompts and a team identity so that I can customize agent behavior.
- AC: `/team` edits exactly five slots `p1`..`p5`; prompt lengths validated per shared contract; Save calls `PUT /api/v1/team` and reload reproduces content.
- AC: Team name, agent names and strategy label are visible; templates are labeled as **simulated rule-based behavior**; prompts are never described as calling an actual LLM.

**US-03 [A] — Watch an intelligible 2D match.** As a spectator, I want a top-down arena so that I can understand how the game proceeds.
- AC: `/match/:matchId` renders **ten distinct players**, ball, central stack, role indicators, timer, stack progress, stamina, eliminations, and score/status from server messages.
- AC: No local browser code may determine the winner in PvP; UI recovers a snapshot after refresh or reconnect.

**US-04 [A] — Coach during play.** As a team owner, I want to send a live team instruction so that my players change strategy without rewriting their saved prompts.
- AC: Coach input available **only during active match**; at least `ATTACK`, `DEFEND`, `REBUILD`, `DISTRACT` recognized by the shared parser vocabulary.
- AC: `COACH_SUBMIT` event is acknowledged/rejected, rate-limited, and persisted; a valid command visibly changes at least one subsequent team behavior in deterministic test.

**US-05 [B] — Three levels of practice.** As a player, I want Easy, Medium and Hard practice matches so that I can explore agent behavior.
- AC: `/api/v1/practice/start` accepts exactly `easy|medium|hard`; each produces a playable server-recognized scenario with distinct strategic presets and a result.
- AC: Practice never stakes/awards wager credits and can run under local mock mode if a cloud service is unavailable.

**US-06 [B] — Real human-vs-human matchmaking.** As a challenger, I want to meet another online player in real time so that two owners compete with their own teams.
- AC: Two **different authenticated user IDs** joining the queue pair into one `matchId` with one authoritative Durable Object; self-match and duplicate queue joins are rejected.
- AC: Both clients see one shared authoritative result; when no opponent is online the UI says `Menunggu lawan`, never pretends a bot is a real user.
- AC: WebSocket ticket is authenticated, one-time/short-lived, room-specific; a third unrelated user cannot command the match.

**US-07 [B] — Fair, replayable Boi-boian engine.** As a player, I want valid, explainable outcomes so that winning is decided by strategy instead of arbitrary animation.
- AC: One `match` contains **two short halves** (not two separate matches), with team roles switched at halftime; preset seeds produce reproducible state hashes.
- AC: Server enforces throw, pickup, dodge, stack assembly, stamina, collision, elimination and timeout; invalid actions cannot mutate state.
- AC: Server owns random seed, score, progression and result; client prompt cannot override physics, stats, or rules. Test red/blue symmetry after swapping initial conditions and report bias (threshold **TBD after research**).

**US-08 [B] — Free, nonredeemable game credits.** As a player, I want starter credits and virtual PvP stakes so that matches have lightweight stakes without transferring money.
- AC: Initial credit grant occurs **once per unique authenticated identity** (amount `TBD` until lead approves); double refresh, retry, multiple tabs cannot repeat the grant.
- AC: Stake debits/settlement are atomic and idempotent; no negative balance, own-balance editing, double payout, or lost disconnect funds; match cancellation refunds both.
- AC: UI explicitly states **virtual/noncashable/no exchange value**. Credit balances are neither minted nor withdrawable on-chain.

**US-09 [A] — Cosmetic shop and ad demo.** As a player, I want cosmetic skins/ball effects and an optional simulated ad reward so that the game has light progression.
- AC: `/shop` lists skins/effects, purchase changes only visual appearance, not speed, stamina, throw accuracy, or AI behavior.
- AC: `Tonton iklan (Simulasi)` reveals a clearly labeled internal demo animation and grants a bounded one-time demo credit reward via server; no fake actual advertiser, impression, or payout.
- AC: No actual fiat/crypto top-up is accepted. Top-up button either absent or clearly disabled as `Belum tersedia`; it must not imply transfer/payment works.

**US-10 [C] — Optional wallet connection.** As a winner, I want to connect an EVM wallet so that I can see my testnet-only reward without needing a wallet to play.
- AC: `/wallet` detects wallet provider, requests wallet permission only on user action, validates **Monad Testnet chain ID** from current official docs, prompts network switch, and shows connected address.
- AC: Never request private key or seed phrase, never upload them to server; no claim that testnet demo token is redeemable for money.

**US-11 [C] — Verifiable on-chain demo result and claim.** As a judge, I want to inspect a real Monad transaction so that blockchain use can be verified.
- AC: `BOAIArena` contract records a replay/ruleset/result commitment for an authorized completed match once; returning tx hash is confirmed on **actual Monad Testnet** explorer.
- AC: `POST /api/v1/chain/reward-claim` checks authenticated winner and linked wallet before relayer sends one idempotent testnet token demo reward; contract cannot pay twice for the same `matchId`.
- AC: `/rewards` shows blockchain state, chain ID, explorer links, failure recovery and prominent `TESTNET · TANPA NILAI UANG` label. Contract's authority and limits must be explained; hash alone does **not** cryptographically prove fair simulation.

**US-12 [A] — Match result, history and leaderboard.** As a player, I want a result screen so that I can examine my team performance.
- AC: `/results/:matchId` shows winner, roles/halves, eliminations, build progress, replay digest and individual actions where available.
- AC: `/leaderboard` renders rankings from the server, never hardcodes fictitious real users or wins.

**US-13 [B] — Identity and reconnect security.** As an online player, I want a secure session and reconnection so that actions are attributed correctly.
- AC: Worker verifies Supabase-issued JWT using verified public keys/audience/issuer and enforces ownership for team, queue, coach, wallet linking and credit operations; never trusts submitted `userId`.
- AC: Wallet linking requires a signed nonce with expiration, domain/chain check, and one-time consumption; blindly entering an address cannot authorize a reward.
- AC: Invalid/flooded requests yield explicit errors and do not modify authoritative state; reconnect rehydrates a snapshot.

**US-14 [C] — Public deployable Monad contract.** As a judge, I want to reproduce and inspect contract deployment.
- AC: Foundry unit tests pass (duplicate result/reward, unauthorized relayer, invalid match, token checks).
- AC: Deployment from team-approved wallet to Monad Testnet during event, explorer verification attempted, addresses and exact steps recorded in README through **lead-approved edit**.

**US-15 [A] — Public-ready instructions and accessible navigation.** As a judge, I want a clear guided flow so that I can judge the core experience quickly.
- AC: Navigation `login → team → practice/PvP → match → results → wallet/rewards` is discoverable, works on desktop, and labels simulated parts.
- AC: No dead-end buttons, no broken routes, no concealed mock; loading/error/empty states appear for network/auth/queue failures.

**US-16 [B] — Production gameplay verification.** As a teammate, I want evidence of passing game tests so that we can merge confidently.
- AC: Unit tests for action validity and seeded determinism; integration tests for auth/queue/settlement/reconnect; test output attached to PR.
- AC: Production two-browser match with consistent match ID and score passes before code freeze.

**US-17 [C] — Safe on-chain claim settlement.** As a player, I want a testnet reward to be claimable once so that blockchain records are consistent.
- AC: Source and tests cover authorization, reentrancy where applicable, no unauthorized minting, no double claim, replay protection, event emission, and errors from exhausted faucet balance.
- AC: Backend transaction retry does not create duplicate rewards even if API response is lost.

### Non-Goals (locked for this Blitz)

- Actual LLM inference for all ten agents, external inference billing, training ML models, or pretending presets are generative AI.
- Real money gambling/wagers, cash-out, fiat payments, purchased crypto stakes, exchange between game credits and token, real advertisements or commercial advertisers.
- Mainnet launch, token sale, secondary-market item trading, gas sponsorship for arbitrary transactions, x402 settlement, ERC-8004 registry, independent ZK fraud proofs, community dispute arbitration.
- Competitive anti-cheat beyond server-authoritative results and scoped authentication; complex performance scaling; mobile native apps.
- More than one match format, large social system, custom domain, 3D engine, complex animations; any of these can be planned as a later release only.

### Central gameplay mechanics (CHOSEN design hypotheses)

1. Each match has two timed halves with opposing role assignments: `REBUILDERS` (knock down stack then rebuild while dodging ball) vs `HUNTERS` (retrieve/throw ball and tag attackers). No character stat upgrades. Same base speed/stamina/accuracy for all agents.
2. Five autonomous controllers per team; per-player prompt maps deterministically to a supported behavior tag. Coaching can temporarily override team behavior but not saved prompts.
3. Two teams swap roles at halftime; winner computed from objective completion, then progress/time/remaining players by frozen tie-break. **Exact timings, stamina, piece count and scoring weights are TBD** pending seeded fairness tests in Phase 0/1; lock configuration before final demo.
4. Bot presets change tactics and response policies, not underlying character statistics; test with deterministic fixtures.
5. Randomness derives from explicit recorded seed; server event log serializable and replayable; UI may interpolate between authoritative snapshots.
6. Source material Boi-boian has regional variations; BOAI rule variants are product decisions, not claimed historical rules. Cite https://id.wikipedia.org/wiki/Boi-boian in README.

## 3. AI System Requirements (If Applicable)

**Nature of 'AI':** **simulated autonomous agents**, deterministic prompt-to-preset interpreter plus finite-state/game policy. UI labels `AI Agent Simulation`. Do **not** market as an LLM-driven real-time system.

**Tools/APIs:** shared typed agent commands; local policy parser and finite-state controllers; no paid LLM, no external model APIs. Coach messages map to allow-listed command vocabulary and cannot bypass physics.

**Strategy mapping:** Parse supported Indonesian/English synonyms from normalized user prompts into `BUILD_FIRST|DODGE_FIRST|DECOY|CHASE_BALL|GUARD_STACK|BALANCED`; unknown/free-text maps to `BALANCED` with a notice `Bagian instruksi tidak dikenali`. Coach input maps only to `ATTACK|DEFEND|REBUILD|DISTRACT`. The same prompt, seed, starting state and role assignment must yield the same action sequence.

**Evaluation Strategy:** scripted prompt-pair fixtures, same-seed determinism test, role swap/bias analysis across documented seeds, action validity, no identical-output fake replay for different strategy presets, seeded game completion and timeout tests. Record findings and unresolved imbalance in PR/README (not invented statistics). **Acceptance:** at least two fixture pairs show intended strategy differences; no invalid-action state corruption; fairness tolerance is **TBD** until measured.

## 4. Technical Specifications

### Architecture Overview

**CHOSEN (subject to Phase 0 free-tier verification):**

- **Web**: React + Vite + TypeScript + Tailwind, client routing, Cloudflare Pages (free).
- **Auth**: Supabase Auth with Google OAuth and `signInAnonymously()` guest; Supabase serves identity only. Profiles/balances/teams/matches can reside in Cloudflare SQLite-backed Durable Objects for minimal cross-cloud data design. Never treat user-editable localStorage as currency authority.
- **Backend**: Cloudflare Worker TypeScript handling `/api/v1/*`; Durable Objects `MatchmakerDO`, `MatchDO` and `LedgerDO` with SQLite persistence; native WebSocket to MatchDO; server-owned simulation, outcomes and balance changes. Rate-limit auth/credits/wallet calls. **Worker authentication** verifies Supabase JWT server-side.
- **Blockchain**: Solidity contract `BOAIArena` on Monad Testnet. Minimal ERC-20 *demo-only testnet token* may be included **in that contract** with authoritative testnet event + claim exactly once; no liquid/token cash economy. Foundry test/deploy/verify. Backend relayer testnet wallet gas via faucet, hidden in Worker secrets. Client uses `viem` for wallet provider reads/signature and chain details.
- **Replay**: per-match initial state + seed + versioned actions + resulting state digest in Durable Object SQLite; hash pushed on-chain by trusted relayer. This is **operator-attested auditability**, not fraud-proof decentralization.
- **Deployment**: Cloudflare Pages + Workers/Durable Objects + Supabase + Monad Testnet; accounts/identifiers **TBD**.

**Environment selection gate:** Verify that Cloudflare Pages/Workers/Durable Objects + Supabase Auth free plans are available to the team **without payment or credit card**. Any blocker: lead documents the unmet requirement and executes a clearly labeled fall-back that cannot be called production multiplayer or actual chain settlement unless real.

### Integration Points

- Supabase Auth: Google OAuth (requires Google Cloud OAuth client), anonymous guest, JWKS JWT verification. Mock: local development signed session stub **only when DEMO_AUTH_MOCK=true**; production must use actual authentication and tag mock state visibly.
- Cloudflare DO: built-in WebSocket/server authority, no need to host always-on paid Node VPS. Mock: local Wrangler/Miniflare DO running same game logic; do not secretly replace PvP with two disconnected browser simulations.
- Monad RPC: testnet JSON-RPC and explorer, current official chain ID/URL to be **verified live by Agent C**. Mock: explicit `MONAD_MOCK` local mode returning prefixed fake tx (not eligible for judging); testnet demo requires actual confirmed tx.
- Ads: internally simulated ad UI, clearly labeled `SIMULASI IKLAN`, demo reward once per server-governed eligibility window; no external ad network. Mock is the intended behavior.
- Top-up: UI shows `Belum tersedia` or no button; no external payment service. Cosmetics-only skin inventory on Worker; no smart-contract NFT requirement.

### Security & Privacy

- Valid Supabase JWT required for mutable endpoints; verify signature and claims on the server; websocket room membership enforced by one-time scoped tickets. Never trust caller-supplied `userId`, wallet or balance.
- LedgerDO serializes credit grants, debit/refund, and settle operations; atomic idempotency keyed by `matchId` + operation. No withdrawal, no on-chain conversion; default credit amounts/limits **TBD** before Phase0 freeze.
- Wallet address linking only after signed fresh nonce/challenge (domain and expiry), then bind wallet to authenticated user; backend must verify successful match and idempotent claim. Secret relayer key is provisioned through Cloudflare secrets (not repo, not logs, not chat).
- User prompts are untrusted text, never evaluated as code or inserted into LLM system prompts; cap length, escape for XSS, prevent injection into game engine or arbitrary URLs.
- Contract roles: only configured recorder can record match results/reward; operations idempotent; on-chain text contains no email, prompts, or Google account data. Use audit events and test fail-paths.
- Privacy: guest IDs distinct and ephemeral on logout/browser clear; no false promise of cross-device guest recovery. No personal data required beyond minimum OAuth profile.

## 5. Risks & Roadmap

### Phased Rollout

- **Phase 0 (Agent A alone):** scaffold/contracts/dependencies/folder structure and frozen API/shared type contracts/seed data; placeholder page for **every route**; local smoke. Other agents only read and review docs; one commit on main; changes after freeze require lead approval.
- **Phase 1 (parallel):** Agent A frontend/UI; Agent B Worker/DO game/auth/ledger/PvP; Agent C Solidity/Web3 UI/chain adapter + tests/deploy. No shared-file edits. Merge PRs every 30–45 min after lint/build and diff ownership verification.
- **Phase 2 (integration):** lead coordinates merge and config changes, production deploy, two-user game, real testnet tx, quality gates, README/contract addresses and 3-min demo rehearsal.
- **v1.1 post-event (not build):** full agent language parser, persistent ranked seasons, robust offline replays, rate-limit optimizations.
- **v2.0 post-event (not build):** independent verifiers / dispute protocol, safe agent marketplace, real LLM integration and agent identity standards after legal/security review.

### Technical Risks, mitigations and fallback

| Risk | Severity | Mitigation / honestly labeled fallback |
|---|---|---|
| A free account or credential is unavailable | Critical | Verify in Phase0; disclose blocked feature; demo Guest + bot; **do not claim Google or real PvP passes** |
| DO websocket API or deployment fails | Critical | Test two authenticated sockets before building art; keep local multiplayer as dev-only fallback; no bogus 'production' badge |
| Google OAuth consent setup not completed | High | Configure before freeze; guest stays usable and Google is clearly unavailable |
| Balance race/double claim | Critical | LedgerDO atomic/idempotent ops, auth checks, duplicate concurrent request tests |
| Match asymmetry creates systematic role bias | High | Short halves swap roles; automated seeded simulation; tune **TBD** parameters and lock ruleset |
| Prompt behavior is trivial or fake | High | Deterministic explainable parser, visible behavior tests, exact `simulated` disclosure |
| Main or testnet transactions fail | Critical | Deploy/test contract early; faucet-funded relayer; printed explorer link; **no fake tx as success** |
| 'Stake' could be understood as gambling or redeemable money | Critical | Strictly virtual nonredeemable credits; testnet trophy independent of wager; no financial deposit/cash-out |
| Dependences/art leakage cause merge conflicts | High | Agent A only setup; file ownership lists below; PR policy and frozen contracts |
| Time expires before all features | Critical | Freeze scope in favor of critical demo path; drop ads/shop before real PvP or real on-chain txn |

---

# PART B — Parallel Build Plan

## B1. Ownership matrix — exclusive paths and routes

**Owner rule:** No two columns can edit the same **file path** after Phase0. Folder notation does **not** grant broad rights outside the explicitly listed globs. Agent A is the *only editor of all paths during Phase0* to bootstrap placeholders, including future B/C files. After Phase0, Agent A's expanded access expires.

| Dimension | Agent A — frontend/lead | Agent B — backend/game | Agent C — Web3/contracts |
|---|---|---|---|
| Owned UI routes | `/`, `/auth/callback`, `/team`, `/practice`, `/queue`, `/match/:matchId`, `/results/:matchId`, `/leaderboard`, `/shop`, `/profile` | **None** of public UI routes | `/wallet`, `/rewards` |
| UI route files | `apps/web/src/routes/{Home,AuthCallback,Team,Practice,Queue,Match,Results,Leaderboard,Shop,Profile}.tsx` | — | `apps/web/src/routes/{Wallet,Rewards}.tsx` |
| UI components | `apps/web/src/components/{layout,auth,team,game,shop,stats}/**` | — | `apps/web/src/components/web3/**` |
| Frontend feature/logic | `apps/web/src/features/**`, `apps/web/src/lib/{api,auth,matchSocket,uiStore}.ts` | — | `apps/web/src/lib/web3/**` |
| Backend HTTP routes | — | `/api/v1/identity/*`, `/api/v1/team`, `/api/v1/practice/*`, `/api/v1/queue/*`, `/api/v1/matches/*`, `/api/v1/results/*`, `/api/v1/credits`, `/api/v1/shop/*`, `/api/v1/rewards/ad-demo`, `/api/v1/leaderboard`, `/api/v1/wallet/link` | `/api/v1/chain/*` only |
| Backend route files | — | `apps/worker/src/routes/**` | `apps/worker/src/chain/**` |
| Game/data | — | `apps/worker/src/{game,auth,ledger,matchmaking,storage,ws,testing}/**`, `apps/worker/test/**` | `contracts/src/**`, `contracts/test/**`, `contracts/script/**` |
| Static assets | `apps/web/public/art/**` | `apps/worker/fixtures/**` | `contracts/metadata/**` |
| Own task file | `tasks/agent-a.md` | `tasks/agent-b.md` | `tasks/agent-c.md` |
| Tests | `apps/web/tests/{auth,team,game,shop,smoke}/**` | `apps/worker/test/**` | `contracts/test/**`, `apps/web/tests/web3/**` |
| Build/deploy operation | Frontend hosting and final orchestrated QA | Worker deploy and backend smoke | Contract deploy/verify and client chain adapter |

**Precise path separation:** Agent A test folders are explicitly enumerated (`auth`, `team`, `game`, `shop`, `smoke`), while Agent C alone owns `apps/web/tests/web3/**`. No path glob overlaps across columns. `apps/worker/src/index.ts` is **locked** and delegates to A-created route mounting hooks. `apps/web/src/router.tsx` is **locked** and registers every UI route during Phase0. `apps/worker/src/chain/**` is excluded from B's named directory globs. `apps/web/src/components/ui/**` is locked (shared UI primitives), not Agent A-owned. API URL ownership denotes handler ownership, not a generated physical file.

**All other paths:** unassigned/locked until lead allocates new ownership in SPEC through a human-approved coordinated PR. New code under unnamed paths is prohibited.

### Locked files (lead only after Phase0; Agent A only during Phase0)

- `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` **if created** (one lockfile only; chosen package manager and version recorded in README).
- All `apps/*/package.json`, `packages/*/package.json` and their lockfiles if present; no unapproved dependency additions.
- `tsconfig.json`, `tsconfig.*.json`, `vite.config.*`, `tailwind.config.*`, `postcss.config.*`, `eslint.config.*`, `.prettierrc*`, `vitest.config.*`, `playwright.config.*` at any level.
- `apps/worker/wrangler.jsonc` or `apps/worker/wrangler.toml` (choose one), `apps/web/wrangler.*` and all deployment config, CI config (`.github/**`).
- `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/lib/**` (vendor only during Phase0).
- `packages/shared/**` (shared types, data interfaces, constants, events, seed data), `apps/web/src/components/ui/**` and `apps/web/src/shared/**` (shared UI/theme).
- `apps/web/src/router.tsx`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/worker/src/index.ts` (prewired route adapters).
- Root `SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `MASTER_PROMPT.md`, `.gitignore`, `.env.example`, all tracked shared env samples.
- `docs/**`, `infra/**`, `scripts/**`, `.gitmodules` if these paths are introduced.
- `tasks/agent-a.md` **except Agent A under human supervision**; `tasks/agent-b.md` exclusively Agent B; `tasks/agent-c.md` exclusively Agent C. Agent-specific task files are intentionally not shared locked docs.

**No new dependencies after Phase0** (including Solidity libraries, cloud integrations, plugins, SDKs, node packages). Any required addition is a human-reviewed scope/contract change initiated by lead. No automatic installs from third-party agent skill repositories before manual inspection.

## B2. Frozen shared contracts — exact signatures and seed IDs

**Rule:** These signatures and IDs are authoritative. Agent A writes `packages/shared/` before Phase0 merge. After freeze B/C may implement but may not change shape. If impossible, submit a proposed change to lead; no unilateral edits.

### B2.1 Shared types (specification to create as exact TypeScript declarations in `packages/shared/src/types.ts`)

```ts
export type UserId = string; // Supabase auth subject (UUID), never accepted as authority from client
export type TeamId = string;
export type MatchId = string;
export type AgentSlot = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Behavior = 'BUILD_FIRST' | 'DODGE_FIRST' | 'DECOY' | 'CHASE_BALL' | 'GUARD_STACK' | 'BALANCED';
export type CoachCommand = 'ATTACK' | 'DEFEND' | 'REBUILD' | 'DISTRACT';
export type MatchMode = 'practice' | 'pvp';
export type MatchPhase = 'QUEUE' | 'KNOCKDOWN' | 'REBUILD' | 'HALFTIME' | 'FINISHED' | 'CANCELLED';
export type Side = 'red' | 'blue';
export type SideRole = 'REBUILDERS' | 'HUNTERS';
export type AgentAction = 'MOVE_TO' | 'SPRINT' | 'DODGE' | 'PICKUP_BALL' | 'THROW' | 'PASS_BALL' | 'BUILD' | 'DISTRACT' | 'GUARD_STACK' | 'WAIT';

export interface PlayerPrompt { slot: AgentSlot; name: string; text: string; behavior: Behavior; skinId: string; }
export interface Team { id: TeamId; ownerId: UserId; name: string; agents: [PlayerPrompt, PlayerPrompt, PlayerPrompt, PlayerPrompt, PlayerPrompt]; updatedAt: string; }
export interface Vector2 { x: number; y: number; }
export interface AgentState { slot: AgentSlot; side: Side; position: Vector2; stamina: number; active: boolean; behavior: Behavior; currentAction: AgentAction; }
export interface BallState { position: Vector2; velocity: Vector2; holder: `${Side}:${AgentSlot}` | null; }
export interface StackState { position: Vector2; completed: number; total: number; knockedDown: boolean; }
export interface SideScore { buildCount: number; completionMs: number | null; eliminations: number; objectiveComplete: boolean; }
export interface MatchSnapshot {
  id: MatchId; mode: MatchMode; phase: MatchPhase; seed: string; rulesetVersion: string;
  seq: number; serverTime: string; startedAt: string | null; half: 1 | 2; remainingMs: number;
  redOwnerId: UserId; blueOwnerId: UserId | null; redRole: SideRole; blueRole: SideRole;
  agents: AgentState[]; ball: BallState; stack: StackState; redScore: SideScore; blueScore: SideScore;
  winnerSide: Side | 'draw' | null;
}
export interface MatchEvent { id: string; matchId: MatchId; seq: number; atMs: number; kind: string; actor: `${Side}:${AgentSlot}` | null; payload: Record<string, string | number | boolean | null>; }
export interface MatchResult { matchId: MatchId; winnerSide: Side | 'draw'; scores: { red: SideScore; blue: SideScore }; seed: string; replayHash: `0x${string}`; rulesetHash: `0x${string}`; resultHash: `0x${string}`; chainTxHash: `0x${string}` | null; finalizedAt: string; }
export interface CreditBalance { available: number; reserved: number; unit: 'BOAI_CREDIT'; }
export interface WalletLink { address: `0x${string}`; chainId: number; verifiedAt: string; }
export interface Cosmetic { id: string; category: 'skin' | 'throw_effect'; name: string; priceCredits: number; gameplayModifier: false; }
export interface AuthenticatedProfile { userId: UserId; displayName: string; isGuest: boolean; teamId: TeamId | null; }
export interface ApiError { error: { code: string; message: string; retryable: boolean }; }
export interface RewardClaim { matchId: MatchId; recipient: `0x${string}`; txHash: `0x${string}` | null; status: 'eligible' | 'pending' | 'confirmed' | 'already_claimed' | 'ineligible'; }
export interface ApiEnvelope<T> { data: T; requestId: string; }
```

### B2.2 Data-layer function signatures (exact; `packages/shared/src/contracts.ts`)

```ts
import type { Team, MatchSnapshot, MatchResult, MatchEvent, CreditBalance, Cosmetic, AuthenticatedProfile, Difficulty, MatchId, TeamId, CoachCommand, WalletLink, RewardClaim, ApiEnvelope } from './types';

export interface BoaiDataLayer {
  syncIdentity(): Promise<ApiEnvelope<AuthenticatedProfile>>;
  getTeam(): Promise<ApiEnvelope<Team>>;
  saveTeam(team: Pick<Team, 'name' | 'agents'>): Promise<ApiEnvelope<Team>>;
  startPractice(difficulty: Difficulty, teamId: TeamId): Promise<ApiEnvelope<{ matchId: MatchId }>>;
  joinQueue(teamId: TeamId, stakeCredits: number): Promise<ApiEnvelope<{ queueTicket: string; status: 'waiting' | 'matched'; matchId: MatchId | null }>>;
  getQueueStatus(queueTicket: string): Promise<ApiEnvelope<{ status: 'waiting' | 'matched' | 'cancelled'; matchId: MatchId | null }>>;
  leaveQueue(queueTicket: string): Promise<ApiEnvelope<{ status: 'cancelled' }>>;
  getMatch(matchId: MatchId): Promise<ApiEnvelope<MatchSnapshot>>;
  getMatchEvents(matchId: MatchId, afterSeq: number): Promise<ApiEnvelope<MatchEvent[]>>;
  createMatchSocketTicket(matchId: MatchId): Promise<ApiEnvelope<{ ticket: string; expiresAt: string }>>;
  sendCoach(matchId: MatchId, command: CoachCommand): Promise<ApiEnvelope<{ accepted: boolean; seq: number }>>;
  getResult(matchId: MatchId): Promise<ApiEnvelope<MatchResult>>;
  getCredits(): Promise<ApiEnvelope<CreditBalance>>;
  listCosmetics(): Promise<ApiEnvelope<Cosmetic[]>>;
  purchaseCosmetic(cosmeticId: string): Promise<ApiEnvelope<{ ownedCosmeticIds: string[]; balance: CreditBalance }>>;
  claimDemoAdReward(): Promise<ApiEnvelope<{ balance: CreditBalance; nextEligibleAt: string | null }>>;
  getLeaderboard(): Promise<ApiEnvelope<Array<{ teamId: TeamId; name: string; wins: number; losses: number }>>>;
  requestWalletNonce(address: `0x${string}`): Promise<ApiEnvelope<{ nonce: string; message: string; expiresAt: string }>>;
  linkWallet(address: `0x${string}`, signature: `0x${string}`): Promise<ApiEnvelope<WalletLink>>;
  getRewardEligibility(matchId: MatchId): Promise<ApiEnvelope<RewardClaim>>;
  claimTestnetReward(matchId: MatchId): Promise<ApiEnvelope<RewardClaim>>;
}

export type AuthoritativeGameLookup = {
  getAuthoritativeWinner(matchId: MatchId): Promise<string | null>;
  getVerifiedLinkedWallet(userId: string): Promise<`0x${string}` | null>;
};

export type ChainAdapter = {
  recordMatch(args: { matchId: MatchId; replayHash: `0x${string}`; resultHash: `0x${string}`; rulesetHash: `0x${string}`; winnerCommitment: `0x${string}` }): Promise<{ txHash: `0x${string}`; confirmed: boolean }>;
  claimReward(args: { matchId: MatchId; recipient: `0x${string}`; authenticatedWinnerId: string }): Promise<{ txHash: `0x${string}`; confirmed: boolean }>;
  getChainMatch(matchId: MatchId): Promise<{ exists: boolean; replayHash: `0x${string}` | null; claimed: boolean }>;
};
```

### B2.3 Helpers/signatures (exact; `packages/shared/src/helpers.ts`)

```ts
import type { AgentSlot, Behavior, CoachCommand, MatchResult, MatchSnapshot, Side, Vector2 } from './types';
export declare function parseBehavior(prompt: string): { behavior: Behavior; recognizedTerms: string[] };
export declare function parseCoachCommand(input: string): { command: CoachCommand | null; error: string | null };
export declare function normalizePrompt(input: string): string;
export declare function calculateWinner(red: MatchResult['scores']['red'], blue: MatchResult['scores']['blue']): Side | 'draw';
export declare function distance(a: Vector2, b: Vector2): number;
export declare function stableMatchDigest(snapshot: MatchSnapshot, eventHashes: string[]): `0x${string}`;
export declare function buildExplorerTxUrl(txHash: `0x${string}`): string;
export declare function assertFiveAgentSlots(slots: AgentSlot[]): boolean;
```

**Important consistency rule:** Helpers with shared signatures can be implemented **only by Agent A in Phase0**. If runtime logic requires improvements, B/C implement their private equivalents and open a change request; do not mutate helpers after freeze. `calculateWinner` is shared/reference scoring only; authoritative backend must enforce it.

### B2.4 Stable seed IDs (Phase0 lock; `packages/shared/src/seed.ts`)

```ts
export const SEED = {
  demoRedUser: '00000000-0000-4000-8000-000000000101',
  demoBlueUser: '00000000-0000-4000-8000-000000000102',
  demoRedTeam: 'team-boai-garuda',
  demoBlueTeam: 'team-boai-nusantara',
  demoPracticeMatch: 'match-boai-practice-001',
  demoPvPMatch: 'match-boai-pvp-001',
  demoRulesetVersion: 'boai-blitz-v1',
  demoSeed: 'boai-seed-20261024-001',
  agentSlots: ['p1', 'p2', 'p3', 'p4', 'p5'] as const,
  cosmetics: [
    { id: 'skin-default-red', category: 'skin', name: 'Merah Klasik', priceCredits: 0, gameplayModifier: false },
    { id: 'skin-default-blue', category: 'skin', name: 'Biru Klasik', priceCredits: 0, gameplayModifier: false },
    { id: 'effect-spark-demo', category: 'throw_effect', name: 'Percikan Demo', priceCredits: 0, gameplayModifier: false }
  ] as const,
  practicePresets: ['easy','medium','hard'] as const,
  promptSamples: [
    { id: 'prompt-build', text: 'Utamakan menyusun genting ketika aman.' },
    { id: 'prompt-dodge', text: 'Utamakan menghindari bola sebelum mendekati genting.' },
    { id: 'prompt-decoy', text: 'Alihkan perhatian penjaga agar teman bisa menyusun.' }
  ] as const
} as const;
```

All demo records are **seeded fixtures, never fake online accounts**; production real matches use fresh random UUID/ID generated server-side. Virtual starter credits, stake values, duration, fatigue costs and win-tie weights are **TBD** and must be agreed and recorded as frozen `boai-blitz-v1` before production demo. Cosmetic default zero price above is a *placeholder fixture*, not a claimed economic price.

### B2.5 Frozen REST routes and exact I/O

Base: `${API_BASE_URL}/api/v1`, bearer Supabase JWT for mutable operations. Every success returns `ApiEnvelope<T>` and failure `ApiError`, HTTP status appropriate. All request bodies/response types must match `BoaiDataLayer` signatures. Route params use `:matchId`. No invented routes by consumers.

| HTTP route (exact) | Request (data layer) | Response (data layer) | Owner |
|---|---|---|---|
| `POST /api/v1/identity/sync` | `syncIdentity()` | `AuthenticatedProfile` | B |
| `GET /api/v1/team` | `getTeam()` | `Team` | B |
| `PUT /api/v1/team` | `saveTeam({name,agents})` | `Team` | B |
| `POST /api/v1/practice/start` | `{difficulty,teamId}` | `{matchId}` | B |
| `POST /api/v1/queue/join` | `{teamId,stakeCredits}` | `{queueTicket,status,matchId}` | B |
| `GET /api/v1/queue/status?queueTicket=:queueTicket` | `getQueueStatus` | `{status,matchId}` | B |
| `POST /api/v1/queue/leave` | `{queueTicket}` | `{status}` | B |
| `GET /api/v1/matches/:matchId` | `getMatch` | `MatchSnapshot` | B |
| `GET /api/v1/matches/:matchId/events?afterSeq=:seq` | `getMatchEvents` | `MatchEvent[]` | B |
| `POST /api/v1/matches/:matchId/ws-ticket` | `createMatchSocketTicket` | `{ticket,expiresAt}` | B |
| `POST /api/v1/matches/:matchId/coach` | `{command}` | `{accepted,seq}` | B |
| `GET /api/v1/results/:matchId` | `getResult` | `MatchResult` | B |
| `GET /api/v1/credits` | `getCredits` | `CreditBalance` | B |
| `GET /api/v1/shop/items` | `listCosmetics` | `Cosmetic[]` | B |
| `POST /api/v1/shop/purchase` | `{cosmeticId}` | `{ownedCosmeticIds,balance}` | B |
| `POST /api/v1/rewards/ad-demo` | `claimDemoAdReward` | `{balance,nextEligibleAt}` | B |
| `GET /api/v1/leaderboard` | `getLeaderboard` | team records | B |
| `POST /api/v1/wallet/nonce` | `{address}` | `{nonce,message,expiresAt}` | B |
| `POST /api/v1/wallet/link` | `{address,signature}` | `WalletLink` | B |
| `GET /api/v1/chain/rewards/:matchId` | `getRewardEligibility` | `RewardClaim` | C |
| `POST /api/v1/chain/reward-claim` | `{matchId}` | `RewardClaim` | C |
| `POST /api/v1/chain/matches/record` | **internal secret-auth only**, `recordMatch(args)` | `{txHash,confirmed}` | C |

`POST /api/v1/chain/matches/record` MUST NOT be callable by ordinary public users. Agent B invokes Agent C's chain adapter through a trusted internal interface (see B3); if implemented through HTTP, authenticate with server-only secret and restrict public exposure. `recordMatch` and claim use **idempotency**; no race/multiple writes.

### B2.6 Frozen WebSocket events

**Endpoint:** `GET /ws/v1/matches/:matchId?ticket=:oneTimeTicket` (short-lived match+user scoped ticket; never JWT in URL). The client must first call `POST /api/v1/matches/:matchId/ws-ticket`. Viewer is driven by backend authoritative messages only.

```ts
export type ClientWsMessage =
  | { type: 'CLIENT_READY'; matchId: string }
  | { type: 'COACH_SUBMIT'; matchId: string; command: CoachCommand; clientMsgId: string }
  | { type: 'PING'; clientTime: number };
export type ServerWsMessage =
  | { type: 'MATCH_SNAPSHOT'; snapshot: MatchSnapshot }
  | { type: 'MATCH_EVENT'; event: MatchEvent }
  | { type: 'MATCH_COMPLETE'; result: MatchResult }
  | { type: 'COACH_ACK'; clientMsgId: string; accepted: boolean; reason: string | null }
  | { type: 'PONG'; clientTime: number; serverTime: number }
  | { type: 'ERROR'; code: string; message: string };
```

**No separate socket for queue in MVP:** `GET /api/v1/queue/status?queueTicket=...` polls while waiting; actual **match gameplay** uses genuine realtime WebSocket. Status polling interval **TBD** by load test. Every match action/coach event is server-validated.

### B2.7 Frozen Solidity public ABI / server integration (specification signatures)

```solidity
// File contracts/src/BOAIArena.sol; contract also represents a TESTNET-ONLY
// demo reward token. Exact implementation/metadata/name/symbol are TBD Phase0.
function recordMatch(bytes32 matchId, bytes32 replayHash, bytes32 resultHash,
                     bytes32 rulesetHash, bytes32 winnerCommitment) external;
function awardDemoReward(bytes32 matchId, address recipient) external;
function isMatchRecorded(bytes32 matchId) external view returns (bool);
function isRewardClaimed(bytes32 matchId) external view returns (bool);
function balanceOf(address account) external view returns (uint256);
// Both state-changing functions are RECORDER-ROLE restricted;
// emit MatchRecorded + DemoRewardAwarded events; no public faucet mint.
```

**Bridge of off-chain and on-chain identity:** backend verifies winner's authenticated identity and nonce-linked wallet; `winnerCommitment` is a nonreversible commitment computed using a server-held salt; a public observer cannot independently validate winner identity; claim is operator-mediated. `matchId` encoded to bytes32 by deterministic hashing of UTF-8 ID using a documented frozen utility. Return `chainTxHash` when confirmed. **No user balance of credit stake becomes transferable token.** Token metadata, quantity per reward, Testnet chain ID, faucet amount, gas strategy = **TBD/official verification in Phase0**.

## B3. Explicit handoff/seam matrix

| From → To | Exact crossing point | Contract | Integration/owner rule |
|---|---|---|---|
| A UI → B Identity | `POST /api/v1/identity/sync` | `syncIdentity(): AuthenticatedProfile` | A controls forms; B validates JWT |
| A Team → B persistence | `GET/PUT /api/v1/team` | `Team`, 5 fixed slots | A no direct storage writes |
| A Practice → B match | `POST /api/v1/practice/start` | `{difficulty,teamId}` → `{matchId}` | B chooses bot behavior |
| A Queue → B matchmaker | `POST /api/v1/queue/join`, `GET /api/v1/queue/status?queueTicket=...` | queue envelope | No fake human opponents |
| A Viewer → B MatchDO | `POST /api/v1/matches/:matchId/ws-ticket`, `GET /ws/v1/matches/:matchId?ticket=...` | `ServerWsMessage` | A renders authoritative snapshots |
| A Coach → B MatchDO | WS `COACH_SUBMIT` (or POST coach fallback) | `CoachCommand` | B applies at next policy boundary |
| A Results → B data | `GET /api/v1/results/:matchId` | `MatchResult` | A displays confirmed status |
| A Shop → B ledger | `GET /api/v1/shop/items`, `POST /api/v1/shop/purchase` | `Cosmetic[]`, `CreditBalance` | B ensures cosmetic only |
| C Web3 UI → B wallet auth | `POST /api/v1/wallet/nonce`, `POST /api/v1/wallet/link` | nonce+EVM signature | B verifies address ownership |
| B Game → C chain adapter | `ChainAdapter.recordMatch(args)` in `apps/worker/src/chain/**` | `{txHash,confirmed}` | B may call interface, C implements; frozen at Phase0 |
| C Claim UI → C chain API | `GET /api/v1/chain/rewards/:matchId`, `POST /api/v1/chain/reward-claim` | `RewardClaim` | C API must verify backend winner via B-provided authorized identity adapter; no trust in client match result |
| C Contract → A UI explorer | `buildExplorerTxUrl(txHash)` | tx link on `/results/:matchId` and `/rewards` | A shows link read-only; C owns wallet/reward route |
| A/B/C → lead integration | PR + task Notes + tests + URLs | ownership matrix | Lead only edits locked files after Phase0 |

**B/C auth seam prerequisite:** `apps/worker/src/index.ts` Phase0 must pass an immutable `authenticatedUserId` in trusted request context to `/api/v1/chain/*`, never from request body. B provides internal `getAuthoritativeWinner(matchId): Promise<UserId | null>` and checks wallet link via private call. Exact signature and import must be frozen in `packages/shared/src/contracts.ts`; no workaround with raw client `userId`.

## B4. Phases and synchronization

### Phase 0 — Agent A only (sequential, no Agent B/C code)

1. Read `SPEC.md`, `AGENTS.md`, `MASTER_PROMPT.md`, `tasks/agent-a.md` plus official source docs.
2. Confirm repo owner, Cloudflare free Workers/DO capabilities, Supabase Auth, Monad Testnet chain info, installed CLI/environment; report blockers to human.
3. Select package manager **TBD → commit choice**; scaffold React Vite/Tailwind web + Worker DO + Foundry contract skeleton; install **all required dependencies once**, commit lockfile. Avoid paid third-party features. No later new dependencies.
4. Create the frozen type, helper, API, WS and seed files exactly as above; fix any internal mismatch **before freeze**, with B/C review comments (read-only).
5. Set up routing with placeholder components for all **12 UI routes** (10 A, 2 C), backend route dispatch for B/C, contract skeleton/imports and basic test stubs. Configure static assets, test harness, env samples, scripts and ownership-compliant folder layout.
6. Run baseline install, lint, typecheck, build, worker dev, contract build/test with available tooling; commit Phase0 to `main` after human approval.
7. Mark `PHASE_0_LOCKED` with commit SHA in README. B/C may now start code on branch based on this SHA.

### Phase 1 — parallel (strict file isolation)

- A: UI including real Auth, team editor, rendering, coaching, results, economy cosmetic UX.
- B: Worker API, Supabase JWT authorization, Durable Objects, game engine, matchmaker, ledger, tests.
- C: Solidity contract/tests, Web3 claim UI, chain adapter, deploy/verify; testnet contract address handed to lead for locked README edits.
- Every 30–45 minutes: short PR; rebase `origin/main`; run lint/typecheck/build/scope checks; human reviews and merges; update other agents on contract/commit changes.

### Phase 2 — lead-led integration

1. Bring all branches to main; lead resolves locked changes after coordinating both owners.
2. Test public Google/Guest auth, team prompts, practice all difficulties, PvP with two browsers **on separate devices**, coach commands and reconnect.
3. Verify credits ledger race and cosmetic-only behavior; confirm ad/top-up labeling.
4. Deploy testnet contract during event, verify source, display actual transaction hash and explorer link; backend relayer secret and claim flow verified; README addresses written by lead.
5. Production smoke and 3-minute demo rehearsal; submit public repository and live URL before event freeze.

## B5. Git rules — mandatory

1. One public repo; branch per agent: `agent-a/frontend`, `agent-b/backend`, `agent-c/web3`. **No direct pushes to `main`** except approved Phase0 bootstrap by human lead.
2. Start from `origin/main`; before every PR: `git fetch origin && git rebase origin/main` (resolve only conflicts in owned files).
3. Run root scripts once bootstrapped: `npm run lint && npm run typecheck && npm run build && npm test`; for C also `forge test`; document exceptions when tools unavailable. If package manager in Phase0 is not npm, lead changes commands in locked docs before freeze.
4. Run `git diff --name-only origin/main...HEAD` and compare **every path** to owner's exact B1 column. Unowned file = STOP, revert unowned edit with human guidance; never silently move or commit it.
5. Merge **every 30–45 minutes** through pull request once review + tests pass; use `gh pr create` then human-approved merge. Agents cannot edit root docs independently.
6. If rebase/merge conflict touches a file agent does not own, **abort and notify human immediately** (`git rebase --abort` as needed). Never force push main; `git push --force-with-lease` only own branch with human policy approval.
7. Sensitive env files ignored; never commit keys, OAuth secrets, Supabase service role, testnet relayer secret or seed phrase.
8. Every PR description includes owner, US IDs, changed paths, tests run, screenshots or video, known blockers, and handoff calls.

## B6. Definition of Done and happy paths

**Hard gates:** real public URL, public repo and README, Monad Testnet deployed **during event** with explorer address, at least one real confirmed on-chain write, Google and Guest onboarding where configured, 2-browser same-match PvP, three bot levels, coach behavior, no unowned changes/secret leakage, lint/build/tests and production smoke green. No UI route can dead-end.

**End-to-end route sequence (primary judge path):**

`/` → `/team` → `/queue` (two real accounts) → `/match/:matchId` → `/results/:matchId` → `/wallet` → `/rewards`

**Secondary flow:** `/` → `/auth/callback` → `/team` → `/practice` → `/match/:matchId` → `/results/:matchId` → `/leaderboard` → `/shop` → `/profile`.

**QA checklist:**

- [ ] Google OAuth from real provider + guest session (or mark OAuth BLOCKED, do not pass), refresh and log out.
- [ ] Team has five independent persisted prompts; recognized strategies produce distinct deterministic actions.
- [ ] Practice works for Easy/Medium/Hard with one consistent game engine.
- [ ] PvP: two real accounts, queue, same match ID, same snapshots/outcome, realtime coach command, reconnect.
- [ ] Game: stacked tiles, ball collision, valid hits, stamina, side swap, timeouts, tie-break, seed replay and fairness test report.
- [ ] Credits: one-time welcome, atomic reserve/debit/settle/refund, no negative/double-pay; virtual/no value disclosure.
- [ ] Cosmetics-only shop, simulated ad properly labeled, no misleading top-up/cash-out.
- [ ] Monad: real onchain record, testnet reward one-time, unauthorized calls fail, wallet nonce signature, verified source if possible.
- [ ] Deployment: all 12 UI routes load directly, HTTP and WebSocket work over HTTPS/WSS, logs clear, no browser console errors in happy path.
- [ ] Repo: public, reproducible README, contract address + deployed-at-block link, live URL, demo screenshots and 3-minute pitch.

**Shipping priority order on failure:** P0 live web + real Monad tx + gameplay; P1 genuine two-user multiplayer + coaching + practice; P2 Google OAuth, credits and cosmetic/ad features. Do **not** call an incomplete P1 feature working in the pitch.

## B7. Open questions (TBD; resolved by lead and humans, not silently invented)

1. Public GitHub repository owner/name, GitHub CLI login availability, and three human approvers — **TBD**.
2. Cloudflare and Supabase project accounts and deploy permissions — **TBD**, needs human login.
3. Google OAuth client ID/secret, consent screen configuration and exact authorized redirects — **TBD**, requires human-owned secrets.
4. Testnet RPC, chain ID, block explorer and faucet viability on event day — **TBD until Agent C checks official docs**.
5. Testnet deployment address and signer funding — **TBD until live deployment**.
6. Exactly how many starter credits, stake size, ad credit grants, cooldown and cosmetic pricing — **TBD**; propose noncashable values only after Phase0 UI + ledger tests.
7. Exact game constants and bias tolerance (stamina, physics, durations, stack pieces, tie-break) — **TBD pending seeded balancing**.
8. Exact package manager/version, supported Node/Foundry CLI versions, provider account limits — **TBD Phase0**.
9. Public domain/host URLs, runtime secrets and status of live services — **TBD**.
10. Repository public posting and external submission account readiness — **TBD**.

## Evidence and source register (viewed 2026-10-24; check again at implementation)

- User-attached `SKILL.md` PRD schema: mandatory discovery and exact five-part PRD structure.
- User-attached Monad Blitz deck, pages 10–15: public repo, README, testnet/mainnet live deployment during event, publicly hosted app, contract address, live demo/on-chain tx and verified contract scoring; deadline.
- Official event: https://luma.com/blitz-jogja-okt-2026 (code freeze 16:30, submission 16:45 WIB, demo 17:00).
- Traditional game reference: https://id.wikipedia.org/wiki/Boi-boian (regional rules, adapted here).
- Cloudflare Workers/DO free plan + WebSockets: https://developers.cloudflare.com/workers/platform/pricing/ ; https://www.cloudflare.com/products/durable-objects/ ; https://developers.cloudflare.com/durable-objects/get-started/ .
- Supabase free Auth + anonymous and Google: https://supabase.com/pricing ; https://supabase.com/docs/guides/auth/auth-anonymous ; https://supabase.com/docs/guides/auth/social-login/auth-google .
- Vercel Functions do **not** host WebSocket servers: https://vercel.com/docs/limits .
- Monad dev docs and tools: https://docs.monad.xyz/ ; https://skills.devnads.com/ ; https://github.com/monad-developers .
- AWS Agentic Football inspiration only, not copied: https://agentic-football.aws.dev/ (full portal access may be restricted).

**All service limits, product features and numbers not identified as an engineering decision or verified in evidence remain TBD.** Repo docs must record updated research and provider caveats before launch.
