export type ChainErrorCode =
  | 'CHAIN_NOT_CONFIGURED'
  | 'CHAIN_RETRYABLE'
  | 'CHAIN_MATCH_ALREADY_RECORDED'
  | 'CHAIN_REJECTED'

/**
 * Raised when BOAI_CONTRACT_ADDRESS (or the rest of the chain config) is absent. Callers
 * degrade to `chainTxHash: null` and show a labelled "not configured" state instead of
 * pretending a transaction happened.
 */
export class ChainNotConfiguredError extends Error {
  readonly code: ChainErrorCode = 'CHAIN_NOT_CONFIGURED'
  readonly retryable = false
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Konfigurasi chain belum lengkap: ${missing.join(', ')}`)
    this.name = 'ChainNotConfiguredError'
    this.missing = missing
  }
}

/**
 * A failure the operator can retry without changing intent: a freshly funded relayer inside
 * Monad's ~1.2s reserve-balance window, a nonce race, or a receipt that has not reached
 * `finalized` yet. Never a permanent rejection.
 */
export class ChainRetryableError extends Error {
  readonly code: ChainErrorCode = 'CHAIN_RETRYABLE'
  readonly retryable = true
  readonly txHash: `0x${string}` | null
  readonly reason: string

  constructor(reason: string, txHash: `0x${string}` | null = null) {
    super(`Transaksi chain belum bisa dipastikan, silakan coba lagi: ${reason}`)
    this.name = 'ChainRetryableError'
    this.reason = reason
    this.txHash = txHash
  }
}

/**
 * The match is already on-chain. No second transaction is sent. The adapter cannot invent a
 * transaction hash for a write it did not make, and the frozen ChainAdapter return type has
 * no "already recorded" variant, so it reports the convergence as a typed signal that the
 * handler maps to a successful idempotent response.
 */
export class MatchAlreadyRecordedError extends Error {
  readonly code: ChainErrorCode = 'CHAIN_MATCH_ALREADY_RECORDED'
  readonly retryable = false
  readonly matchId: string

  constructor(matchId: string) {
    super(`Match ${matchId} sudah tercatat on-chain`)
    this.name = 'MatchAlreadyRecordedError'
    this.matchId = matchId
  }
}

/** The chain answered and refused the call: an unrecorded match, a claimed reward, a bad recipient. */
export class ChainRejectedError extends Error {
  readonly code: ChainErrorCode = 'CHAIN_REJECTED'
  readonly retryable = false
  readonly reason: string

  constructor(reason: string) {
    super(`Transaksi ditolak kontrak: ${reason}`)
    this.name = 'ChainRejectedError'
    this.reason = reason
  }
}
