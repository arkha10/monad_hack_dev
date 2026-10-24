/** The subset of EIP-1193 this page uses. No `any`, no vendored wallet SDK. */
export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
  isMetaMask?: boolean
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null
  return window.ethereum ?? null
}
