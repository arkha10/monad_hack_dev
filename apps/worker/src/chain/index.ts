export { handleChainRequest, type ChainLookup } from './handler'
export {
  createChainAdapter,
  createChainAdapterFromEnv,
  createChainReaderFromEnv,
  classifyChainError,
} from './adapter'
export { readChainConfig, readRelayerKey, readCommitmentSalt, isChainConfigured } from './config'
export { toChainMatchId } from './matchIdHash'
export { buildWinnerCommitment } from './winnerCommitment'
export { deriveEligibility } from './eligibility'
export { BOAI_ARENA_ABI } from './abi'
export {
  ChainNotConfiguredError,
  ChainRejectedError,
  ChainRetryableError,
  MatchAlreadyRecordedError,
} from './errors'
