/** Shortens an EVM address for display. Never used for signing or comparison. */
export function shortenAddress(address: string, visible = 6): string {
  if (!address.startsWith('0x') || address.length < 2 + visible * 2) return address
  return `${address.slice(0, 2 + visible)}…${address.slice(-4)}`
}

/** The zero address is the sentinel the API uses for "no linked wallet". */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function hasLinkedWallet(address: string | null | undefined): boolean {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && address !== ZERO_ADDRESS
}
