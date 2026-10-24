import { useEffect, useState } from 'react'
import {
  MONAD_TESTNET,
  detectWalletProvider,
  requestWalletConnection,
  ensureMonadTestnet,
  signNonceMessage,
  buildExplorerAddressUrl,
} from '../lib/web3'
import { api } from '../lib/api'

export default function WalletPage() {
  const [hasProvider, setHasProvider] = useState(false)
  const [address, setAddress] = useState<`0x${string}` | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('')
  const [linked, setLinked] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)

  useEffect(() => {
    detectWalletProvider().then(available => {
      setHasProvider(available)
      if (available && window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
          const list = accounts as string[]
          if (list && list.length > 0) {
            setAddress(list[0] as `0x${string}`)
          }
        }).catch(() => {})

        window.ethereum.request({ method: 'eth_chainId' }).then(id => {
          setChainId(parseInt(id as string, 16))
        }).catch(() => {})

        if (window.ethereum.on) {
          window.ethereum.on('accountsChanged', (accounts: unknown) => {
            const list = accounts as string[]
            setAddress(list.length > 0 ? (list[0] as `0x${string}`) : null)
            setLinked(false)
          })
          window.ethereum.on('chainChanged', (id: unknown) => {
            setChainId(parseInt(id as string, 16))
          })
        }
      }
    })
  }, [])

  const handleConnect = async () => {
    try {
      setBusy(true)
      setStatus('Menghubungkan ke dompet Web3...')
      const acc = await requestWalletConnection()
      setAddress(acc)
      setChainId(MONAD_TESTNET.id)
      setStatus('Dompet berhasil terhubung ke Monad Testnet!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Koneksi dompet gagal')
    } finally {
      setBusy(false)
    }
  }

  const handleSwitchNetwork = async () => {
    try {
      setBusy(true)
      setStatus('Meminta perpindahan ke Monad Testnet...')
      await ensureMonadTestnet()
      setChainId(MONAD_TESTNET.id)
      setStatus('Jaringan berhasil dialihkan ke Monad Testnet!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Gagal beralih jaringan')
    } finally {
      setBusy(false)
    }
  }

  const handleLinkWallet = async () => {
    if (!address) return
    try {
      setBusy(true)
      setStatus('Meminta challenge nonce dari server...')
      const nonceRes = await api.requestWalletNonce(address)
      setStatus('Silakan tandatangani pesan di MetaMask...')
      const signature = await signNonceMessage(address, nonceRes.data.message)
      setStatus('Memverifikasi tanda tangan...')
      await api.linkWallet(address, signature)
      setLinked(true)
      setStatus('Dompet berhasil diverifikasi & ditautkan dengan akun!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Verifikasi dompet gagal')
    } finally {
      setBusy(false)
    }
  }

  const isCorrectNetwork = chainId === MONAD_TESTNET.id

  return (
    <main className="content narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">WEB3 WALLET · MONAD TESTNET</p>
          <h1>Koneksi Dompet Web3</h1>
          <p>Tautkan dompet EVM untuk mengklaim reward demo turnamen di jaringan Monad Testnet.</p>
        </div>
        <span className="badge">TESTNET · TANPA NILAI UANG</span>
      </div>

      <div className="panel profile-card">
        {!hasProvider ? (
          <div className="notice error">
            MetaMask atau ekstensi Web3 tidak terdeteksi. Silakan gunakan browser dengan ekstensi Web3.
          </div>
        ) : !address ? (
          <div>
            <p>Hubungkan dompet Anda untuk melihat status jaringan dan klaim hadiah uji coba.</p>
            <div className="button-row">
              <button onClick={handleConnect} disabled={busy}>
                {busy ? 'Menghubungkan...' : 'Hubungkan MetaMask ↗'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="table-row">
              <span>Alamat Dompet</span>
              <strong>
                <a
                  href={buildExplorerAddressUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  {address.slice(0, 6)}...{address.slice(-4)} ↗
                </a>
              </strong>
            </div>

            <div className="table-row">
              <span>Jaringan Aktif</span>
              <strong style={{ color: isCorrectNetwork ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)' }}>
                {isCorrectNetwork ? 'Monad Testnet (10143)' : `Chain ID: ${chainId ?? 'Unknown'}`}
              </strong>
            </div>

            <div className="table-row">
              <span>Status Tautan</span>
              <strong>{linked ? 'Terverifikasi' : 'Belum Ditautkan'}</strong>
            </div>

            <div className="button-row" style={{ marginTop: '1rem' }}>
              {!isCorrectNetwork ? (
                <button onClick={handleSwitchNetwork} disabled={busy}>
                  Beralih ke Monad Testnet
                </button>
              ) : !linked ? (
                <button onClick={handleLinkWallet} disabled={busy}>
                  Verifikasi Kepemilikan (Tanda Tangan)
                </button>
              ) : (
                <span className="badge">DOMPET SIAP KLAIM</span>
              )}
            </div>
          </div>
        )}

        {status && <div className="notice" style={{ marginTop: '1rem' }}>{status}</div>}

        <p className="microcopy" style={{ marginTop: '1.5rem' }}>
          Keamanan: Aplikasi tidak pernah meminta kata sandi atau private key Anda. Token uji coba Monad Testnet tidak bernilai uang nyata.
        </p>
      </div>
    </main>
  )
}
