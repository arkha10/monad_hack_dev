/**
 * Every reward-facing string and header lives here so the testnet framing cannot drift
 * between the eligibility read, the claim write and the internal record write.
 *
 * The Indonesian label is not put in an HTTP header because header values must be a
 * ByteString. Responses carry `x-boai-network: monad-testnet` instead, and the UI renders
 * the label from its own copy in apps/web/src/lib/web3/labels.ts.
 */
export const TESTNET_NETWORK = 'monad-testnet'
export const NETWORK_HEADER = 'x-boai-network'

export const TESTNET_LABEL = 'TESTNET · TANPA NILAI UANG'
export const NO_VALUE_NOTICE = 'Hadiah demo testnet tanpa nilai uang. Tidak dapat dicairkan.'
export const OPERATOR_ATTESTED_NOTICE =
  'Catatan ini adalah atestasi operator, bukan bukti kriptografis bahwa simulasi berjalan adil.'

/** Sentinel recipient when a winner has no linked wallet. The contract refuses it. */
export const NO_RECIPIENT = '0x0000000000000000000000000000000000000000' as const

export const CHAIN_MESSAGES = {
  notConfigured: `Kontrak testnet belum dikonfigurasi di server. ${TESTNET_LABEL}.`,
  matchNotRecorded: `Hasil match belum dicatat ke testnet. ${TESTNET_LABEL}.`,
  matchNotFinal: 'Hasil match belum final di server, jadi belum bisa dicatat ke testnet.',
  notWinner: `Akun ini bukan pemenang tercatat untuk match tersebut. ${TESTNET_LABEL}.`,
  walletNotLinked: 'Hubungkan wallet Monad Testnet dulu agar hadiah demo bisa dikirim.',
  alreadyClaimed: `Hadiah demo untuk match ini sudah diklaim. ${TESTNET_LABEL}.`,
  internalOnly: 'Endpoint ini hanya untuk pemanggilan internal server.',
  internalSecretUnset: 'CHAIN_INTERNAL_SECRET belum diset di server.',
  authRequired: 'Sesi login diperlukan untuk mengakses hadiah testnet.',
  retryable: 'RPC testnet sedang sibuk atau relayer baru didanai. Coba lagi beberapa detik lagi.',
} as const
