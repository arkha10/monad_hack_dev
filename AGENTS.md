# AGENTS.md — Mandatory BOAI Collaboration Rules

All coding agents **must read `SPEC.md`, `AGENTS.md`, their `tasks/agent-?.md`, and `MASTER_PROMPT.md`** before editing. The human approver has final authority. Only produce software when a human uses these documents to instruct the coding agent; these files are **documentation, not built app code**.

## 1. Identify yourself before any work

First output exactly: `I am Agent [A/B/C] — [Frontend Lead / Backend Engine / Monad Web3]. My branch is ... . My owned paths are ... . Current phase is ... .` If letter or phase unknown, do not write files until established.

- **Agent A:** frontend/lead, Phase0 sole scaffolder, then owns only its B1 frontend paths and `tasks/agent-a.md` (human-coordinated). Required branch `agent-a/frontend` after Phase0.
- **Agent B:** Worker/backend/Durable Objects/gameplay, own B1 paths and `tasks/agent-b.md`. Branch `agent-b/backend`.
- **Agent C:** contract/Web3 UI/chain adapter, own B1 paths and `tasks/agent-c.md`. Branch `agent-c/web3`.

**Two-agent contingency:** If only two agents are available, **Agent B absorbs Agent C's entire column** and must execute C tasks *sequentially* or under separate ownership-labelled commits, while Agent A retains integration lead. Never let A/B simultaneously edit C paths.

## 2. Phases and ownership

- Phase0: Agent A alone edits, scaffolds, installs vetted dependencies, configures tests, writes frozen contracts/seed data, placeholders for **every route**, then submits `PHASE_0_LOCKED` commit. B/C may research/read/review **without editing files or running code generators into repo**. Only after Phase0 appears on `origin/main` may B/C code.
- Phase1: Each agent changes **only paths in its exclusive B1 column**, no shared configs, shared types/data, router registry, common UI, package manifests/lockfiles, `.env.example`, `SPEC`, `AGENTS`, `CLAUDE`, `README` or `MASTER_PROMPT`. Agents must not add dependencies. If a required file is missing, request it from lead rather than inventing a new shared path.
- Phase2: Lead/human orchestrates integration and may grant time-limited explicit permission for shared changes. No silent exception.

## 3. User-facing behavior

- Primary UI: **Bahasa Indonesia**. Product name BOAI. Currency labels distinguish `BOAI_CREDIT` (off-chain, nonredeemable) from testnet token. Use `TESTNET · TANPA NILAI UANG` and `SIMULASI IKLAN` wherever applicable.
- The in-game 'AI Agent' is a **deterministic preset/interpreter simulation**, never a live LLM; do not fake intelligence, users, transactions, advertising or deployment.
- All five agents have identical physics stats; monetized visual items are cosmetic only. One match = two short halves with swapped defender/rebuilder roles.
- Paid service integrations, real funds, mainnet, financial stakes, live ad networks, real top-up or cash-out are **out of scope**. `Rp0` is absolute.
- Do not claim completion when test cases have not been executed. Report exact failing steps.

## 4. Frozen interfaces and handoffs

- Import only frozen shared contracts from `packages/shared/src/{types,contracts,helpers,seed}.ts` created in Phase0. Do not modify these after freeze.
- UI routes belong solely to A (listed) or C (`/wallet`, `/rewards`); API routes belong solely to B except C (`/api/v1/chain/*`). Read B3 seam matrix before adding calls.
- Agent B cannot edit C chain adapter; Agent C cannot edit B game state or wallet auth. Request B3 changes in PR comments and tell the lead. Never copy/paste a divergent type definition into a separate module.
- Keep environment secrets in provider secret stores or local ignored `.dev.vars`/`.env.local`; never expose in chat output, issues, git log, artifacts or screenshots.

## 5. Git and review workflow

1. `git fetch origin && git rebase origin/main` before coding, before each PR and immediately after a merged PR.
2. Commit frequently and open PR every **30–45 minutes** if changes can pass relevant checks; human approval before merge. Do not push directly to `main`.
3. Run `npm run lint && npm run typecheck && npm run build && npm test` and, for C, `forge test` once Phase0 has established these scripts. If command fails, report error; never replace it with a fake passing script.
4. Run `git diff --name-only origin/main...HEAD` and inspect *every* path against B1. If a path is not yours, remove it from PR or request an ownership reassignment from human.
5. If git rebase hits a conflict outside your lane, run `git rebase --abort`, do not resolve or force push; notify human and owner.
6. PR body contains: agent letter, US story IDs, exclusive file list, API seam changes, tests with observed output, preview link/screenshot, blockers, reviewer needed.
7. For any change to a locked file: open a **Change Request** comment with desired path, exact patch description, purpose, impacted agents and breakage test. Lead/human edits locked file only after explicit sign-off.

## 6. Deployment / security guardrails

- Agent C verifies chain ID, RPC, explorer, faucet and Foundry version against official Monad docs **on event day**; no unverified hardcoded URL or chain ID assumptions.
- Only human may enter OAuth client secrets, relay key/wallet funds, approve main/testnet deployment signatures and connect third-party accounts. Agent may automate permitted CLI steps after explicit permission. Never request private keys in chat.
- WebSocket server authoritative; trust JWT issuer/audience/signature and signed wallet nonce; reject unknown user/invalid room/duplicate reward.
- Demo on production must display real chain explorer tx hash and matching contract address. Mock fallbacks must have visible labels and do not satisfy real deployment gates.

## 7. Final delivery required from each agent

- Checklist updated in **your** task file only, Notes section completed (tests, known limitations, commit SHA, PR, branch, deployed URL where applicable).
- Actual passing test output and reproducible local steps. Do not mark `DONE` for simulated tests, compile-only, unreachable app or demo videos unrelated to running code.
- End with an explicit handoff: `READY FOR INTEGRATION` or `BLOCKED`, plus the owner and exact file/API causing any blocker.
