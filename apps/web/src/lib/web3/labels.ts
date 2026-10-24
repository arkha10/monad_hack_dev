import type { RewardClaim } from '@boai/shared/types'

/** Mandatory label. Mirrors apps/worker/src/chain/labels.ts; both apps own one copy each. */
export const TESTNET_LABEL = 'TESTNET · TANPA NILAI UANG'
export const NO_VALUE_NOTICE = 'Hadiah demo testnet tanpa nilai uang dan tidak dapat dicairkan.'
export const OPERATOR_ATTESTED_NOTICE =
  'Catatan on-chain adalah atestasi operator, bukan bukti kriptografis bahwa simulasi berjalan adil.'
export const NOT_CONFIGURED_NOTICE =
  'Kontrak testnet belum dikonfigurasi di server, jadi tidak ada transaksi yang bisa ditampilkan.'

export const MONAD_TESTNET_CHAIN_ID = 10143
export const MONAD_TESTNET_CHAIN_ID_HEX = '0x279f'
export const MONAD_TESTNET_RPC_URL = 'https://testnet-rpc.monad.xyz'
export const MONAD_TESTNET_EXPLORER_URL = 'https://testnet.monadscan.com'

export type RewardTone = 'ok' | 'wait' | 'bad'

export type RewardStatusView = { label: string; detail: string; tone: RewardTone }

/**
 * Single mapping from a RewardClaim status to what the page shows. Every branch states what
 * the chain does or does not prove, so no status can render as an unlabelled success.
 */
export const REWARD_STATUS_VIEW: Record<RewardClaim['status'], RewardStatusView> = {
  eligible: {
    label: 'Siap diklaim',
    detail: 'Match tercatat di testnet dan wallet Anda sudah terhubung.',
    tone: 'ok',
  },
  pending: {
    label: 'Menunggu konfirmasi',
    detail: 'Transaksi sudah dikirim. Konfirmasi berarti blok sudah final di Monad Testnet.',
    tone: 'wait',
  },
  confirmed: {
    label: 'Terkonfirmasi on-chain',
    detail: 'Hadiah demo sudah final di Monad Testnet. Buka tautan explorer untuk memeriksa transaksinya.',
    tone: 'ok',
  },
  already_claimed: {
    label: 'Sudah diklaim',
    detail: 'Kontrak menolak klaim kedua untuk match yang sama. Ini perilaku yang benar.',
    tone: 'wait',
  },
  ineligible: {
    label: 'Belum memenuhi syarat',
    detail: 'Hanya pemenang tercatat dengan wallet terhubung yang bisa mengklaim hadiah demo.',
    tone: 'bad',
  },
}

export function rewardStatusView(status: RewardClaim['status']): RewardStatusView {
  return REWARD_STATUS_VIEW[status]
}
