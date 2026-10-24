import { MONAD_TESTNET_CHAIN_ID_HEX } from './labels'

export type ChainSwitchPlan =
  | { kind: 'ready' }
  | { kind: 'switch' }
  | { kind: 'add-and-switch' }

export type ChainSwitchInput = {
  currentChainId: string | null
  walletRejectedAddChain: boolean
}

/**
 * Decides what to do about the network, independent of any wallet object, so it can be
 * tested without a browser. `null` means the provider has not reported a chain yet.
 */
export function decideChainSwitch(input: ChainSwitchInput): ChainSwitchPlan {
  if (input.currentChainId === null) return { kind: 'ready' }
  if (input.currentChainId.toLowerCase() === MONAD_TESTNET_CHAIN_ID_HEX) return { kind: 'ready' }
  return input.walletRejectedAddChain ? { kind: 'add-and-switch' } : { kind: 'switch' }
}

export function isMonadTestnet(chainId: string | null): boolean {
  return chainId !== null && chainId.toLowerCase() === MONAD_TESTNET_CHAIN_ID_HEX
}

/** EIP-1193 error codes the wallet flow distinguishes. */
export const WALLET_ERROR_CODES = {
  userRejected: 4001,
  unauthorized: 4100,
  unsupportedMethod: 4200,
  disconnected: 4900,
  chainNotAdded: 4902,
} as const

export type WalletErrorKind = 'no-provider' | 'user-rejected' | 'wrong-chain' | 'expired-nonce' | 'unknown'

export type WalletErrorView = { kind: WalletErrorKind; message: string }

const EXPIRED_NONCE_HINTS = ['nonce', 'kadaluarsa', 'expired', 'challenge']

/**
 * Maps a wallet or API failure to one Bahasa Indonesia message. An expired nonce is
 * separated from a generic failure because the fix is "request a new nonce", not "retry".
 */
export function describeWalletError(error: unknown): WalletErrorView {
  if (error === null || error === undefined) {
    return { kind: 'unknown', message: 'Terjadi kesalahan yang tidak dikenali.' }
  }

  if (typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (code === WALLET_ERROR_CODES.userRejected) {
      return { kind: 'user-rejected', message: 'Permintaan ditolak di wallet. Tidak ada data yang dikirim.' }
    }
    if (code === WALLET_ERROR_CODES.unauthorized) {
      return { kind: 'user-rejected', message: 'Wallet belum memberi izin untuk akun ini.' }
    }
    if (code === WALLET_ERROR_CODES.disconnected) {
      return { kind: 'no-provider', message: 'Wallet terputus dari halaman ini.' }
    }
  }

  const text = error instanceof Error ? error.message : String(error)
  const lowered = text.toLowerCase()
  if (EXPIRED_NONCE_HINTS.some(hint => lowered.includes(hint))) {
    return { kind: 'expired-nonce', message: 'Nonce sudah kedaluwarsa. Minta nonce baru lalu tanda tangani lagi.' }
  }
  if (lowered.includes('wallet') && lowered.includes('tidak')) {
    return { kind: 'no-provider', message: text }
  }
  return { kind: 'unknown', message: text }
}
