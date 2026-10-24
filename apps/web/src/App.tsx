import { Fragment, useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { MatchSnapshot, ServerWsMessage, Team } from "@boai/shared/types";
import { parseBehavior } from "@boai/shared/helpers";
import { SEED } from "@boai/shared/seed";
import { API_BASE_URL, api } from "./lib/api";
import { getSession, googleLogin, guestLogin, signOut } from "./lib/auth";

const links = [
  ["/team", "Tim"],
  ["/practice", "Latihan"],
  ["/queue", "Antrean"],
  ["/leaderboard", "Peringkat"],
  ["/shop", "Toko"],
  ["/profile", "Profil"],
] as const;

const navGlyphs: Record<(typeof links)[number][0], string> = {
  "/team": "◆",
  "/practice": "↯",
  "/queue": "◎",
  "/leaderboard": "✦",
  "/shop": "▣",
  "/profile": "◉",
};

function Shell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    getSession().then((value) => setOnline(Boolean(value)));
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
        <span className="session-dot">{online ? "● ONLINE" : "○ GUEST"}</span>
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
  const [message, setMessage] = useState("");
  const login = async (kind: "guest" | "google") => {
    try {
      if (kind === "guest") await guestLogin();
      else await googleLogin();
      setMessage(
        kind === "guest"
          ? "Guest siap. Lanjutkan ke editor tim."
          : "Mengarahkan ke Google...",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal");
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
        <div className="hero-actions">
          <button onClick={() => login("guest")}>
            Masuk sebagai Guest <span>↗</span>
          </button>
          <button className="secondary" onClick={() => login("google")}>
            Masuk dengan Google
          </button>
        </div>
        {message && <Notice>{message}</Notice>}
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
  const [status, setStatus] = useState("Menghubungkan ke MatchDO");
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    const connect = async () => {
      try {
        const initial = await api.getMatch(matchId);
        if (cancelled) return;
        setSnapshot(initial.data);
        const ticket = await api.createMatchSocketTicket(matchId);
        const apiUrl = new URL(API_BASE_URL);
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
          if (message.type === "MATCH_COMPLETE")
            setStatus("Pertandingan selesai");
          if (message.type === "COACH_ACK")
            setStatus(
              message.accepted
                ? "Arahan coach diterima"
                : `Arahan ditolak: ${message.reason ?? "aturan match"}`,
            );
          if (message.type === "ERROR") setStatus(message.message);
        };
        socket.onerror = () =>
          setStatus("WebSocket tidak tersedia. Menunggu server authoritative.");
        socket.onclose = () => {
          if (!cancelled) setStatus("Koneksi match terputus");
        };
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Match belum tersedia",
        );
      }
    };
    connect();
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [matchId]);
  const send = async () => {
    const command = coach.trim().toUpperCase() as
      "ATTACK" | "DEFEND" | "REBUILD" | "DISTRACT";
    if (!["ATTACK", "DEFEND", "REBUILD", "DISTRACT"].includes(command)) {
      setStatus("Gunakan ATTACK, DEFEND, REBUILD, atau DISTRACT");
      return;
    }
    try {
      const result = await api.sendCoach(matchId, command);
      setStatus(
        result.data.accepted
          ? `Coach ${command} diterima`
          : `Coach ${command} ditolak`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Coach gagal");
    }
  };
  return (
    <main className="content">
      <div className="page-head">
        <div>
          <p className="eyebrow">MATCH {matchId}</p>
          <h1>Arena sedang berjalan</h1>
          <p>{status}</p>
        </div>
        <span className="badge">LIVE · 2 HALVES</span>
      </div>
      <div className="match-layout">
        <section className="arena">
          <div className="arena-grid">
            <img
              className="match-art"
              src="/art/boai-hero-arena.png"
              alt="Ilustrasi lapangan Boi-boian"
            />
            <div className="arena-grid-overlay">
              <img
                className="vfx-art"
                src="/art/boai-vfx.png"
                alt="Efek lintasan lempar bola dan benturan"
              />
              {snapshot ? (
                <>
                  <div
                    className="stack big"
                    style={{
                      left: `${snapshot.stack.position.x * 100}%`,
                      top: `${snapshot.stack.position.y * 100}%`,
                    }}
                  >
                    {Array.from({ length: snapshot.stack.completed }).map(
                      (_, index) => (
                        <Fragment key={index}>
                          ◆<br />
                        </Fragment>
                      ),
                    )}
                  </div>
                  {snapshot.agents.map((agent) => (
                    <span
                      key={`${agent.side}-${agent.slot}`}
                      className="player"
                      style={{
                        left: `${agent.position.x * 100}%`,
                        top: `${agent.position.y * 100}%`,
                        borderColor:
                          agent.side === "red" ? "#d86122" : "#e9b94e",
                        color: agent.side === "red" ? "#d86122" : "#e9b94e",
                      }}
                    >
                      {agent.slot}
                    </span>
                  ))}
                  <span
                    className="ball big-ball"
                    style={{
                      left: `${snapshot.ball.position.x * 100}%`,
                      top: `${snapshot.ball.position.y * 100}%`,
                    }}
                  >
                    ●
                  </span>
                </>
              ) : (
                <div className="arena-empty">
                  Menunggu snapshot authoritative...
                </div>
              )}
            </div>
          </div>
          <div className="scoreline">
            <span>RED {snapshot?.redScore.buildCount ?? 0}</span>
            <span>
              {snapshot ? `${Math.ceil(snapshot.remainingMs / 1000)}s` : "--"}
            </span>
            <span>BLUE {snapshot?.blueScore.buildCount ?? 0}</span>
          </div>
        </section>
        <aside className="panel coach">
          <p className="eyebrow">LIVE COACH</p>
          <h2>Ubah pendekatan tim</h2>
          <input
            value={coach}
            onChange={(event) => setCoach(event.target.value)}
            placeholder="ATTACK, DEFEND, REBUILD..."
          />
          <button onClick={send}>Kirim arahan</button>
          <p className="muted">
            Arahan berlaku pada policy boundary berikutnya dan tidak mengubah
            prompt tersimpan.
          </p>
        </aside>
      </div>
    </main>
  );
}

function ResultsPage() {
  const { matchId = "unknown" } = useParams();
  const [status, setStatus] = useState("Memuat hasil");
  useEffect(() => {
    api
      .getResult(matchId)
      .then(() => setStatus("Hasil terkonfirmasi server"))
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
        <h2>Menunggu finalisasi</h2>
        <p>{status}</p>
        <div className="result-grid">
          <span>
            <b>RED</b> —
          </span>
          <span>
            <b>BLUE</b> —
          </span>
          <span>
            <b>HALVES</b> 2
          </span>
          <span>
            <b>REPLAY</b> server digest
          </span>
        </div>
      </div>
      <Link className="button-link" to="/rewards">
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
  const claim = async () => {
    try {
      await api.claimDemoAdReward();
      setStatus("Reward demo diberikan. SIMULASI IKLAN.");
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
  const logout = async () => {
    await signOut();
    window.location.assign("/");
  };
  return (
    <main className="content narrow">
      <p className="eyebrow">PROFILE · SESSION</p>
      <h1>Profil pemain</h1>
      <div className="panel profile-card">
        <span className="avatar">G</span>
        <h2>Guest Player</h2>
        <p>Identitas sesi dikelola oleh Supabase Auth saat dikonfigurasi.</p>
        <button className="secondary" onClick={logout}>
          Keluar
        </button>
      </div>
    </main>
  );
}
function SimplePage({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <main className="content narrow">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {eyebrow === "WEB3" && (
        <img
          className="practice-art"
          src="/art/boai-badges.png"
          alt="Badge BOAI_CREDIT dan testnet"
        />
      )}
      <Notice>
        Halaman ini disiapkan untuk pemilik jalur terkait. Status layanan akan
        tampil dari API saat tersedia.
      </Notice>
    </main>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/auth/callback"
          element={<SimplePage title="Auth callback" eyebrow="AUTH" />}
        />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="/results/:matchId" element={<ResultsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/wallet"
          element={<SimplePage title="Wallet testnet" eyebrow="WEB3" />}
        />
        <Route
          path="/rewards"
          element={<SimplePage title="Hadiah testnet" eyebrow="WEB3" />}
        />
      </Routes>
    </Shell>
  );
}
