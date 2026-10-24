import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MONAD_TESTNET, buildExplorerTxUrl } from '../lib/web3'
import { api } from '../lib/api'
import type { RewardClaim } from '@boai/shared/types'

export default function RewardsPage() {
  const [matchId, setMatchId] = useState<string>('demo-match-1')
  const [claimInfo, setClaimInfo] = useState<RewardClaim | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const handleCheckEligibility = async () => {
    if (!matchId.trim()) return
    try {
      setLoading(true)
      setStatus('Memeriksa kelayakan hadiah pada backend...')
      const res = await api.getRewardEligibility(matchId.trim())
      setClaimInfo(res.data)
      setStatus(`Status hadiah: ${res.data.status}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Pemeriksaan gagal')
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async () => {
    if (!matchId.trim()) return
    try {
      setLoading(true)
      setStatus('Mengirim permintaan klaim hadiah ke relayer Monad...')
      const res = await api.claimTestnetReward(matchId.trim())
      setClaimInfo(res.data)
      setStatus('Hadiah demo on-chain berhasil diklaim!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Klaim hadiah gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="content narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">REWARD DEMO · MONAD PARALLEL EVM</p>
          <h1>Hadiah Demo Testnet</h1>
          <p>
            Klaim 1 demo token pada kontrak on-chain BOAIArena setelah memenangkan pertandingan.
          </p>
        </div>
        <span className="badge">TESTNET · TANPA NILAI UANG</span>
      </div>

      <div className="panel profile-card">
        <label>
          ID Pertandingan (Match ID)
          <input
            value={matchId}
            onChange={e => setMatchId(e.target.value)}
            placeholder="Masukkan Match ID..."
            style={{ marginTop: '0.5rem', marginBottom: '1rem', width: '100%' }}
          />
        </label>

        <div className="button-row">
          <button onClick={handleCheckEligibility} disabled={loading || !matchId}>
            {loading ? 'Memuat...' : 'Cek Status Hadiah'}
          </button>
          {claimInfo?.status === 'eligible' && (
            <button onClick={handleClaim} disabled={loading}>
              Klaim Demo Reward On-Chain ↗
            </button>
          )}
        </div>

        {status && <div className="notice" style={{ marginTop: '1rem' }}>{status}</div>}

        {claimInfo && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border, #333)', paddingTop: '1rem' }}>
            <div className="table-row">
              <span>Status Klaim</span>
              <strong>{claimInfo.status.toUpperCase()}</strong>
            </div>

            <div className="table-row">
              <span>Penerima</span>
              <small>{claimInfo.recipient}</small>
            </div>

            {claimInfo.txHash && (
              <div className="table-row">
                <span>Bukti On-Chain</span>
                <strong>
                  <a
                    href={buildExplorerTxUrl(claimInfo.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Lihat di Explorer ↗
                  </a>
                </strong>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '2rem', fontSize: '0.875rem', opacity: 0.8 }}>
          <p className="eyebrow">INFORMASI SMART CONTRACT</p>
          <ul>
            <li>Jaringan: {MONAD_TESTNET.name} (Chain ID: {MONAD_TESTNET.id})</li>
            <li>Kontrak: BOAIArena (Operator Attested Commitment)</li>
            <li>Keamanan: Hadiah hanya dapat diklaim 1 kali per matchId oleh pemenang sah.</li>
          </ul>
          <Link to="/wallet" style={{ color: 'inherit', textDecoration: 'underline' }}>
            ← Kelola Dompet Terhubung
          </Link>
        </div>
      </div>
    </main>
  )
}
