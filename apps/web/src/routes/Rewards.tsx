import { useState } from 'react'
import { buildExplorerTxUrl } from '@boai/shared/helpers'
import type { RewardClaim } from '@boai/shared/types'
import { api } from '../lib/api'
import { hasLinkedWallet } from '../lib/web3/address'
import { classifyRewardFailure, isRewardSurfaceUnavailable, type RewardFailure } from '../lib/web3/failure'
import { NO_VALUE_NOTICE, OPERATOR_ATTESTED_NOTICE, rewardStatusView, TESTNET_LABEL } from '../lib/web3/labels'
import { AddressChip } from '../components/web3/AddressChip'
import { TestnetBadge } from '../components/web3/TestnetBadge'

export function RewardsPage() {
  const [matchId, setMatchId] = useState('')
  const [claim, setClaim] = useState<RewardClaim | null>(null)
  const [failure, setFailure] = useState<RewardFailure | null>(null)
  const [busy, setBusy] = useState<'eligibility' | 'claim' | null>(null)

  const unavailable = failure !== null && isRewardSurfaceUnavailable(failure)
  const view = claim === null ? null : rewardStatusView(claim.status)
  const canClaim = claim !== null && claim.status === 'eligible' && hasLinkedWallet(claim.recipient)

  const check = async () => {
    const id = matchId.trim()
    if (id.length === 0) {
      setFailure({ kind: 'other', message: 'Isi match ID terlebih dahulu.' })
      setClaim(null)
      return
    }
    setBusy('eligibility')
    setFailure(null)
    try {
      const result = await api.getRewardEligibility(id)
      setClaim(result.data)
    } catch (error) {
      setClaim(null)
      setFailure(classifyRewardFailure(error))
    } finally {
      setBusy(null)
    }
  }

  const doClaim = async () => {
    if (claim === null) return
    setBusy('claim')
    setFailure(null)
    try {
      const result = await api.claimTestnetReward(claim.matchId)
      setClaim(result.data)
    } catch (error) {
      setFailure(classifyRewardFailure(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="content narrow">
      <p className="eyebrow">WEB3 · HADIAH TESTNET</p>
      <h1>Hadiah demo</h1>
      <p className="lede">
        Pemenang match yang sudah dicatat bisa menerima satu unit token demo di Monad Testnet. Kontrak menolak klaim
        kedua untuk match yang sama.
      </p>

      <TestnetBadge detail={NO_VALUE_NOTICE} />

      <section className="panel">
        <label>
          Match ID
          <input
            value={matchId}
            onChange={event => setMatchId(event.target.value)}
            placeholder="match-boai-pvp-001"
            maxLength={128}
          />
        </label>
        <div className="button-row">
          <button onClick={() => void check()} disabled={busy !== null}>
            {busy === 'eligibility' ? 'Memeriksa…' : 'Periksa kelayakan'}
          </button>
          {canClaim ? (
            <button onClick={() => void doClaim()} disabled={busy !== null}>
              {busy === 'claim' ? 'Mengirim klaim…' : 'Klaim hadiah demo'}
            </button>
          ) : null}
        </div>

        {unavailable ? (
          <div className="notice error">
            <strong>Layanan chain tidak tersedia.</strong>{' '}
            {failure.kind === 'not-configured'
              ? 'Kontrak testnet belum dikonfigurasi di server. Tidak ada transaksi yang bisa ditampilkan dan tidak ada klaim yang dikirim.'
              : 'Backend tidak dapat dihubungi. Tidak ada transaksi yang bisa ditampilkan dan tidak ada klaim yang dikirim.'}
            <p className="muted">{failure.message}</p>
          </div>
        ) : null}

        {failure !== null && !unavailable ? <div className="notice error">{failure.message}</div> : null}

        {claim !== null && view !== null ? (
          <div className="result-card">
            <span className="result-mark">◆</span>
            <h2>{view.label}</h2>
            <p>{view.detail}</p>
            <div className="result-grid">
              <span>
                <b>MATCH</b> {claim.matchId}
              </span>
              <span>
                <b>STATUS</b> {claim.status}
              </span>
              <span>
                <b>PENERIMA</b>{' '}
                {hasLinkedWallet(claim.recipient) ? (
                  <AddressChip address={claim.recipient} />
                ) : (
                  <span className="muted">wallet belum terhubung</span>
                )}
              </span>
              <span>
                <b>TX</b>{' '}
                {claim.txHash !== null ? (
                  <a href={buildExplorerTxUrl(claim.txHash)} target="_blank" rel="noreferrer">
                    Lihat transaksi di explorer ↗
                  </a>
                ) : (
                  <span className="muted">belum ada transaksi</span>
                )}
              </span>
            </div>

            {!hasLinkedWallet(claim.recipient) ? (
              <p className="muted">
                Hubungkan wallet Monad Testnet di halaman Wallet sebelum klaim. Hadiah hanya bisa dikirim ke wallet
                yang sudah diverifikasi server.
              </p>
            ) : null}
            {claim.status === 'pending' ? (
              <p className="muted">
                Transaksi sudah dikirim tetapi blok belum final. Periksa lagi beberapa detik kemudian; klaim ulang tidak
                akan membuat hadiah kedua.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel side-panel">
        <p className="eyebrow">APA YANG DIBUKTIKAN CATATAN INI</p>
        <ul>
          <li>{TESTNET_LABEL}</li>
          <li>Satu match hanya bisa dibayar satu kali oleh kontrak.</li>
          <li>Hanya pemenang tercatat yang diverifikasi server yang bisa klaim.</li>
          <li>Kontrak hanya bisa menulis bila pemanggil memegang RECORDER_ROLE.</li>
        </ul>
        <p className="muted">{OPERATOR_ATTESTED_NOTICE}</p>
        <p className="muted">
          Hash transaksi membuktikan bahwa data tercatat di Monad Testnet. Hash itu tidak membuktikan bahwa simulasi
          pertandingan berjalan adil, dan tidak memberi nilai uang apa pun.
        </p>
      </section>
    </main>
  )
}
