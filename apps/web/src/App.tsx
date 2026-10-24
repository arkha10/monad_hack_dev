import { Link, Route, Routes } from 'react-router-dom'

const routes = [
  ['/', 'Beranda'], ['/auth/callback', 'Auth Callback'], ['/team', 'Tim'], ['/practice', 'Latihan'], ['/queue', 'Antrean'], ['/match/:matchId', 'Pertandingan'], ['/results/:matchId', 'Hasil'], ['/leaderboard', 'Papan Peringkat'], ['/shop', 'Toko'], ['/profile', 'Profil'], ['/wallet', 'Wallet'], ['/rewards', 'Hadiah'],
] as const

function Placeholder({ title }: { title: string }) {
  return <main className="panel"><p className="eyebrow">BOAI · SIMULASI AI AGENT</p><h1>{title}</h1><p>Halaman Phase 0. Fitur lengkap akan diisi pemilik jalur masing masing setelah kontrak bersama terkunci.</p><span className="badge">TESTNET · TANPA NILAI UANG</span></main>
}

export function App() {
  return <div className="app"><header><div><p className="eyebrow">BOI BOIAN ONLINE AGENTIC ARENA</p><h2>BOAI</h2></div><nav>{routes.slice(0, 6).map(([path, label]) => <Link key={path} to={path}>{label}</Link>)}</nav></header><Routes>{routes.map(([path, label]) => <Route key={path} path={path} element={<Placeholder title={label} />} />)}</Routes><footer>BOAI_CREDIT adalah kredit virtual yang tidak dapat diuangkan. Iklan dan agen adalah simulasi.</footer></div>
}
