import { useEffect, useState } from 'react'
import { toHex } from 'viem'
import type { CreditBalance, WalletLink } from '@boai/shared/types'
import { api } from '../lib/api'
import { useWallet, walletChainIsSupported } from '../lib/web3/useWallet'
import { describeWalletError } from '../lib/web3/chain'
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_EXPLORER_URL } from '../lib/web3/labels'
import { AddressChip } from '../components/web3/AddressChip'
import { TestnetBadge } from '../components/web3/TestnetBadge'

type LinkStep = 'idle' | 'nonce' | 'signing' | 'linking' | 'done'

export function WalletPage() {
  const wallet = useWallet()
  const [step, setStep] = useState<LinkStep>('idle')
  const [link, setLink] = useState<WalletLink | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [credits, setCredits] = useState<CreditBalance | null>(null)
  const [adStatus, setAdStatus] = useState<string | null>(null)

  const fetchCredits = async () => {
    try {
      const res = await api.getCredits()
      if (res && res.data) setCredits(res.data)
    } catch {
      // Guest or session pending
    }
  }

  useEffect(() => {
    void fetchCredits()
  }, [])

  const claimAdReward = async () => {
    try {
      setAdStatus('Processing simulated ad claim…')
      const res = await api.claimDemoAdReward()
      setCredits(res.data.balance)
      setAdStatus('Success! +25 BOAI_CREDIT added to your balance.')
    } catch (error) {
      setAdStatus(error instanceof Error ? error.message : 'Reward claim not yet available')
    }
  }

  const chainSupported = walletChainIsSupported(wallet.chainId)

  const linkWallet = async () => {
    if (wallet.address === null) return
    setFailure(null)
    setLink(null)

    try {
      setStep('nonce')
      const nonce = await api.requestWalletNonce(wallet.address)

      setStep('signing')
      const provider = wallet.provider
      if (provider === null) throw new Error('No wallet detected.')
      const signature = await provider.request({
        method: 'personal_sign',
        params: [toHex(nonce.data.message), wallet.address],
      })
      if (typeof signature !== 'string') throw new Error('Wallet did not return a signature.')

      setStep('linking')
      const linked = await api.linkWallet(wallet.address, signature as `0x${string}`)
      setLink(linked.data)
      setStep('done')
    } catch (error) {
      setStep('idle')
      setFailure(describeWalletError(error).message)
    }
  }

  return (
    <main className="content narrow">
      {/* 1. In-game Credit Wallet Section */}
      <section className="credit-wallet-panel">
        <p className="eyebrow">IN-GAME VIRTUAL WALLET · BOAI CREDITS</p>
        <h2>Player Credit Balance</h2>
        <p className="microcopy">
          Virtual in-game credits are used to stake in PvP matchmaking queues and acquire cosmetic skins in the Shop.
          These credits are non-redeemable and hold no real monetary value.
        </p>

        <div className="credit-metrics">
          <div className="credit-metric-box">
            <small>AVAILABLE CREDITS</small>
            <div className="metric-val">🪙 {credits !== null ? credits.available : '100'}</div>
            <span className="metric-unit">BOAI_CREDIT</span>
          </div>
          <div className="credit-metric-box">
            <small>RESERVED CREDITS (QUEUE)</small>
            <div className="metric-val">{credits !== null ? credits.reserved : '0'}</div>
            <span className="metric-unit">BOAI_CREDIT</span>
          </div>
          <div className="credit-metric-box">
            <small>PLAYER STATUS</small>
            <div className="metric-val" style={{ fontSize: '1.2rem', color: '#10b981' }}>ACTIVE</div>
            <span className="metric-unit">Starter: 100 Granted</span>
          </div>
        </div>

        <div className="button-row">
          <button onClick={() => void claimAdReward()}>
            + Watch Simulated Ad (+25 Credits)
          </button>
          <a href="/shop" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 18px', border: '1px solid var(--amber)', color: 'var(--parchment)', textDecoration: 'none', borderRadius: '3px', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
            Open Cosmetics Shop
          </a>
          <a href="/practice" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 18px', border: '1px solid var(--line)', color: 'var(--parchment-soft)', textDecoration: 'none', borderRadius: '3px', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
            Practice Arena
          </a>
        </div>
        {adStatus && <div className="notice" style={{ marginTop: '12px' }}>{adStatus}</div>}
      </section>

      {/* 2. Monad Testnet Web3 Wallet Section */}
      <p className="eyebrow">WEB3 ON-CHAIN · MONAD TESTNET</p>
      <h1>Connect Web3 Wallet</h1>
      <p className="lede">
        On-chain wallets are used solely to receive Monad Testnet demo reward tokens (1 BOAI-DEMO per match). Playing
        does not require a wallet, and this page never requests your private key or seed phrase.
      </p>

      <TestnetBadge />

      <section className="panel">
        <div className="button-row">
          {wallet.address === null ? (
            <button onClick={() => void wallet.connect()} disabled={wallet.connecting}>
              {wallet.connecting ? 'Requesting wallet permissions…' : 'Connect Wallet (Hubungkan wallet)'}
            </button>
          ) : (
            <button className="secondary" onClick={() => void wallet.connect()}>
              Switch Account
            </button>
          )}
          {wallet.provider === null ? <span className="badge">WALLET NOT DETECTED</span> : null}
        </div>

        {wallet.provider === null ? (
          <div className="notice">
            No EVM wallet detected in this browser. Install a Web3 wallet supporting Monad Testnet (e.g. MetaMask, Rabby), then
            refresh this page. You can still play and view match results without a wallet.
          </div>
        ) : null}

        {wallet.address !== null ? (
          <div className="wallet-detail">
            <AddressChip address={wallet.address} label="ADDRESS" />
            <span className="wallet-chain">
              <small>CHAIN ID</small>
              <code>{wallet.chainId ?? 'not reported'}</code>
            </span>
          </div>
        ) : null}

        {wallet.address !== null && !chainSupported ? (
          <div className="notice error">
            <strong>Network mismatch.</strong> Your wallet is not on Monad Testnet (chain ID{' '}
            {MONAD_TESTNET_CHAIN_ID}). Network switch is required before demo rewards can be sent.
            <div className="button-row">
              <button onClick={() => void wallet.switchToMonadTestnet()}>Switch to Monad Testnet</button>
            </div>
          </div>
        ) : null}

        {wallet.address !== null && chainSupported ? (
          <div className="notice">
            Wallet connected to Monad Testnet. Proceed by signing a one-time nonce message. This gasless signature
            does not send any transaction and moves no funds.
            <div className="button-row">
              <button onClick={() => void linkWallet()} disabled={step !== 'idle' && step !== 'done'}>
                {step === 'nonce'
                  ? 'Requesting nonce…'
                  : step === 'signing'
                    ? 'Waiting for signature…'
                    : step === 'linking'
                      ? 'Verifying signature…'
                      : 'Sign and Link Wallet'}
              </button>
            </div>
          </div>
        ) : null}

        {wallet.error !== null ? <div className="notice error">{wallet.error.message}</div> : null}
        {failure !== null ? <div className="notice error">{failure}</div> : null}

        {link !== null ? (
          <div className="notice">
            <strong>Wallet Verified.</strong> Address {link.address} linked on chain ID {link.chainId}. Verified
            at: {new Date(link.verifiedAt).toISOString()}.
            <div className="button-row">
              <a className="button-link" href={`${MONAD_TESTNET_EXPLORER_URL}/address/${link.address}`} target="_blank" rel="noreferrer">
                View address on explorer ↗
              </a>
              <a href="/rewards" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', background: 'var(--amber)', color: 'var(--ink)', fontWeight: 900, textDecoration: 'none', borderRadius: '3px' }}>
                Claim Rewards on Rewards Page ↗
              </a>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel side-panel">
        <p className="eyebrow">ESSENTIAL LIMITATIONS</p>
        <ul>
          <li>No private key or seed phrase is ever requested, transmitted, or stored.</li>
          <li>The gasless signature only verifies that you own and control the address.</li>
          <li>Demo rewards are non-convertible into fiat currency, MON, or BOAI_CREDIT.</li>
          <li>Linking a wallet does not guarantee claims; winners are strictly verified by the server.</li>
        </ul>
        <p className="muted">
          A linked wallet cannot be used to claim matches not won by your account. Claims are validated directly from server
          ledger records, not client-submitted claims.
        </p>
      </section>
    </main>
  )
}
