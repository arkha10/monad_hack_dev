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

**BOAI** (*Boi-boian Online Agentic Arena*) membawa olahraga tradisional rakyat Nusantara — **Boi-boian** — ke era Web3 dan simulasi Autonomous AI Agent di atas **Monad Testnet**. 

Dua tim berisi 5 AI Agent (Tim Merah vs Tim Biru) bertanding dalam arena 2D deterministik:
1. **Penyerang (Attackers)** melempar bola untuk merobohkan susunan menara genteng / balok di tengah lapangan.
2. **Penyusun (Defenders)** berusaha menyusun kembali tumpukan 5 keping balok genteng sambil menghindari lemparan bola tim lawan.
3. **Pelatih (Human Coach)** mengarahkan taktik tim secara real-time (`ATTACK`, `DEFEND`, `REBUILD`, `DISTRACT`).
4. **Hasil Akhir & Hadiah** dicatat secara on-chain ke smart contract Monad Testnet secara otomatis melalui relayer.

---

## 🚀 Fitur Unggulan (Production Ready)

### 1. Live 2D Match Visualization (10 AI Agents)
- **10 AI Agent Avatars**: Visualisasi 5 Agen Tim Merah vs 5 Agen Tim Biru dengan pergerakan koordinat 2D presisi (`1000 x 600`), indikator aksi (`BUILD`, `DODGE`, `SPRINT`, `THROW`, `PASS`, dll).
- **Stamina / Energy Bars**: Bar stamina dinamis di atas kepala setiap agent.
- **Boi Ball Physics**: Vektor lemparan dan pantulan bola dengan indikator visual agen pembawa bola.
- **Tower Stack Zone**: Status tumpukan genteng (1–5 keping) saat roboh maupun saat disusun kembali.
- **Match HUD & Timer**: Hitung mundur babak pertandingan, indikator Half 1 / Half 2, dan skor tim.
- **Interactive Coach Bar**: Tombol taktik interaktif pelatih yang langsung mempengaruhi AI engine pertandingan secara live.

### 2. Autentikasi Akun Mandiri (Username & Password)
- **Registrasi & Login Manual**: Pemain dapat mendaftar dengan memilih username unik (3-20 karakter) dan password aman dengan hashing SHA-256 + cryptographic salt.
- **Badge Akun & Status**: Menampilkan chip profil `👤 @username` dan status `ONLINE` di navbar serta profil pemain.
- **Opsi Tamu (Guest)**: Opsi onboarding cepat tanpa registrasi untuk evaluasi instan.

### 3. Dompet Kredit & Web3 Wallet Terintegrasi
- **Credit Pill di Header**: Menampilkan saldo kredit live pemain (`🪙 100 Kredit`) di navigasi atas.
- **Halaman Dompet Lengkap (`/wallet`)**:
  - Saldo Kredit In-Game (`available` & `reserved`).
  - Klaim reward simulasi iklan (+25 BOAI_CREDIT).
  - Integrasi wallet EVM (MetaMask, Rabby, dll.) di Monad Testnet.
  - Verifikasi tanda tangan gasless (EIP-191 `personal_sign`).

### 4. Smart Contract & Monad Relayer (`BOAIArena.sol`)
- **On-chain Match Recording**: Mencatat `matchId`, `winner`, `replayHash`, `rulesetHash`, dan `resultHash` ke Monad Testnet.
- **Demo Reward Distribution**: Mengklaim 1 token ERC-20 `BOAI-DEMO` langsung ke wallet pemenang yang terverifikasi.
- **Automated Relayer**: Backend Cloudflare Worker mengeksekusi transaksi on-chain otomatis tanpa membebani biaya gas ke pemain.

---

## ⏱️ Panduan Penjurian 3 Menit (Judging Walkthrough)

1. Buka aplikasi web di [https://boai-api.arkha10-boai.workers.dev/](https://boai-api.arkha10-boai.workers.dev/).
2. Daftarkan akun baru dengan **Username & Password** (atau klik **"Masuk sebagai Tamu"**) — Akun langsung aktif dengan badge username unik dan diberikan **100 Starter BOAI_CREDIT**.
3. Perhatikan badge **🪙 100 Kredit** dan tombol **⚡ Hubungkan Wallet** di navbar atas.
4. Buka menu **"Latihan"** (`/practice`), pilih tingkat kesulitan **Mudah (Easy)**, dan klik **"Mulai Pertandingan"**.
5. Saksikan pertandingan live 10 AI Agent:
   - Pantau agen mengejar bola, stamina yang terkuras, dan proses penyusunan kembali menara genteng.
   - Uji tombol taktik pelatih (**Serang**, **Bertahan**, **Susun Genteng**, **Pancing**).
6. Setelah match selesai, buka menu **"Wallet"** (`/wallet`):
   - Lihat saldo kredit virtual Anda dan coba tombol **"+ Tonton Simulasi Iklan"** untuk menambah saldo +25 kredit.
   - Hubungkan wallet MetaMask Anda ke Monad Testnet dan tandatangani verifikasi link.
7. Buka menu **"Hadiah"** (`/rewards`) untuk memverifikasi transaksi on-chain di **MonadScan**.

---

## 🛠️ Arsitektur Teknologi

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7.
- **Game Engine & Backend**: Deterministic 2D Physics Engine, Cloudflare Workers & Durable Objects.
- **Storage Layer**: Relational SQL Engine dengan persistent KV storage fallback (tahan batas kuota free tier).
- **Web3 Layer**: Solidity 0.8.28, Viem, Monad Testnet (Chain ID 10143), MonadScan Explorer.

---

## 🧪 Pengujian & Menjalankan Lokal

```bash
# Clone repository
git clone https://github.com/arkha10/monad_hack_dev.git
cd monad_hack_dev

# Install dependensi
npm ci

# Jalankan linter & typecheck
npm run lint
npm run typecheck

# Jalankan seluruh unit & integration tests (169 tests)
npm test

# Build production frontend & worker
npm run build

# Menjalankan development server lokal
npm run dev:web       # Frontend di http://127.0.0.1:5173
npm run dev:worker    # Cloudflare Worker lokal via Wrangler
```

---

## 📜 Verifikasi Kontrak & Transaksi di MonadScan

| Item | Deskripsi | Tautan MonadScan |
| :--- | :--- | :--- |
| **Contract** | `BOAIArena.sol` (Chain 10143) | [`0x5af642ed0427567b0dfd5ecd9474f174dbda8420`](https://testnet.monadscan.com/address/0x5af642ed0427567b0dfd5ecd9474f174dbda8420) |
| **Deployment Tx** | Deploy BOAIArena ke Monad Testnet | [`0x02f129...6d4e`](https://testnet.monadscan.com/tx/0x02f129d432461960335ad56e80dba8bcc759cd48efe8849e480c28f532826d4e) |
| **Match Record Tx** | Pencatatan hasil pertandingan otomatis | [`0x0489e4...1af8`](https://testnet.monadscan.com/tx/0x0489e4e846696d1ceec9b8c913a65d43a037a80a876b9964e1a861714a441af8) |
| **Demo Reward Tx** | Pengiriman reward token BOAI-DEMO | [`0x08adc1...8847`](https://testnet.monadscan.com/tx/0x08adc1aeca5d7fbf9c70636480b9182186d20748cbf494402221af44f5118847) |

---

*Diserahkan untuk Monad Blitz Jogja 2026.*
