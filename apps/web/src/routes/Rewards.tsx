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
  const [matchId, setMatchId] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('matchId') ?? '',
  )
  const [claim, setClaim] = useState<RewardClaim | null>(null)
  const [failure, setFailure] = useState<RewardFailure | null>(null)
  const [busy, setBusy] = useState<'eligibility' | 'claim' | null>(null)

  const unavailable = failure !== null && isRewardSurfaceUnavailable(failure)
  const view = claim === null ? null : rewardStatusView(claim.status)
  const canClaim = claim !== null && claim.status === 'eligible' && hasLinkedWallet(claim.recipient)

  const check = async () => {
    const id = matchId.trim()
    if (id.length === 0) {
      setFailure({ kind: 'other', message: 'Please enter a match ID first.' })
      setClaim(null)
      return
    }
    setBusy('eligibility')
    setFailure(null)
    try {
      await api.getResult(id)
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
      <p className="eyebrow">WEB3 · MONAD TESTNET REWARDS</p>
      <h1>Demo Rewards (Hadiah demo)</h1>
      <p className="lede">
        Verified match winners can claim one unit of demo reward tokens on Monad Testnet. The smart contract
        rejects duplicate claims for the same match (menolak klaim kedua).
      </p>

      <TestnetBadge detail={NO_VALUE_NOTICE} />

      <section className="panel">
        <label>
          Match ID
          <input
            value={matchId}
            onChange={event => setMatchId(event.target.value)}
            placeholder="e.g. match-123456"
            maxLength={128}
          />
        </label>
        <div className="button-row">
          <button onClick={() => void check()} disabled={busy !== null}>
            {busy === 'eligibility' ? 'Checking…' : 'Check Eligibility'}
          </button>
          {canClaim ? (
            <button onClick={() => void doClaim()} disabled={busy !== null}>
              {busy === 'claim' ? 'Submitting claim…' : 'Claim Demo Reward'}
            </button>
          ) : null}
        </div>

        {unavailable ? (
          <div className="notice error">
            <strong>Chain service unavailable.</strong>{' '}
            {failure.kind === 'not-configured'
              ? 'Testnet contract is not configured on the server. No transactions can be displayed.'
              : 'Backend relayer could not be reached. No transactions can be displayed.'}
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
                <b>STATUS</b> {claim.status.toUpperCase()}
              </span>
              <span>
                <b>RECIPIENT</b>{' '}
                {hasLinkedWallet(claim.recipient) ? (
                  <AddressChip address={claim.recipient} />
                ) : (
                  <span className="muted">wallet not linked</span>
                )}
              </span>
              <span>
                <b>TX HASH</b>{' '}
                {claim.txHash !== null ? (
                  <a href={buildExplorerTxUrl(claim.txHash)} target="_blank" rel="noreferrer">
                    View transaction on explorer ↗
                  </a>
                ) : (
                  <span className="muted">pending transaction</span>
                )}
              </span>
            </div>

            {!hasLinkedWallet(claim.recipient) ? (
              <p className="muted">
                Connect your Monad Testnet wallet on the Wallet page before claiming. Rewards can only be distributed
                to server-verified wallets.
              </p>
            ) : null}
            {claim.status === 'pending' ? (
              <p className="muted">
                Transaction submitted but block is not yet finalized. Check back in a few seconds; repeat claims will
                be rejected.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel side-panel">
        <p className="eyebrow">WHAT THIS RECORD PROVES</p>
        <ul>
          <li>{TESTNET_LABEL}</li>
          <li>Each match result can only be paid out once by the on-chain contract.</li>
          <li>Only verified winning accounts with linked wallets can claim.</li>
          <li>Only the relayer possessing RECORDER_ROLE can record match outcomes.</li>
        </ul>
        <p className="muted">{OPERATOR_ATTESTED_NOTICE}</p>
        <p className="muted">
          Transaction hashes prove data existence on Monad Testnet without monetary value or off-chain cash-out rights.
        </p>
      </section>
    </main>
  )
}
