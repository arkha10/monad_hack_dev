import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { AuthenticatedProfile, CreditBalance, MatchResult, MatchSnapshot, ServerWsMessage, Team } from "@boai/shared/types";
import { buildExplorerTxUrl, parseBehavior } from "@boai/shared/helpers";
import { SEED } from "@boai/shared/seed";
import { API_BASE_URL, api } from "./lib/api";
import {
  getSession,
  login as authLogin,
  register as authRegister,
  guestLogin,
  signOut,
  type CurrentUser,
} from "./lib/auth";
import { useWallet } from "./lib/web3/useWallet";
import { WalletPage } from "./routes/Wallet";
import { RewardsPage } from "./routes/Rewards";

const links = [
  ["/team", "Tim"],
  ["/practice", "Latihan"],
  ["/queue", "Antrean"],
  ["/leaderboard", "Peringkat"],
  ["/shop", "Toko"],
  ["/profile", "Profil"],
  ["/wallet", "Wallet"],
  ["/rewards", "Hadiah"],
] as const;

const navGlyphs: Record<(typeof links)[number][0], string> = {
  "/team": "◆",
  "/practice": "↯",
  "/queue": "◎",
  "/leaderboard": "✦",
  "/shop": "▣",
  "/profile": "◉",
  "/wallet": "◇",
  "/rewards": "✧",
};

