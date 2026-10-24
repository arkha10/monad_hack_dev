# BOAI — Boi-boian Online Agentic Arena

Phase 0 scaffold is ready on branch `agent-a/frontend`. It includes the React and Vite web shell, Cloudflare Worker Durable Object bindings, frozen shared TypeScript contracts, deterministic helper tests, route placeholders for all twelve routes, and a Foundry contract skeleton.

The current app is a scaffold. Backend gameplay, real authentication, WebSocket matchmaking, wallet integration, and testnet deployment are not yet claimed as working. `BOAI_CREDIT` is virtual and nonredeemable. Any testnet reward must be labeled `TESTNET · TANPA NILAI UANG`.

## Phase 0 status

- Node `v26.7.0`, npm `11.19.0`
- Package manager: npm with `package-lock.json`
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed with Vite production build and Wrangler dry run
- `npm test`: passed for shared helper contracts
- Foundry is not installed on this laptop, so `forge test` remains pending
- Cloudflare and Supabase accounts are not configured yet
- Monad Testnet verified at chain `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadscan.com`

`PHASE_0_LOCKED: 5b0d41be10674acd97e9120588ff04c28ea424d7` is now present on `origin/main`. Agent B and Agent C may begin Phase1 on their own branches.

**This folder contains planning and agent-instruction documents only. No application scaffold, app code, or deployment was created.**

BOAI = Boi-boian 5v5 agent-simulation arena on Monad Testnet. Three human teammates will use three coding agents on separate laptops to build one public hackathon repo without overlapping file edits. Main PRD and frozen interfaces: [`SPEC.md`](SPEC.md). Agent-wide rules: [`AGENTS.md`](AGENTS.md). Copy/paste lead orchestration instructions: [`MASTER_PROMPT.md`](MASTER_PROMPT.md).

## Docs layout

```text
BOAI/
├── SPEC.md              # PRD (Part A) + parallel build plan/contracts (Part B)
├── AGENTS.md            # rules every coding agent must obey
├── CLAUDE.md            # exactly @AGENTS.md and @SPEC.md
├── MASTER_PROMPT.md     # copy-paste prompt for the human-designated lead agent
├── README.md            # bootstrap guide and three starter prompts
├── .gitignore
└── tasks/
    ├── agent-a.md       # Phase 0 + frontend/lead
    ├── agent-b.md       # backend/game
    └── agent-c.md       # Monad/contracts
```

## Important requirements from event material

- Public GitHub repo, clear README, smart contract deployed **during Blitz** on Monad Testnet (Mainnet not needed), public working website and contract address in README.
- Judges reward working features, real onchain live transactions and verified contract source. Demo time is approximately **3 minutes**.
- Event schedule 2026-10-24 WIB: code start 10:15; code freeze 16:30; submission 16:45; pitching 17:00. Confirm current authoritative event announcements before acting.
- Total budget = Rp0; all external dependencies have explicitly labeled mocks for local dev; a mock cannot pass real-chain or real-PvP judging requirements.
- **No real money betting, no deposits/cash-out, no real ads**. `BOAI_CREDIT` is game-only/nonredeemable; optional testnet reward distinct. Simulated AI agent behavior must be labeled honestly.

## 0. Create the public repository (exact shell commands)

**Prerequisites:** Git and GitHub CLI `gh` installed; human authenticates via browser. Do **not** paste tokens/passwords into AI chats. On the designated lead laptop with this `BOAI/` folder (before app scaffold):

```bash
cd BOAI
gh auth login
git init -b main
git add SPEC.md AGENTS.md CLAUDE.md MASTER_PROMPT.md README.md .gitignore tasks/
git commit -m "docs: BOAI PRD and three-agent build workflow"
gh repo create BOAI --public --source=. --remote=origin --push
```

If the team account already has a `BOAI` repository, do not rerun `gh repo create`; instead add its actual URL (human supplied) and push the existing repo:

```bash
git remote add origin https://github.com/OWNER/BOAI.git
git push -u origin main
```

