import { TESTNET_LABEL } from '../../lib/web3/labels'

/**
 * The mandatory testnet disclaimer. Rendered on every Web3 surface, because a reward page
 * without it reads as an asset page.
 */
export function TestnetBadge({ detail }: { detail?: string }) {
  return (
    <div className="notice testnet-badge">
      <strong>{TESTNET_LABEL}</strong>
      <span>{detail ?? 'Hadiah demo tanpa nilai uang, tidak dapat dicairkan, dan bukan BOAI_CREDIT.'}</span>
    </div>
  )
}
