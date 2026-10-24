import { shortenAddress } from '../../lib/web3/address'

/** Read-only address chip. It shows a shortened form and keeps the full value in `title`. */
export function AddressChip({ address, label }: { address: `0x${string}`; label?: string }) {
  return (
    <span className="address-chip" title={address}>
      {label ? <small>{label}</small> : null}
      <code>{shortenAddress(address)}</code>
    </span>
  )
}
