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
  ["/team", "Team"],
  ["/practice", "Practice"],
  ["/queue", "Queue"],
  ["/leaderboard", "Leaderboard"],
  ["/shop", "Shop"],
  ["/profile", "Profile"],
  ["/wallet", "Wallet"],
  ["/rewards", "Rewards"],
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
          <Link to="/wallet" className="credit-pill" title="BOAI Credit Balance (Click to manage Wallet)">
            <span className="coin-icon">🪙</span>
            <span className="credit-amount">{credits !== null ? credits.available : '100'}</span>
            <span className="credit-label">CREDITS</span>
          </Link>

          {wallet.address !== null ? (
            <Link to="/wallet" className="wallet-chip connected" title={`Terkoneksi ke Monad Testnet: ${wallet.address}`}>
              <span className="wallet-dot">●</span>
              <span className="mono">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
            </Link>
          ) : (
            <Link to="/wallet" className="wallet-chip connect" title="Connect Monad Testnet Wallet">
              <span>⚡</span>
              <span>Connect Wallet</span>
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
        <span>TESTNET · NO MONETARY VALUE</span>
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
      setErrorMessage("Please enter a username");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUsername)) {
      setErrorMessage("Username must be 3-20 alphanumeric characters (letters, numbers, _, -)");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    if (authMode === "register") {
      if (password !== confirmPassword) {
        setErrorMessage("Password confirmation does not match");
        return;
      }
    }

    setLoading(true);
    try {
      if (authMode === "register") {
        const user = await authRegister(cleanUsername, password);
        setSuccessMessage(`Account @${user.username} created! Redirecting to arena...`);
        setTimeout(() => navigate("/team"), 800);
      } else {
        const user = await authLogin(cleanUsername, password);
        setSuccessMessage(`Welcome back, @${user.username}! Redirecting...`);
        setTimeout(() => navigate("/team"), 600);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed");
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
      setErrorMessage(err instanceof Error ? err.message : "Failed to enter as guest");
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
            <p className="welcome-tag">ACTIVE ACCOUNT</p>
            <h3>Welcome Back, @{currentUser.username}</h3>
            <p className="muted" style={{ margin: "8px 0" }}>Your account is ready for 5v5 Boi-boian PvP or Practice matches.</p>
            <div className="hero-actions" style={{ marginTop: "14px" }}>
              <button onClick={() => navigate("/team")}>
                Go to My Squad <span>➔</span>
              </button>
              <button className="secondary" onClick={() => navigate("/practice")}>
                Practice Arena
              </button>
              <button className="secondary" onClick={() => navigate("/profile")}>
                Player Profile
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
                Sign In
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
                Register
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
                  placeholder="Min. 6 characters"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  required
                />
              </div>

              {authMode === "register" && (
                <div className="form-group">
                  <label htmlFor="auth-confirm">Confirm Password</label>
                  <input
                    id="auth-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading
                  ? "Memproses..."
                  : authMode === "login"
                  ? "Enter Arena ➔"
                  : "Create New Account ➔"}
              </button>
            </form>

            {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
            {successMessage && <Notice tone="info">{successMessage}</Notice>}

            <div className="guest-fallback">
              <span className="muted">Or try instantly without registration:</span>
              <button type="button" className="guest-link-btn" onClick={handleGuestLogin} disabled={loading}>
                Enter as Guest ↗
              </button>
            </div>
          </div>
        )}

        <p className="microcopy">
          AI Agents in BOAI run on an explainable, deterministic rule-based simulation. No active LLMs during matches.
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
          <h2>Two teams. One stack.</h2>
          <p className="muted">Inspired by the traditional folk game of West Java. BOAI rules are a competitive digital adaptation.</p>
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
      setStatus("Squad loaded from server");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Squad not available yet");
    }
  };
  const save = async () => {
    try {
      await api.saveTeam({ name, agents });
      setStatus("Squad saved successfully");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save squad");
    }
  };
  return (
    <main className="content">
      <div className="page-head">
        <div>
          <p className="eyebrow">TEAM BUILDER · 5 SLOTS</p>
          <h1>Build your squad</h1>
          <p>
            Write concise instructions. The parser translates your prompts into deterministic simulation strategies visible in the arena.
          </p>
        </div>
        <span className="badge">AI AGENT SIMULATION</span>
      </div>
      <div className="team-layout">
        <section className="panel form-panel">
          <label>
            Squad name
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
                  Agent name
                  <input
                    value={agent.name}
                    onChange={(event) =>
                      update(index, "name", event.target.value)
                    }
                    maxLength={24}
                  />
                </label>
                <label>
                  Strategy prompt
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
                  <small>deterministic</small>
                </span>
              </div>
            </article>
          ))}
          <div className="button-row">
            <button onClick={save}>Save Squad</button>
            <button className="secondary" onClick={load}>
              Load from Server
            </button>
          </div>
          {status && <Notice>{status}</Notice>}
        </section>
        <aside className="panel side-panel">
          <p className="eyebrow">BOAI RULES</p>
          <h2>Prompts become behaviors</h2>
          <p>
            Prompts are mapped to a frozen behavior vocabulary. Unrecognized instructions default to BALANCED behavior.
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
            All agents share identical physics stats. Skins are purely cosmetic.
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
      <h1>Test squad strategies</h1>
      <p>
        Select an opponent preset. Difficulty alters bot policies, not physical agent stats.
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
                ? "Relaxed opponent"
                : value === "medium"
                  ? "Balanced match"
                  : "High pressure"}
            </span>
          </button>
        ))}
      </div>
      <button onClick={start}>
        Start Practice <span>↗</span>
      </button>
      {status && <Notice tone="error">{status}</Notice>}
    </main>
  );
}