function Shell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const wallet = useWallet();

  const refreshCredits = async () => {
    try {
      const res = await api.getCredits();
      if (res && res.data) {
        setCredits(res.data);
      }
    } catch {
      // Guest or session pending
    }
  };

  const refreshUser = async () => {
    try {
      const session = await getSession();
      setCurrentUser(session);
      setOnline(Boolean(session));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refreshUser();
    void refreshCredits();
    const interval = setInterval(() => {
      void refreshCredits();
      void refreshUser();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header>
        <Link className="brand" to="/">
          <span className="brand-mark">B</span>
          <span>
            <strong>BOAI</strong>
            <small>BOI BOIAN ARENA</small>
          </span>
        </Link>
        <nav>
          {links.map(([path, label]) => (
            <Link key={path} to={path}>
              <span className="nav-glyph" aria-hidden="true">{navGlyphs[path]}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <Link to="/wallet" className="credit-pill" title="Saldo Kredit BOAI (Klik untuk kelola Dompet)">
            <span className="coin-icon">🪙</span>
            <span className="credit-amount">{credits !== null ? credits.available : '100'}</span>
            <span className="credit-label">KREDIT</span>
          </Link>

          {wallet.address !== null ? (
            <Link to="/wallet" className="wallet-chip connected" title={`Terkoneksi ke Monad Testnet: ${wallet.address}`}>
              <span className="wallet-dot">●</span>
              <span className="mono">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
            </Link>
          ) : (
            <Link to="/wallet" className="wallet-chip connect" title="Hubungkan Monad Testnet Wallet">
              <span>⚡</span>
              <span>Hubungkan Wallet</span>
            </Link>
          )}

          {currentUser?.username ? (
            <Link to="/profile" className="user-chip" title={`Akun: @${currentUser.username}`}>
              <span className="user-icon">👤</span>
              <span className="user-name">@{currentUser.username}</span>
            </Link>
          ) : null}

          <span className="session-dot">{currentUser?.username ? "● ONLINE" : online ? "● ONLINE" : "○ GUEST"}</span>
        </div>
      </header>
      {children}
      <footer>
        <span>BOAI_CREDIT · VIRTUAL · NONREDEEMABLE</span>
        <span>TESTNET · TANPA NILAI UANG</span>
      </footer>
    </div>
  );
}

function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

function Home() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void getSession().then((user) => {
      if (user && user.username) {
        setCurrentUser(user);
      }
    });
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage("Silakan masukkan username");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUsername)) {
      setErrorMessage("Username harus 3-20 karakter alfanumerik (huruf, angka, _, -)");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password minimal 6 karakter");
      return;
    }

    if (authMode === "register") {
      if (password !== confirmPassword) {
        setErrorMessage("Konfirmasi kata sandi tidak cocok");
        return;
      }
    }

    setLoading(true);
    try {
      if (authMode === "register") {
        const user = await authRegister(cleanUsername, password);
        setSuccessMessage(`Akun @${user.username} berhasil didaftarkan! Mengarahkan ke arena...`);
        setTimeout(() => navigate("/team"), 800);
      } else {
        const user = await authLogin(cleanUsername, password);
        setSuccessMessage(`Selamat datang kembali, @${user.username}! Mengarahkan...`);
        setTimeout(() => navigate("/team"), 600);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Autentikasi gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await guestLogin();
      navigate("/team");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal masuk sebagai tamu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="hero">
      <section>
        <p className="eyebrow">
          PERMAINAN RAKYAT SUNDA · AGENT SIMULATION
        </p>
        <h1>
          Jatuhkan genteng.
          <br />
          <em>Bangun kembali.</em>
        </h1>
        <p className="lede">
          BOAI adalah arena Boi-boian online 5 lawan 5. Lima agent deterministik
          membaca prompt Anda, mengejar bola, menjaga tumpukan, dan membangun
          kembali menara genteng.
        </p>

        {currentUser?.username ? (
          <div className="hero-auth-box logged-in">
            <p className="welcome-tag">AKUN AKTIF</p>
            <h3>Selamat Datang, @{currentUser.username}</h3>
            <p className="muted" style={{ margin: "8px 0" }}>Akun Anda siap untuk bermain Boi-boian PvP atau Latihan.</p>
            <div className="hero-actions" style={{ marginTop: "14px" }}>
              <button onClick={() => navigate("/team")}>
                Lanjut ke Tim Saya <span>➔</span>
              </button>
              <button className="secondary" onClick={() => navigate("/practice")}>
                Main Latihan
              </button>
              <button className="secondary" onClick={() => navigate("/profile")}>
                Lihat Profil
              </button>
            </div>
          </div>
        ) : (
          <div className="hero-auth-box">
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("login");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              >
                Masuk Akun
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === "register" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("register");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              >
                Daftar Baru
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="auth-username">Username</label>
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="misal: arkha_pro"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  required
                />
              </div>

              {authMode === "register" && (
                <div className="form-group">
                  <label htmlFor="auth-confirm">Konfirmasi Password</label>
                  <input
                    id="auth-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading
                  ? "Memproses..."
                  : authMode === "login"
                  ? "Masuk ke Arena ➔"
                  : "Daftar Akun Baru ➔"}
              </button>
            </form>

            {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
            {successMessage && <Notice tone="info">{successMessage}</Notice>}

            <div className="guest-fallback">
              <span className="muted">Atau coba langsung tanpa daftar:</span>
              <button type="button" className="guest-link-btn" onClick={handleGuestLogin} disabled={loading}>
                Masuk sebagai Guest (Tamu) ↗
              </button>
            </div>
          </div>
        )}

        <p className="microcopy">
          AI Agent di BOAI adalah simulasi rule based yang dapat dijelaskan.
          Tidak ada LLM aktif.
        </p>
      </section>
      <section className="hero-card">
        <div className="card-top">
          <span>LIVE PRACTICE</span>
          <span className="live-dot">●</span>
        </div>
        <div className="arena-mini">
          <img
            className="hero-art"
            src="/art/boai-hero-arena.png"
            alt="Arena Boi-boian saat matahari terbenam"
          />
          <div className="arena-mini-overlay">
            <div className="stack">
              ◆<br />◆<br />◆
            </div>
            {["p1", "p2", "p3", "p4", "p5"].map((slot, index) => (
              <span key={slot} className={`agent agent-${index + 1}`}>
                {slot}
              </span>
            ))}
            <span className="ball">●</span>
          </div>
        </div>
        <div className="sprite-strip">
          <img
            src="/art/boai-sprites.png"
            alt="Sprite agent merah, biru, dan bola"
          />
        </div>
        <div className="card-stats">
          <span>
            <b>10</b> AGENTS
          </span>
          <span>
            <b>2</b> HALVES
          </span>
          <span>
            <b>1</b> ARENA
          </span>
        </div>
      </section>
      </main>
      <section className="content home-rules">
      <div className="page-head">
        <div>
          <p className="eyebrow">BOI-BOIAN · ADAPTASI DIGITAL</p>
          <h2>Dua tim. Satu tumpukan.</h2>
          <p className="muted">Terinspirasi permainan rakyat Jawa Barat. Aturan BOAI adalah adaptasi produk, bukan klaim satu-satunya versi historis.</p>
        </div>
        <span className="badge">TESTNET · TANPA NILAI UANG</span>
      </div>
      <div className="home-rule-grid">
        <article className="panel rule-card"><img src="/art/boai-stack-states.png" alt="Enam keadaan tumpukan genteng Boi-boian" /><h3>Robohkan</h3><p>Lempar bola ke tumpukan genteng dari jarak yang disepakati.</p></article>
        <article className="panel rule-card"><img src="/art/boai-vfx.png" alt="Efek pixel bola kain saat dilempar" /><h3>Hindari</h3><p>Tim lawan mengejar dan melempar bola sementara tim Anda bergerak.</p></article>
        <article className="panel rule-card"><img src="/art/boai-badges.png" alt="Badge tile, bola, bambu, dan teamwork BOAI" /><h3>Bangun</h3><p>Susun kembali menara. Skor tercatat setelah server menyelesaikan ronde.</p></article>
      </div>
      </section>
    </>
  );
}

const defaults: Team["agents"] = SEED.agentSlots.map((slot, index) => ({
  slot,
  name: `Agent ${index + 1}`,
  text: SEED.promptSamples[index % 3].text,
  behavior: parseBehavior(SEED.promptSamples[index % 3].text).behavior,
  skinId: "skin-default-red",
})) as Team["agents"];

function TeamPage() {
  const [name, setName] = useState("Garuda Nusantara");
  const [agents, setAgents] = useState<Team["agents"]>(defaults);
  const [status, setStatus] = useState("");
  const update = (index: number, field: "name" | "text", value: string) =>
    setAgents(
      (current) =>
        current.map((agent, item) =>
          item === index
            ? {
                ...agent,
                [field]: value,
                ...(field === "text"
                  ? { behavior: parseBehavior(value).behavior }
                  : {}),
              }
            : agent,
        ) as Team["agents"],
    );
  const load = async () => {
    try {
      const result = await api.getTeam();
      setName(result.data.name);
      setAgents(result.data.agents);
      setStatus("Tim dimuat dari server");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tim belum tersedia");
    }
  };
  const save = async () => {
    try {
      await api.saveTeam({ name, agents });
      setStatus("Tim tersimpan");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan tim");
    }
  };
  return (
    <main className="content">
      <div className="page-head">
        <div>
          <p className="eyebrow">TEAM BUILDER · 5 SLOT</p>
          <h1>Bangun tim Anda</h1>
          <p>
            Tulis instruksi singkat. Parser akan memilih strategi simulasi yang
            terlihat di arena.
          </p>
        </div>
        <span className="badge">SIMULASI AI AGENT</span>
      </div>
      <div className="team-layout">
        <section className="panel form-panel">
          <label>
            Nama tim
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={32}
            />
          </label>
          {agents.map((agent, index) => (
            <article className="agent-row" key={agent.slot}>
              <div className="agent-number">0{index + 1}</div>
              <div className="agent-fields">
                <label>
                  Nama agent
                  <input
                    value={agent.name}
                    onChange={(event) =>
                      update(index, "name", event.target.value)
                    }
                    maxLength={24}
                  />
                </label>
                <label>
                  Prompt strategi
                  <textarea
                    value={agent.text}
                    onChange={(event) =>
                      update(index, "text", event.target.value)
                    }
                    maxLength={180}
                  />
                </label>
                <span className="strategy">
                  {agent.behavior.replaceAll("_", " ")}{" "}
                  <small>deterministik</small>
                </span>
              </div>
            </article>
          ))}
          <div className="button-row">
            <button onClick={save}>Simpan tim</button>
            <button className="secondary" onClick={load}>
              Muat dari server
            </button>
          </div>
          {status && <Notice>{status}</Notice>}
        </section>
        <aside className="panel side-panel">
          <p className="eyebrow">ATURAN BOAI</p>
          <h2>Prompt menjadi kebiasaan</h2>
          <p>
            Prompt dipetakan ke vocabulary yang dibekukan. Instruksi yang belum
            dikenali memakai perilaku BALANCED.
          </p>
          <ul>
            <li>BUILD_FIRST</li>
            <li>DODGE_FIRST</li>
            <li>DECOY</li>
            <li>CHASE_BALL</li>
            <li>GUARD_STACK</li>
          </ul>
          <img
            className="side-art"
            src="/art/boai-skins.png"
            alt="Empat pilihan skin agent"
          />
          <p className="muted">
            Semua agent memiliki physics stat yang sama. Skin hanya kosmetik.
          </p>
        </aside>
      </div>
    </main>
  );
}

function PracticePage() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [status, setStatus] = useState("");
  const start = async () => {
    try {
      const team = await api.getTeam();
      const result = await api.startPractice(difficulty, team.data.id);
      navigate(`/match/${result.data.matchId}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Practice belum tersedia",
      );
    }
  };
  return (
    <main className="content narrow">
      <p className="eyebrow">PRACTICE LAB · SERVER AUTHORITATIVE</p>
      <h1>Uji strategi tim</h1>
      <p>
        Pilih preset lawan. Difficulty mengubah kebijakan bot, bukan statistik
        fisik agent.
      </p>
      <img
        className="practice-art"
        src="/art/boai-badges.png"
        alt="Badge latihan, tantangan, tekanan, dan BOAI_CREDIT"
      />
      <div className="difficulty-grid">
        {(["easy", "medium", "hard"] as const).map((value) => (
          <button
            key={value}
            className={
              difficulty === value ? "difficulty selected" : "difficulty"
            }
            onClick={() => setDifficulty(value)}
          >
            <b>{value.toUpperCase()}</b>
            <span>
              {value === "easy"
                ? "Lawan santai"
                : value === "medium"
                  ? "Pertandingan seimbang"
                  : "Tekanan tinggi"}
            </span>
          </button>
        ))}
      </div>
      <button onClick={start}>
        Mulai practice <span>↗</span>
      </button>
      {status && <Notice tone="error">{status}</Notice>}
    </main>
  );
}

function QueuePage() {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState("");
  const [status, setStatus] = useState("Belum masuk antrean");
  const join = async () => {
    try {
      const team = await api.getTeam();
      const result = await api.joinQueue(team.data.id, 0);
      setTicket(result.data.queueTicket);
      setStatus(
        result.data.status === "matched"
          ? "Lawan ditemukan"
          : "Menunggu lawan manusia",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Antrean gagal");
    }
  };
  useEffect(() => {
    if (!ticket) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.getQueueStatus(ticket);
        setStatus(
          result.data.status === "waiting"
            ? "Menunggu lawan manusia"
            : result.data.status,
        );
        if (result.data.matchId) navigate(`/match/${result.data.matchId}`);
      } catch {
        setStatus("Status antrean belum dapat dimuat");
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [ticket, navigate]);
  return (
    <main className="content narrow">
      <p className="eyebrow">PVP QUEUE · TWO HUMAN OWNERS</p>
      <h1>Temukan lawan</h1>
      <div className="queue-card">
        <img
          className="queue-art"
          src="/art/boai-stack-states.png"
          alt="Tahapan menara tile Boi-boian"
        />
        <span className="queue-icon">◎</span>
        <h2>{status}</h2>
        <p>BOAI tidak mengganti lawan yang belum hadir dengan bot.</p>
        {!ticket && <button onClick={join}>Masuk antrean</button>}
        {ticket && <span className="badge">TICKET AKTIF</span>}
      </div>
      <Notice>
        Saldo taruhan hanya BOAI_CREDIT virtual. Nilainya Rp0 dan tidak dapat
        dicairkan.
      </Notice>
    </main>
  );
}

function MatchPage() {
  const { matchId = "unknown" } = useParams();
  const [coach, setCoach] = useState("");
  const [status, setStatus] = useState("Menghubungkan ke server match...");
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;

    // Initial fetch
    api.getMatch(matchId).then((res) => {
      if (!cancelled && res.data) setSnapshot(res.data);
    }).catch(() => {});

    // Polling fallback every 800ms to guarantee continuous live updates
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await api.getMatch(matchId);
        if (!cancelled && res.data) {
          setSnapshot(res.data);
          if (res.data.phase === "FINISHED") {
            setStatus("Pertandingan selesai! Siap melihat hasil.");
          }
        }
      } catch {
        // Polling retry on error
      }
    }, 800);

    const connect = async () => {
      try {
        const ticket = await api.createMatchSocketTicket(matchId);
        if (cancelled) return;
        const apiUrl = new URL(API_BASE_URL || window.location.origin);
        const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(
          `${protocol}//${apiUrl.host}/ws/v1/matches/${matchId}?ticket=${encodeURIComponent(ticket.data.ticket)}`,
        );
        socket.onopen = () => {
          setStatus("WebSocket authoritative tersambung");
          socket?.send(JSON.stringify({ type: "CLIENT_READY", matchId }));
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as ServerWsMessage;
          if (message.type === "MATCH_SNAPSHOT") setSnapshot(message.snapshot);
          if (message.type === "MATCH_COMPLETE") {
            setStatus("Pertandingan selesai");
          }
          if (message.type === "COACH_ACK") {
            setStatus(
              message.accepted
                ? "Arahan coach diterima"
                : `Arahan ditolak: ${message.reason ?? "aturan match"}`,
            );
          }
          if (message.type === "ERROR") setStatus(message.message);
        };
        socket.onerror = () => {
          setStatus("Sinkronisasi live via server aktif.");
        };
        socket.onclose = () => {
          if (!cancelled) setStatus("Sinkronisasi live via server aktif.");
        };
      } catch {
        setStatus("Sinkronisasi live via server aktif.");
      }
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      socket?.close();
    };
  }, [matchId]);

  const sendCommand = async (cmd: "ATTACK" | "DEFEND" | "REBUILD" | "DISTRACT") => {
    try {
      const result = await api.sendCoach(matchId, cmd);
      setStatus(
        result.data.accepted
          ? `Coach ${cmd} diterima server`
          : `Coach ${cmd} ditolak`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Coach gagal dikirim");
    }
  };

  const send = async () => {
    const command = coach.trim().toUpperCase() as
      "ATTACK" | "DEFEND" | "REBUILD" | "DISTRACT";
    if (!["ATTACK", "DEFEND", "REBUILD", "DISTRACT"].includes(command)) {
      setStatus("Gunakan ATTACK, DEFEND, REBUILD, atau DISTRACT");
      return;
    }
    await sendCommand(command);
  };

  const actionLabel = (act: string) => {
    switch (act) {
      case "BUILD": return "🧱 BUILD";
      case "SPRINT": return "⚡ SPRINT";
      case "THROW": return "🎯 THROW";
      case "PASS_BALL": return "↗ PASS";
      case "DODGE": return "💨 DODGE";
      case "PICKUP_BALL": return "✋ PICKUP";
      case "GUARD_STACK": return "🛡 GUARD";
      case "DISTRACT": return "👀 DECOY";
      case "MOVE_TO": return "➔ MOVE";
      default: return "⏳ WAIT";
    }
  };

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <p className="eyebrow">MATCH {matchId}</p>
          <h1>Arena Boi-boian 5v5 Live</h1>
          <p>{status}</p>
        </div>
        <span className="badge">LIVE · 2 HALVES · DETERMINISTIC</span>
      </div>

      {snapshot && (
        <div className="arena-hud">
          <div className="hud-team red">
            <span className="hud-team-name">TIM MERAH</span>
            <span className="hud-team-role">
              {snapshot.redRole === "REBUILDERS" ? "🧱 REBUILDER (Menyusun)" : "🎯 HUNTER (Melempar Bola)"}
            </span>
            <div className="hud-stats">
              <span>Menara: <b>{snapshot.redScore.buildCount}</b></span>
              <span>Eliminasi: <b>{snapshot.redScore.eliminations}</b></span>
              <span>Aktif: <b>{snapshot.agents.filter(a => a.side === 'red' && a.active).length}/5</b></span>
            </div>
          </div>

          <div className="hud-center">
            <span className="hud-half">BABAK {snapshot.half} / 2</span>
            <div className="hud-timer">
              {Math.floor(snapshot.remainingMs / 60000)}:{String(Math.floor((snapshot.remainingMs % 60000) / 1000)).padStart(2, "0")}
            </div>
            <span className="hud-phase-badge">{snapshot.phase}</span>
          </div>

          <div className="hud-team blue">
            <span className="hud-team-name">TIM BIRU</span>
            <span className="hud-team-role">
              {snapshot.blueRole === "REBUILDERS" ? "🧱 REBUILDER (Menyusun)" : "🎯 HUNTER (Melempar Bola)"}
            </span>
            <div className="hud-stats">
              <span>Menara: <b>{snapshot.blueScore.buildCount}</b></span>
              <span>Eliminasi: <b>{snapshot.blueScore.eliminations}</b></span>
              <span>Aktif: <b>{snapshot.agents.filter(a => a.side === 'blue' && a.active).length}/5</b></span>
            </div>
          </div>
        </div>
      )}

      <div className="match-layout">
        <section className="arena">
          <div className="arena-stage">
            <img
              className="arena-bg-img"
              src="/art/boai-hero-arena.png"
              alt="Ilustrasi lapangan Boi-boian"
            />
            <div className="arena-markings">
              <div className="arena-center-line" />
              <div className="arena-center-circle" />
            </div>

            {snapshot ? (
              <>
                {/* Tumpukan Genteng (Base Stack) */}
                <div
                  className="base-zone"
                  style={{
                    left: `${Math.max(5, Math.min(95, (snapshot.stack.position.x / 1000) * 100))}%`,
                    top: `${Math.max(5, Math.min(95, (snapshot.stack.position.y / 600) * 100))}%`,
                  }}
                >
                  <div className="base-circle-ring">
                    {snapshot.stack.knockedDown ? (
                      <div className="scattered-tiles">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="scattered-tile"
                            style={{ ['--rot' as string]: `${(i * 35) - 45}deg` } as React.CSSProperties}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="tile-stack-tower">
                        {Array.from({ length: snapshot.stack.completed }).map((_, i) => (
                          <div key={i} className="tile-brick" />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="base-badge">
                    {snapshot.stack.knockedDown
                      ? `⚠️ ROBOH (${snapshot.stack.completed}/5)`
                      : `🧱 MENARA (${snapshot.stack.completed}/5)`}
                  </span>
                </div>

                {/* 10 AI Agents */}
                {snapshot.agents.map((agent) => {
                  const xPct = Math.max(3, Math.min(97, (agent.position.x / 1000) * 100));
                  const yPct = Math.max(4, Math.min(96, (agent.position.y / 600) * 100));
                  const isBallHolder = snapshot.ball.holder === `${agent.side}:${agent.slot}`;
                  const staminaColor =
                    agent.stamina > 50 ? "#22c55e" : agent.stamina > 20 ? "#eab308" : "#ef4444";

                  return (
                    <div
                      key={`${agent.side}-${agent.slot}`}
                      className="arena-agent"
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    >
                      {/* Stamina / Energy Bar */}
                      <div className="agent-stamina-bar">
                        <div
                          className="agent-stamina-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, agent.stamina))}%`,
                            backgroundColor: staminaColor,
                          }}
                        />
                      </div>

                      {/* Agent Avatar */}
                      <div
                        className={`agent-circle ${agent.side} ${!agent.active ? "eliminated" : ""} ${
                          isBallHolder ? "has-ball" : ""
                        }`}
                      >
                        {agent.active ? agent.slot.toUpperCase() : "✕"}
                      </div>

                      {/* Action Pill Badge */}
                      <span className="agent-action-pill">
                        {agent.active ? actionLabel(agent.currentAction) : "OUT"}
                      </span>
                    </div>
                  );
                })}

                {/* Bola Boi-boian */}
                <div
                  className="arena-ball"
                  style={{
                    left: `${Math.max(3, Math.min(97, (snapshot.ball.position.x / 1000) * 100))}%`,
                    top: `${Math.max(3, Math.min(97, (snapshot.ball.position.y / 600) * 100))}%`,
                  }}
                >
                  <div
                    className={`ball-orb ${
                      Math.hypot(snapshot.ball.velocity.x, snapshot.ball.velocity.y) > 0 ? "ball-moving" : ""
                    }`}
                  />
                  {snapshot.ball.holder && (
                    <span className="ball-badge">
                      ✋ ${snapshot.ball.holder.toUpperCase()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="arena-empty">
                Menghubungkan & Memuat Snapshot Lapangan 5v5...
              </div>
            )}
          </div>

          {snapshot?.phase === "FINISHED" && (
            <div className="match-finish-banner">
              <h2>Pertandingan Telah Selesai!</h2>
              <p>Pemenang: <b>TIM {snapshot.winnerSide ? snapshot.winnerSide.toUpperCase() : "SERI"}</b></p>
              <Link className="match-finish-btn" to={`/results/${matchId}`}>
                Lihat Hasil Lengkap & Hadiah Testnet ➔
              </Link>
            </div>
          )}
        </section>

        <aside className="panel coach">
          <p className="eyebrow">LIVE COACH COMMANDS</p>
          <h2>Arahan Strategi Instan</h2>
          <p className="muted">
            Klik tombol arahan cepat untuk menginstruksikan tim Anda secara real-time:
          </p>

          <div className="coach-quick-grid">
            <button
              type="button"
              className="coach-quick-btn"
              onClick={() => sendCommand("REBUILD")}
            >
              🧱 REBUILD
            </button>
            <button
              type="button"
              className="coach-quick-btn"
              onClick={() => sendCommand("ATTACK")}
            >
              🎯 ATTACK
            </button>
            <button
              type="button"
              className="coach-quick-btn"
              onClick={() => sendCommand("DEFEND")}
            >
              🛡 DEFEND
            </button>
            <button
              type="button"
              className="coach-quick-btn"
              onClick={() => sendCommand("DISTRACT")}
            >
              💨 DISTRACT
            </button>
          </div>

          <label>
            Atau Ketik Arahan Kustom:
            <input
              value={coach}
              onChange={(event) => setCoach(event.target.value)}
              placeholder="ATTACK, DEFEND, REBUILD, DISTRACT..."
            />
          </label>
          <button onClick={send}>Kirim Arahan Tertulis</button>
          <p className="muted">
            Arahan berlaku pada policy boundary berikutnya tanpa mengubah prompt tersimpan.
          </p>
        </aside>
      </div>
    </main>
  );
}

function ResultsPage() {
  const { matchId = "unknown" } = useParams();
  const [status, setStatus] = useState("Memuat hasil");
  const [result, setResult] = useState<MatchResult | null>(null);
  useEffect(() => {
    api
      .getResult(matchId)
      .then((response) => {
        setResult(response.data);
        setStatus("Hasil terkonfirmasi server");
      })
      .catch((error) =>
        setStatus(
          error instanceof Error ? error.message : "Hasil belum tersedia",
        ),
      );
  }, [matchId]);
  return (
    <main className="content narrow">
      <p className="eyebrow">MATCH RESULT · {matchId}</p>
      <h1>Hasil pertandingan</h1>
      <div className="result-card">
        <img
          className="result-art"
          src="/art/boai-stack-states.png"
          alt="Menara Boi-boian runtuh"
        />
        <span className="result-mark">◆</span>
        <h2>
          {result === null
            ? "Menunggu finalisasi"
            : result.winnerSide === "draw"
              ? "Pertandingan seri"
              : `Tim ${result.winnerSide === "red" ? "merah" : "biru"} menang`}
        </h2>
        <p>{status}</p>
        {result !== null ? (
          <div className="result-grid">
            <span><b>MERAH</b> {result.scores.red.buildCount} menara, {result.scores.red.eliminations} eliminasi</span>
            <span><b>BIRU</b> {result.scores.blue.buildCount} menara, {result.scores.blue.eliminations} eliminasi</span>
            <span><b>REPLAY</b> {result.replayHash.slice(0, 12)}…</span>
            <span><b>RULESET</b> {result.rulesetHash.slice(0, 12)}…</span>
            <span><b>FINAL</b> {result.finalizedAt}</span>
            <span>
              <b>MONAD</b>{" "}
              {result.chainTxHash ? (
                <a href={buildExplorerTxUrl(result.chainTxHash)} target="_blank" rel="noreferrer">
                  Lihat transaksi ↗
                </a>
              ) : "Belum tercatat di chain"}
            </span>
          </div>
        ) : null}
      </div>
      <Link className="button-link" to={`/rewards?matchId=${encodeURIComponent(matchId)}`}>
        Lihat opsi hadiah testnet ↗
      </Link>
    </main>
  );
}

function LeaderboardPage() {
  const [rows, setRows] = useState<
    Array<{ teamId: string; name: string; wins: number; losses: number }>
  >([]);
  useEffect(() => {
    api
      .getLeaderboard()
      .then((result) => setRows(result.data))
      .catch(() => setRows([]));
  }, []);
  return (
    <main className="content narrow">
      <p className="eyebrow">LEADERBOARD · SERVER DATA</p>
      <h1>Papan peringkat</h1>
      <img
        className="leaderboard-art"
        src="/art/boai-badges.png"
        alt="Badge pencapaian BOAI"
      />
      <div className="panel table-panel">
        {rows.length === 0 ? (
          <p className="muted">Belum ada hasil produksi untuk ditampilkan.</p>
        ) : (
          rows.map((row, index) => (
            <div className="table-row" key={row.teamId}>
              <b>0{index + 1}</b>
              <span>{row.name}</span>
              <strong>
                {row.wins}W / {row.losses}L
              </strong>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function ShopPage() {
  const [status, setStatus] = useState("");
  const [credits, setCredits] = useState<CreditBalance | null>(null);

  const fetchCredits = async () => {
    try {
      const res = await api.getCredits();
      if (res && res.data) setCredits(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchCredits();
  }, []);

  const claim = async () => {
    try {
      const res = await api.claimDemoAdReward();
      setCredits(res.data.balance);
      setStatus("Reward demo diberikan! +25 BOAI_CREDIT berhasil ditambahkan.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Reward belum tersedia",
      );
    }
  };
  return (
    <main className="content">
      <p className="eyebrow">COSMETICS · NO GAMEPLAY MODIFIER</p>
      <h1>Toko kosmetik</h1>
      <div className="credit-shop-header">
        <div>
          <small className="eyebrow">DOMPET VIRTUAL</small>
          <h2>Saldo Anda: 🪙 {credits !== null ? credits.available : '100'} BOAI_CREDIT</h2>
        </div>
        <button onClick={claim}>+ Tonton Simulasi Iklan (+25 Kredit)</button>
      </div>
      <div className="shop-grid">
        {SEED.cosmetics.map((item) => (
          <article className="panel item-card" key={item.id}>
            <img
              className="item-art"
              src={
                item.category === "skin"
                  ? "/art/boai-skins.png"
                  : "/art/boai-vfx.png"
              }
              alt={`${item.name} preview`}
            />
            <span className="swatch">◆</span>
            <h2>{item.name}</h2>
            <p>
              {item.category === "skin" ? "Skin agent" : "Efek lempar"} · visual
              saja
            </p>
            <button
              className="secondary"
              onClick={() => setStatus(`${item.name} dipilih untuk preview`)}
            >
              Preview
            </button>
          </article>
        ))}
      </div>
      <div className="ad-card">
        <span>SIMULASI IKLAN</span>
        <h2>Dukung arena dengan satu klik</h2>
        <p>Tidak ada advertiser sungguhan atau pembayaran.</p>
        <button onClick={claim}>Tonton simulasi</button>
      </div>
      {status && <Notice>{status}</Notice>}
    </main>
  );
}

function ProfilePage() {
  const [profile, setProfile] = useState<AuthenticatedProfile | null>(null);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const wallet = useWallet();

  useEffect(() => {
    api.syncIdentity().then((res) => {
      if (res && res.data) setProfile(res.data);
    }).catch(() => {});
    api.getCredits().then((res) => {
      if (res && res.data) setCredits(res.data);
    }).catch(() => {});
  }, []);

  const logout = async () => {
    await signOut();
    window.location.assign("/");
  };

  const usernameDisplay = profile?.username
    ? `@${profile.username}`
    : profile?.isGuest
    ? "Guest Player"
    : profile?.displayName ?? "Pemain BOAI";
  const avatarLetter = profile?.username
    ? profile.username.charAt(0).toUpperCase()
    : profile?.isGuest
    ? "G"
    : "P";

  return (
    <main className="content narrow">
      <p className="eyebrow">PROFILE · SESSION</p>
      <h1>Profil pemain</h1>
      <div className="panel profile-card">
        <span className="avatar">{avatarLetter}</span>
        <h2>{usernameDisplay}</h2>
        {profile?.username ? (
          <div className="user-registered-tag">
            <span className="badge">Akun Terdaftar</span>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--parchment-soft)", marginLeft: "8px" }}>
              ID: {profile.userId}
            </span>
          </div>
        ) : (
          <div className="user-registered-tag">
            <span className="badge" style={{ borderColor: "var(--line)", color: "var(--parchment-soft)" }}>
              Sesi Tamu (Guest)
            </span>
          </div>
        )}
        <div className="credit-metric-box" style={{ margin: "16px 0", textAlign: "left" }}>
          <small>SALDO KREDIT BOAI</small>
          <div className="metric-val">🪙 {credits?.available ?? 100}</div>
          <span className="metric-unit">BOAI_CREDIT (Virtual)</span>
        </div>
        {wallet.address && (
          <div className="wallet-detail" style={{ margin: "12px 0" }}>
            <small className="eyebrow">WALLET MONAD TESTNET</small>
            <div className="mono" style={{ color: "#34d399", fontSize: "0.85rem" }}>
              {wallet.address}
            </div>
          </div>
        )}
        <div className="button-row">
          <Link to="/wallet" style={{ display: "inline-block", padding: "12px 18px", background: "var(--amber)", color: "var(--ink)", fontWeight: 900, textDecoration: "none", borderRadius: "3px" }}>
            Kelola Dompet & Web3
          </Link>
          <button className="secondary" onClick={logout}>
            Keluar (Logout)
          </button>
        </div>
      </div>
    </main>
  );
}


export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="/results/:matchId" element={<ResultsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
      </Routes>
    </Shell>
  );
}