Replace `OWNER` with the account/organization actually created or approved by human; never invent one. Human grants write permissions to the other two teammates. Repo/remote state should be reviewed first to avoid adding a duplicate origin.

## 1. How each laptop joins

Human provides the **same verified repo URL** to all members (not a fake URL):

```bash
git clone https://github.com/OWNER/BOAI.git
cd BOAI
git fetch origin
git status
```

**Phase0:** only Agent A develops and pushes via human-approved workflow. B and C read docs and review interface contracts; no code edits. After Agent A commits `PHASE_0_LOCKED` on `origin/main`, B/C create respective branches:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
# Agent A: git switch -c agent-a/frontend
# Agent B: git switch -c agent-b/backend
# Agent C: git switch -c agent-c/web3
```

Run exactly **one** branch command per laptop; never all three on one machine.

## 2. How to start local app **after** Phase0 scaffold exists

The initial docs-only repo cannot `npm run dev` yet. Agent A Phase0 adds and tests actual scripts; anticipated workflow (replace only if actual lockfile changes documented in Phase0):

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
# Commands to start web and worker will be written and tested by Phase0 lead here:
# npm run dev:web
# npm run dev:worker
# Contract tests (requires Foundry): cd contracts && forge test
```

All exact Cloudflare Pages/Worker/DO, Supabase Auth and Foundry deploy commands, required environment variable names (without secret values), actual Monad RPC/chain/explorer and live URLs are **TBD until Phase0 research and deployment**, and must be filled in by the human-authorized lead. Never promise a one-command production deploy without account authorizations.

## 3. Required service setup checklist (human action)

- [ ] GitHub public repo and 3 teammate permissions; human approves PR merges.
- [ ] Cloudflare account with free Workers, SQLite Durable Objects and Pages available without paid plan.
- [ ] Supabase free project: enable anonymous authentication and Google login provider.
- [ ] Google Cloud OAuth client ID+secret and exact callback origins; enter secrets in provider dashboard, not repo.
- [ ] Monad Testnet faucet/chain ID/explorer verified; deployment wallet funded with faucet gas; no paid funds or mainnet.
- [ ] Provide runtime env secrets via secure provider UI, never commit them.
- [ ] Record time of contract deployment (within event), tx hash, verified explorer address and live app URL.

## 4. Three ready-to-paste starter prompts

### Starter prompt — Agent A (Frontend Lead, Phase0 owner)

```text
Saya adalah manusia anggota tim BOAI. Kamu adalah Agent A: Technical Lead + Frontend + repo coordinator. Baca seluruh README.md, MASTER_PROMPT.md, AGENTS.md, SPEC.md dan tasks/agent-a.md. Jalankan MASTER_PROMPT secara disiplin; mulai dari riset sumber primer dan audit lingkungan, lalu kerjakan Phase 0 SENDIRIAN. Jangan instruksikan B/C menulis kode sebelum Phase0 ter-merge di origin/main. Scaffold route placeholder untuk semua route, shared types/data/API/seed exact B2, semua dependency sekali saat Phase0. Setelah lint/typecheck/build smoke lolos, mintakan approval manusia untuk merge Phase0, umumkan SHA terkunci, baru beri B/C izin bekerja di branch sendiri. Selanjutnya kembangkan hanya file milik Agent A dan koordinasi integrasi. Prioritaskan URL publik, game 5v5 yang nyata, multiplayer dua manusia, live coach dan real Monad Testnet tx. UI Bahasa Indonesia, Rp0. Tanyakan hanya akses manusia yang sungguh diperlukan; jangan mengarang hasil tes/deploy.
```

### Starter prompt — Agent B (Backend/Game/Multiplayer)

