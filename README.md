# BOAI — Boi-boian Online Agentic Arena

> **Monad Blitz Jogja 2026 — Official Submission & Verified Live Deployment**
>
> - **Live Web Application:** [https://boai-api.arkha10-boai.workers.dev/](https://boai-api.arkha10-boai.workers.dev/)
> - **Smart Contract (Monad Testnet - Chain ID 10143):** [`0x5af642ed0427567b0dfd5ecd9474f174dbda8420`](https://testnet.monadscan.com/address/0x5af642ed0427567b0dfd5ecd9474f174dbda8420)
> - **Deployment Transaction:** [`0x02f129d432461960335ad56e80dba8bcc759cd48efe8849e480c28f532826d4e`](https://testnet.monadscan.com/tx/0x02f129d432461960335ad56e80dba8bcc759cd48efe8849e480c28f532826d4e)
> - **Verified Match Record Tx:** [`0x0489e4e846696d1ceec9b8c913a65d43a037a80a876b9964e1a861714a441af8`](https://testnet.monadscan.com/tx/0x0489e4e846696d1ceec9b8c913a65d43a037a80a876b9964e1a861714a441af8)
> - **Verified Demo Reward Claim Tx:** [`0x08adc1aeca5d7fbf9c70636480b9182186d20748cbf494402221af44f5118847`](https://testnet.monadscan.com/tx/0x08adc1aeca5d7fbf9c70636480b9182186d20748cbf494402221af44f5118847)

---

## 🎯 About BOAI

**BOAI** (*Boi-boian Online Agentic Arena*) brings the traditional Indonesian folk sport — **Boi-boian** — into the Web3 and Autonomous AI Agent era, deployed on the **Monad Testnet**.

Two teams of 5 autonomous AI agents (Red Team vs Blue Team) compete in a deterministic 2D arena across two symmetric halves:
1. **Attackers (Strikers)** throw the ball to topple the 5-tier roof tile tower in the center of the field.
2. **Defenders (Rebuilders)** race to assemble and stack the 5 tile blocks while actively evading enemy ball throws.
3. **Human Coach** dynamically broadcasts tactical shifts in real time (`ATTACK`, `DEFEND`, `REBUILD`, `DISTRACT`).
4. **Match Outcomes & Rewards** are settled on-chain to the Monad Testnet smart contract automatically via an edge relayer.

---

## 🚀 Key Features (Production Ready)

### 1. Live 2D Match Visualization (10 Autonomous AI Agents)
- **10 Distinct AI Agent Avatars**: Visualizing 5 Red Agents vs 5 Blue Agents with coordinate physics (`1000 x 600`), real-time action states (`BUILD`, `DODGE`, `SPRINT`, `THROW`, `PASS`, etc.).
- **Dynamic Stamina / Energy Bars**: Visual indicators above each agent reflecting exertion and recovery.
- **Boi Ball Physics**: Precise throw and rebound vectors with clear ball-carrier possession badges.
- **Tower Stack Zone**: Real-time state tracking of the 5-block tile tower (from scattered to fully rebuilt).
- **Match HUD & Timer**: Round countdown, Half 1 / Half 2 indicators, and live team scoring.
- **Interactive Coach Bar**: Real-time management bar allowing players to broadcast tactical commands directly into the simulation loop.

### 2. Built-in Account System (Username & Password)
- **Credential Registration & Login**: Users register with a unique username (3–20 characters) and secure password hashed via SHA-256 + cryptographic salt.
- **Profile Badge & Status**: Displays `👤 @username` and live `ONLINE` session indicator across the navigation header and profile page.
- **One-Click Guest Access**: Instant guest onboarding for frictionless evaluation without registration.

### 3. Integrated Credit Balance & Web3 Wallet
- **Header Credit Pill**: Live virtual credit counter (`🪙 100 Credits`) in the top navigation bar.
- **Full-Featured Wallet Page (`/wallet`)**:
  - In-game virtual credit tracking (`available` & `reserved`).
  - Simulated ad reward claim mechanism (+25 BOAI_CREDIT).
  - EVM wallet integration (MetaMask, Rabby, etc.) on Monad Testnet (Chain ID 10143).
  - Gasless cryptographic signature verification (EIP-191 `personal_sign`).

### 4. Smart Contract & Monad Relayer (`BOAIArena.sol`)
- **On-chain Match Recording**: Commits `matchId`, `winner`, `replayHash`, `rulesetHash`, and `resultHash` directly to Monad Testnet.
- **Demo Reward Distribution**: Mints 1 ERC-20 `BOAI-DEMO` achievement trophy token directly to verified winner addresses.
- **Automated Relayer Service**: Cloudflare Worker executes on-chain settlements without burdening players with gas fees.

---

## ⏱️ 3-Minute Judging Walkthrough

1. Open the live web application at [https://boai-api.arkha10-boai.workers.dev/](https://boai-api.arkha10-boai.workers.dev/).
2. Create an account with a **Username & Password** (or click **"Sign in as Guest"**) — your account activates instantly with a unique username badge and **100 Starter BOAI_CREDIT**.
3. Note the **🪙 100 Credits** pill and **⚡ Connect Wallet** button in the top navigation bar.
4. Navigate to **"Practice"** (`/practice`), select **Easy** difficulty, and click **"Start Match"**.
5. Watch the live 10-agent match unfold:
   - Observe agents chasing the ball, draining stamina, dodging throws, and rebuilding the tile tower.
   - Test the live coach tactical buttons (**Attack**, **Defend**, **Rebuild Tower**, **Distract**).
6. Once the match finishes, navigate to **"Wallet"** (`/wallet`):
   - Review your virtual credits and test the **"+ Watch Simulated Ad"** button to claim +25 credits.
   - Connect your MetaMask wallet to Monad Testnet and sign the verification message.
7. Open **"Rewards"** (`/rewards`) to inspect on-chain settlement records on **MonadScan**.

---

## 🛠️ Technology Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7.
- **Game Engine & Backend**: Deterministic 2D Physics Engine, Cloudflare Workers & Durable Objects.
- **Storage Layer**: Relational SQL Engine with in-memory KV fallback (resilient to free-tier quotas).
- **Web3 Layer**: Solidity 0.8.28, Viem, Monad Testnet (Chain ID 10143), MonadScan Explorer.

---

## 🧪 Testing & Local Development

```bash
# Clone repository
git clone https://github.com/arkha10/monad_hack_dev.git
cd monad_hack_dev

# Install dependencies cleanly
npm ci

# Run linter and TypeScript compiler checks
npm run lint
npm run typecheck

# Run complete unit & integration test suite (171 tests)
npm test

# Build production frontend bundle & worker dry-run
npm run build

# Start local development servers
npm run dev:web       # Frontend at http://127.0.0.1:5173
npm run dev:worker    # Local Cloudflare Worker via Wrangler
```

---

## 📜 MonadScan Contract & Transaction Verification

| Item | Description | MonadScan Link |
| :--- | :--- | :--- |
| **Contract** | `BOAIArena.sol` (Chain 10143) | [`0x5af642ed0427567b0dfd5ecd9474f174dbda8420`](https://testnet.monadscan.com/address/0x5af642ed0427567b0dfd5ecd9474f174dbda8420) |
| **Deployment Tx** | Contract deployment to Monad Testnet | [`0x02f129...6d4e`](https://testnet.monadscan.com/tx/0x02f129d432461960335ad56e80dba8bcc759cd48efe8849e480c28f532826d4e) |
| **Match Record Tx** | Automated on-chain match result commitment | [`0x0489e4...1af8`](https://testnet.monadscan.com/tx/0x0489e4e846696d1ceec9b8c913a65d43a037a80a876b9964e1a861714a441af8) |
| **Demo Reward Tx** | ERC-20 BOAI-DEMO trophy token transfer | [`0x08adc1...8847`](https://testnet.monadscan.com/tx/0x08adc1aeca5d7fbf9c70636480b9182186d20748cbf494402221af44f5118847) |

---

## ⚖️ Regulatory & Compliance Notice

- **TESTNET ONLY · NO REAL MONETARY VALUE:** All smart contracts, transactions, and tokens operate strictly on the Monad Testnet (Chain ID `10143`).
- **NO REAL-MONEY GAMBLING / ZERO CASH-OUT:** `BOAI_CREDIT` is an in-game virtual simulation currency. It cannot be purchased, deposited, or redeemed for fiat currency or financial assets.
- **HONEST AI DISCLOSURE:** AI agents in BOAI run on an explainable, deterministic rule-based simulation engine without hidden non-deterministic LLM calls during gameplay ticks.

---

*Submitted for Monad Blitz Jogja 2026 (GIK UGM).*