function QueuePage() {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState("");
  const [status, setStatus] = useState("Not in queue");
  const join = async () => {
    try {
      const team = await api.getTeam();
      const result = await api.joinQueue(team.data.id, 0);
      setTicket(result.data.queueTicket);
      setStatus(
        result.data.status === "matched"
          ? "Opponent found"
          : "Waiting for human opponent",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Queue failed");
    }
  };
  useEffect(() => {
    if (!ticket) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.getQueueStatus(ticket);
        setStatus(
          result.data.status === "waiting"
            ? "Waiting for human opponent"
            : result.data.status,
        );
        if (result.data.matchId) navigate(`/match/${result.data.matchId}`);
      } catch {
        setStatus("Unable to load queue status");
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [ticket, navigate]);
  return (
    <main className="content narrow">
      <p className="eyebrow">PVP QUEUE · TWO HUMAN PLAYERS</p>
      <h1>Find an opponent</h1>
      <div className="queue-card">
        <img
          className="queue-art"
          src="/art/boai-stack-states.png"
          alt="Tahapan menara tile Boi-boian"
        />
        <span className="queue-icon">◎</span>
        <h2>{status}</h2>
        <p>BOAI does not replace missing opponents with silent bots.</p>
        {!ticket && <button onClick={join}>Join Matchmaking Queue</button>}
        {ticket && <span className="badge">TICKET ACTIVE</span>}
      </div>
      <Notice>
        Stakes use virtual BOAI_CREDIT only. Value is $0 and non-redeemable.
      </Notice>
    </main>
  );
}

function MatchPage() {
  const { matchId = "unknown" } = useParams();
  const [coach, setCoach] = useState("");
  const [status, setStatus] = useState("Connecting to match server...");
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
            setStatus("Match completed! Ready to view results.");
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
          setStatus("Authoritative WebSocket connected");
          socket?.send(JSON.stringify({ type: "CLIENT_READY", matchId }));
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as ServerWsMessage;
          if (message.type === "MATCH_SNAPSHOT") setSnapshot(message.snapshot);
          if (message.type === "MATCH_COMPLETE") {
            setStatus("Match completed");
          }
          if (message.type === "COACH_ACK") {
            setStatus(
              message.accepted
                ? "Coach directive accepted"
                : `Directive rejected: ${message.reason ?? "match rules"}`,
            );
          }
          if (message.type === "ERROR") setStatus(message.message);
        };
        socket.onerror = () => {
          setStatus("Live server synchronization active.");
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
          ? `Coach ${cmd} accepted by server`
          : `Coach ${cmd} rejected`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Coach gagal dikirim");
    }
  };

  const send = async () => {
    const command = coach.trim().toUpperCase() as
      "ATTACK" | "DEFEND" | "REBUILD" | "DISTRACT";
    if (!["ATTACK", "DEFEND", "REBUILD", "DISTRACT"].includes(command)) {
      setStatus("Use ATTACK, DEFEND, REBUILD, or DISTRACT");
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
            <span className="hud-team-name">RED SQUAD</span>
            <span className="hud-team-role">
              {snapshot.redRole === "REBUILDERS" ? "🧱 REBUILDER (Stacking)" : "🎯 HUNTER (Throwing Ball)"}
            </span>
            <div className="hud-stats">
              <span>Towers: <b>{snapshot.redScore.buildCount}</b></span>
              <span>Eliminations: <b>{snapshot.redScore.eliminations}</b></span>
              <span>Active: <b>{snapshot.agents.filter(a => a.side === 'red' && a.active).length}/5</b></span>
            </div>
          </div>

          <div className="hud-center">
            <span className="hud-half">HALF {snapshot.half} / 2</span>
            <div className="hud-timer">
              {Math.floor(snapshot.remainingMs / 60000)}:{String(Math.floor((snapshot.remainingMs % 60000) / 1000)).padStart(2, "0")}
            </div>
            <span className="hud-phase-badge">{snapshot.phase}</span>
          </div>

          <div className="hud-team blue">
            <span className="hud-team-name">BLUE SQUAD</span>
            <span className="hud-team-role">
              {snapshot.blueRole === "REBUILDERS" ? "🧱 REBUILDER (Stacking)" : "🎯 HUNTER (Throwing Ball)"}
            </span>
            <div className="hud-stats">
              <span>Towers: <b>{snapshot.blueScore.buildCount}</b></span>
              <span>Eliminations: <b>{snapshot.blueScore.eliminations}</b></span>
              <span>Active: <b>{snapshot.agents.filter(a => a.side === 'blue' && a.active).length}/5</b></span>
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
                      ? `⚠️ TOPPLED (${snapshot.stack.completed}/5)`
                      : `🧱 TOWER (${snapshot.stack.completed}/5)`}
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
                Connecting & Loading 5v5 Arena Snapshot...
              </div>
            )}
          </div>

          {snapshot?.phase === "FINISHED" && (
            <div className="match-finish-banner">
              <h2>Match Completed!</h2>
              <p>Winner: <b>{snapshot.winnerSide ? snapshot.winnerSide.toUpperCase() + ' SQUAD' : 'DRAW'}</b></p>
              <Link className="match-finish-btn" to={`/results/${matchId}`}>
                View Full Results & Testnet Rewards ➔
              </Link>
            </div>
          )}
        </section>

        <aside className="panel coach">
          <p className="eyebrow">LIVE COACH COMMANDS</p>
          <h2>Instant Tactical Directives</h2>
          <p className="muted">
            Click a quick directive button to guide your squad in real-time:
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
            Or Type Custom Tactic:
            <input
              value={coach}
              onChange={(event) => setCoach(event.target.value)}
              placeholder="ATTACK, DEFEND, REBUILD, DISTRACT..."
            />
          </label>
          <button onClick={send}>Submit Written Directive</button>
          <p className="muted">
            Directives take effect at the next policy boundary without modifying saved prompts.
          </p>
        </aside>
      </div>
    </main>
  );
}