```text
Kamu Agent B — Backend, authoritative game engine dan multiplayer. Baca README.md, SPEC.md (terutama B1/B2/B3/B4/B5), AGENTS.md, tasks/agent-b.md. Periksa origin/main dan Phase0 locked SHA. Jika belum ada PHASE_0_LOCKED, JANGAN TULIS KODE; hanya review kontrak dan laporkan incompatibility ke lead. Setelah Phase0 lock ada, branch agent-b/backend dan edit EKSKLUSIF jalur milik B. Bangun Worker SQLite Durable Objects, matchmaking dua akun sungguhan, real WebSocket MatchDO, input Supabase JWT terverifikasi, prompt-to-preset/coach strategy, bot 3 difficulty, 2 babak satu match, deterministic seeded 5v5 rules dan virtual nonredeemable credits. Lakukan seeded balancing untuk stamina, cooldown, waktu, tile count, role symmetry; dokumentasikan hasil dan tradeoff, jangan mengarang statistik. Terapkan B2 API/WS contracts persis; chain adapter milik C. Jalankan lint/build/tests/real two-browser production QA; rebase dan PR tiap 30-45 menit dengan ownership diff. Laporkan status/PR/handoff ke lead.
```

### Starter prompt — Agent C (Monad/Smart Contracts/Web3)

```text
Kamu Agent C — Monad Testnet Solidity/Web3 engineer. Baca README.md, SPEC.md (B1/B2/B3), AGENTS.md dan tasks/agent-c.md. Periksa origin/main dan Phase0 SHA; sebelum PHASE_0_LOCKED hanya riset dan review, JANGAN menulis kode. Setelah lock, branch agent-c/web3; edit hanya contracts/src, contracts/test, contracts/script, contracts/metadata, apps/worker/src/chain, apps/web/src/routes/{Wallet,Rewards}.tsx, apps/web/src/components/web3, apps/web/src/lib/web3, apps/web/tests/web3, tasks/agent-c.md. Riset docs.monad.xyz, Monad testnet RPC/explorer/faucet, MONSKILLS resmi dan keamanan pemasangan. Buat satu kontrak BOAIArena sesuai B2.7: operator-attested recorded match hash, mint demo reward testnet ke winner wallet sekali, akses terbatas; no cash-out, no wagering real, no paid tokens. Buat viem wallet connect + nonce signature, rewards UI, chain adapter, unit tests. Dengan izin eksplisit manusia lakukan deploy selama Blitz memakai faucet token, verifikasi source, tes TX nyata di explorer. Jangan bocorkan private key. Rebase/PR tiap 30-45 menit, lint/build/forge test, laporkan kontrak address + transaction URL ke lead supaya dia update README locked.
```

## 5. Commands for every PR (once bootstrapped)

```bash
git fetch origin
git rebase origin/main
npm run lint && npm run typecheck && npm run build && npm test
# Agent C additionally runs: (cd contracts && forge test)
git diff --name-only origin/main...HEAD
# STOP if any listed path is not exclusively assigned to your agent.
git push -u origin HEAD
gh pr create --base main --fill
```

Only after human review may an agent merge PR. On conflict outside own path, `git rebase --abort` and escalate to human. Do not force push main.

## 6. Launch / validation checklist

- `SPEC.md` B6 contains comprehensive acceptance, replay, security, balance, deployment, one-match/two-browser and testnet QA gates.
- Primary route demo: `/` → `/team` → `/queue` → `/match/:matchId` → `/results/:matchId` → `/wallet` → `/rewards`.
- Secondary bot/demo: `/` → `/team` → `/practice` → `/match/:matchId` → `/results/:matchId` → `/leaderboard` → `/shop`.
- Publish real front/back URLs, Monad Testnet contract address, deployment/claim transaction URL, explorer verification link and actual tested quick-start **after deployment**; never prefill invented values.

## Sources and compliance

- Boi-boian original game: https://id.wikipedia.org/wiki/Boi-boian
- Monad Blitz event: https://luma.com/blitz-jogja-okt-2026
- Monad official docs: https://docs.monad.xyz/
- MONSKILLS: https://skills.devnads.com/
- Cloudflare DO: https://developers.cloudflare.com/durable-objects/get-started/
- Cloudflare free pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Supabase Auth Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Auth anonymous: https://supabase.com/docs/guides/auth/auth-anonymous
- Agentic Football inspiration: https://agentic-football.aws.dev/

**Reminder:** This is a documentation deliverable. The coding agents, not this document author, must install, scaffold, deploy, and execute QA on their real machines/accounts.
