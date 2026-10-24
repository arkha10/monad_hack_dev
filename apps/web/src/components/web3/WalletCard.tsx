import { MONAD_TESTNET, buildExplorerAddressUrl } from '../../lib/web3'

interface WalletCardProps {
  address: `0x${string}`
  chainId: number | null
  onDisconnect?: () => void
}

export function WalletCard({ address, chainId, onDisconnect }: WalletCardProps) {
  const isCorrect = chainId === MONAD_TESTNET.id

  return (
    <div className="panel profile-card">
      <div className="table-row">
        <span>Address</span>
        <strong>
          <a href={buildExplorerAddressUrl(address)} target="_blank" rel="noreferrer">
            {address.slice(0, 6)}...{address.slice(-4)}
          </a>
        </strong>
      </div>
      <div className="table-row">
        <span>Network</span>
        <strong style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}>
          {isCorrect ? MONAD_TESTNET.name : `Chain ${chainId ?? 'Unknown'}`}
        </strong>
      </div>
      {onDisconnect && (
        <button className="secondary" onClick={onDisconnect} style={{ marginTop: '0.75rem' }}>
          Putuskan Dompet
        </button>
      )}
    </div>
  )
}
