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
      setAdStatus('Memproses klaim simulasi iklan…')
      const res = await api.claimDemoAdReward()
      setCredits(res.data.balance)
      setAdStatus('Berhasil! +25 BOAI_CREDIT telah ditambahkan ke dompet Anda.')
    } catch (error) {
      setAdStatus(error instanceof Error ? error.message : 'Klaim reward belum tersedia')
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
      if (provider === null) throw new Error('Wallet tidak terdeteksi.')
      const signature = await provider.request({
        method: 'personal_sign',
        params: [toHex(nonce.data.message), wallet.address],
      })
      if (typeof signature !== 'string') throw new Error('Wallet tidak mengembalikan tanda tangan.')

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
        <p className="eyebrow">DOMPET VIRTUAL IN-GAME · BOAI CREDITS</p>
        <h2>Saldo Kredit Pemain</h2>
        <p className="microcopy">
          Kredit virtual in-game dipakai untuk memasang stake saat antrean PvP dan membeli kosmetik di Toko. Kredit ini
          tidak dapat ditukar dengan uang nyata.
        </p>

        <div className="credit-metrics">
          <div className="credit-metric-box">
            <small>KREDIT TERSEDIA</small>
            <div className="metric-val">🪙 {credits !== null ? credits.available : '100'}</div>
            <span className="metric-unit">BOAI_CREDIT</span>
          </div>
          <div className="credit-metric-box">
            <small>KREDIT TERTAHAN (QUEUE)</small>
            <div className="metric-val">{credits !== null ? credits.reserved : '0'}</div>
            <span className="metric-unit">BOAI_CREDIT</span>
          </div>
          <div className="credit-metric-box">
            <small>STATUS PEMAIN</small>
            <div className="metric-val" style={{ fontSize: '1.2rem', color: '#10b981' }}>AKTIF</div>
            <span className="metric-unit">Starter: 100 Diberikan</span>
          </div>
        </div>

        <div className="button-row">
          <button onClick={() => void claimAdReward()}>
            + Tonton Simulasi Iklan (+25 Kredit)
          </button>
          <a href="/shop" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 18px', border: '1px solid var(--amber)', color: 'var(--parchment)', textDecoration: 'none', borderRadius: '3px', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
            Buka Toko Kosmetik
          </a>
          <a href="/practice" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 18px', border: '1px solid var(--line)', color: 'var(--parchment-soft)', textDecoration: 'none', borderRadius: '3px', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
            Main Latihan
          </a>
        </div>
        {adStatus && <div className="notice" style={{ marginTop: '12px' }}>{adStatus}</div>}
      </section>

      {/* 2. Monad Testnet Web3 Wallet Section */}
      <p className="eyebrow">WEB3 ON-CHAIN · MONAD TESTNET</p>
      <h1>Hubungkan Web3 Wallet</h1>
      <p className="lede">
        Wallet on-chain hanya dipakai untuk menerima token hadiah demo Monad Testnet (1 BOAI-DEMO per match). Bermain
        tidak memerlukan wallet, dan halaman ini tidak pernah meminta private key atau seed phrase.
      </p>

      <TestnetBadge />

      <section className="panel">
        <div className="button-row">
          {wallet.address === null ? (
            <button onClick={() => void wallet.connect()} disabled={wallet.connecting}>
              {wallet.connecting ? 'Meminta izin wallet…' : 'Hubungkan wallet'}
            </button>
          ) : (
            <button className="secondary" onClick={() => void wallet.connect()}>
              Ganti akun
            </button>
          )}
          {wallet.provider === null ? <span className="badge">WALLET TIDAK TERDETEKSI</span> : null}
        </div>

        {wallet.provider === null ? (
          <div className="notice">
            Tidak ada wallet yang terdeteksi di browser ini. Pasang wallet EVM yang mendukung Monad Testnet, lalu muat
            ulang halaman. Tanpa wallet, Anda tetap bisa bermain dan melihat hasil pertandingan.
          </div>
        ) : null}

        {wallet.address !== null ? (
          <div className="wallet-detail">
            <AddressChip address={wallet.address} label="ALAMAT" />
            <span className="wallet-chain">
              <small>CHAIN ID</small>
              <code>{wallet.chainId ?? 'belum dilaporkan'}</code>
            </span>
          </div>
        ) : null}

        {wallet.address !== null && !chainSupported ? (
          <div className="notice error">
            <strong>Jaringan tidak sesuai.</strong> Wallet Anda tidak berada di Monad Testnet (chain ID{' '}
            {MONAD_TESTNET_CHAIN_ID}). Pindah jaringan diperlukan sebelum hadiah demo bisa dikirim.
            <div className="button-row">
              <button onClick={() => void wallet.switchToMonadTestnet()}>Pindah ke Monad Testnet</button>
            </div>
          </div>
        ) : null}

        {wallet.address !== null && chainSupported ? (
          <div className="notice">
            Wallet berada di Monad Testnet. Lanjutkan dengan menandatangani pesan nonce sekali pakai. Tanda tangan ini
            tidak mengirim transaksi dan tidak memindahkan dana.
            <div className="button-row">
              <button onClick={() => void linkWallet()} disabled={step !== 'idle' && step !== 'done'}>
                {step === 'nonce'
                  ? 'Meminta nonce…'
                  : step === 'signing'
                    ? 'Menunggu tanda tangan…'
                    : step === 'linking'
                      ? 'Memverifikasi tanda tangan…'
                      : 'Tandatangani dan hubungkan'}
              </button>
            </div>
          </div>
        ) : null}

        {wallet.error !== null ? <div className="notice error">{wallet.error.message}</div> : null}
        {failure !== null ? <div className="notice error">{failure}</div> : null}

        {link !== null ? (
          <div className="notice">
            <strong>Wallet terverifikasi.</strong> Alamat {link.address} terhubung pada chain ID {link.chainId}. Waktu
            verifikasi: {new Date(link.verifiedAt).toLocaleString('id-ID')}.
            <div className="button-row">
              <a className="button-link" href={`${MONAD_TESTNET_EXPLORER_URL}/address/${link.address}`}>
                Lihat alamat di explorer ↗
              </a>
              <a href="/rewards" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', background: 'var(--amber)', color: 'var(--ink)', fontWeight: 900, textDecoration: 'none', borderRadius: '3px' }}>
                Klaim Hadiah di Halaman Hadiah ↗
              </a>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel side-panel">
        <p className="eyebrow">BATASAN YANG HARUS DIKETAHUI</p>
        <ul>
          <li>Tidak ada private key atau seed phrase yang diminta, dikirim, atau disimpan.</li>
          <li>Tanda tangan hanya membuktikan Anda menguasai alamat tersebut.</li>
          <li>Hadiah demo tidak dapat ditukar menjadi uang, MON, atau BOAI_CREDIT.</li>
          <li>Mengaitkan wallet tidak memberi hak klaim otomatis; pemenang tetap diverifikasi server.</li>
        </ul>
        <p className="muted">
          Wallet yang sudah terhubung tidak bisa dipakai untuk mengklaim match yang bukan milik akun Anda. Klaim
          diverifikasi dari catatan server, bukan dari data yang dikirim browser.
        </p>
      </section>
    </main>
  )
}
