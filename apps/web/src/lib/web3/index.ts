export const MONAD_TESTNET = {
  id: 10143,
  hexId: '0x279f',
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  explorerUrl: 'https://testnet.monadscan.com',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
} as const

export function buildExplorerTxUrl(txHash: string): string {
  return `${MONAD_TESTNET.explorerUrl}/tx/${txHash}`
}

export function buildExplorerAddressUrl(address: string): string {
  return `${MONAD_TESTNET.explorerUrl}/address/${address}`
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

export async function detectWalletProvider(): Promise<boolean> {
  return typeof window !== 'undefined' && Boolean(window.ethereum)
}

export async function requestWalletConnection(): Promise<`0x${string}`> {
  if (!window.ethereum) {
    throw new Error('MetaMask atau wallet Web3 tidak ditemukan di browser Anda.')
  }

  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts || accounts.length === 0) {
    throw new Error('Tidak ada akun yang terhubung dari MetaMask.')
  }

  await ensureMonadTestnet()
  return accounts[0] as `0x${string}`
}

export async function ensureMonadTestnet(): Promise<void> {
  if (!window.ethereum) return

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET.hexId }],
    })
  } catch (error: unknown) {
    const err = error as { code?: number }
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: MONAD_TESTNET.hexId,
            chainName: MONAD_TESTNET.name,
            rpcUrls: [MONAD_TESTNET.rpcUrl],
            nativeCurrency: MONAD_TESTNET.nativeCurrency,
            blockExplorerUrls: [MONAD_TESTNET.explorerUrl],
          },
        ],
      })
    } else {
      throw error
    }
  }
}

export async function signNonceMessage(address: `0x${string}`, message: string): Promise<`0x${string}`> {
  if (!window.ethereum) {
    throw new Error('Wallet tidak tersedia untuk penandatanganan nonce.')
  }

  const signature = (await window.ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  })) as `0x${string}`

  return signature
}