function ResultsPage() {
  const { matchId = "unknown" } = useParams();
  const [status, setStatus] = useState("Loading results");
  const [result, setResult] = useState<MatchResult | null>(null);
  useEffect(() => {
    api
      .getResult(matchId)
      .then((response) => {
        setResult(response.data);
        setStatus("Server confirmed result");
      })
      .catch((error) =>
        setStatus(
          error instanceof Error ? error.message : "Result not yet available",
        ),
      );
  }, [matchId]);
  return (
    <main className="content narrow">
      <p className="eyebrow">MATCH RESULT · {matchId}</p>
      <h1>Match Results</h1>
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
              ? "Match ended in a draw"
              : `${result.winnerSide === "red" ? "Red" : "Blue"} Squad Wins`}
        </h2>
        <p>{status}</p>
        {result !== null ? (
          <div className="result-grid">
            <span><b>RED</b> {result.scores.red.buildCount} towers, {result.scores.red.eliminations} eliminations</span>
            <span><b>BLUE</b> {result.scores.blue.buildCount} towers, {result.scores.blue.eliminations} eliminations</span>
            <span><b>REPLAY</b> {result.replayHash.slice(0, 12)}…</span>
            <span><b>RULESET</b> {result.rulesetHash.slice(0, 12)}…</span>
            <span><b>FINAL</b> {result.finalizedAt}</span>
            <span>
              <b>MONAD</b>{" "}
              {result.chainTxHash ? (
                <a href={buildExplorerTxUrl(result.chainTxHash)} target="_blank" rel="noreferrer">
                  View transaction ↗
                </a>
              ) : "Not yet recorded on chain"}
            </span>
          </div>
        ) : null}
      </div>
      <Link className="button-link" to={`/rewards?matchId=${encodeURIComponent(matchId)}`}>
        View Testnet Reward Options ↗
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
      <h1>Arena Leaderboard</h1>
      <img
        className="leaderboard-art"
        src="/art/boai-badges.png"
        alt="Badge pencapaian BOAI"
      />
      <div className="panel table-panel">
        {rows.length === 0 ? (
          <p className="muted">No production match results to display yet.</p>
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
      <h1>Cosmetics Shop</h1>
      <div className="credit-shop-header">
        <div>
          <small className="eyebrow">VIRTUAL WALLET</small>
          <h2>Your Balance: 🪙 {credits !== null ? credits.available : '100'} BOAI_CREDIT</h2>
        </div>
        <button onClick={claim}>+ Watch Simulated Ad (+25 Credits)</button>
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
              {item.category === "skin" ? "Agent skin" : "Throw VFX"} · visual only
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
        <span>SIMULATED AD</span>
        <h2>Support the arena with one click</h2>
        <p>No real advertisers or monetary payments involved.</p>
        <button onClick={claim}>Watch simulation</button>
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
      <h1>Player Profile</h1>
      <div className="panel profile-card">
        <span className="avatar">{avatarLetter}</span>
        <h2>{usernameDisplay}</h2>
        {profile?.username ? (
          <div className="user-registered-tag">
            <span className="badge">Verified Account</span>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--parchment-soft)", marginLeft: "8px" }}>
              ID: {profile.userId}
            </span>
          </div>
        ) : (
          <div className="user-registered-tag">
            <span className="badge" style={{ borderColor: "var(--line)", color: "var(--parchment-soft)" }}>
              Guest Session
            </span>
          </div>
        )}
        <div className="credit-metric-box" style={{ margin: "16px 0", textAlign: "left" }}>
          <small>BOAI CREDIT BALANCE</small>
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
            Manage Wallet & Web3
          </Link>
          <button className="secondary" onClick={logout}>
            Log Out
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
