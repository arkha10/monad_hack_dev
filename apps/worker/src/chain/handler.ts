import type { ApiEnvelope, ApiError, RewardClaim } from '@boai/shared/types'
import type { ChainAdapter } from '@boai/shared/contracts'
import { buildWinnerCommitment } from './winnerCommitment'
import { deriveEligibility } from './eligibility'
import { createChainAdapterFromEnv, createChainReaderFromEnv } from './adapter'
import { readCommitmentSalt } from './config'
import {
  CHAIN_MESSAGES,
  NETWORK_HEADER,
  NO_RECIPIENT,
  NO_VALUE_NOTICE,
  OPERATOR_ATTESTED_NOTICE,
  TESTNET_LABEL,
  TESTNET_NETWORK,
} from './labels'
import {
  ChainNotConfiguredError,
  ChainRejectedError,
  ChainRetryableError,
  MatchAlreadyRecordedError,
} from './errors'

/** The two B-owned lookups this handler is allowed to trust. Never a client-supplied winner. */
export type ChainLookup = {
  getAuthoritativeWinner(matchId: string): Promise<string | null>
  getVerifiedLinkedWallet(userId: string): Promise<`0x${string}` | null>
}

export type ChainHandlerDeps = {
  env: Record<string, string | undefined>
  lookup: ChainLookup
  authenticatedUserId: string | null
  /** Reads chain state. Needs only the contract address, so a GET works without a relayer key. */
  reader: Pick<ChainAdapter, 'getChainMatch'> | null
  /** Writes to the chain. Absent when the relayer key is not provisioned. */
  adapter: ChainAdapter | null
  requestId: string
}

const REWARDS_PREFIX = '/api/v1/chain/rewards/'
const CLAIM_PATH = '/api/v1/chain/reward-claim'
const RECORD_PATH = '/api/v1/chain/matches/record'
const INTERNAL_SECRET_HEADER = 'x-boai-internal-secret'

const labelHeaders = {
  [NETWORK_HEADER]: TESTNET_NETWORK,
  'x-boai-label': encodeURIComponent(TESTNET_LABEL),
}

function envelope<T>(data: T, requestId: string): Response {
  const body: ApiEnvelope<T> = { data, requestId }
  return Response.json(body, { status: 200, headers: labelHeaders })
}

function failure(code: string, message: string, status: number, retryable: boolean, requestId: string): Response {
  const body: ApiError = { error: { code, message, retryable } }
  return Response.json(body, {
    status,
    headers: { ...labelHeaders, 'x-boai-request-id': requestId },
  })
}

/** Length-independent comparison so the shared secret cannot be probed byte by byte. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (provided === null || expected.length === 0) return false
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let index = 0; index < provided.length; index += 1) {
    diff |= provided.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return diff === 0
}

function readMatchId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const value = (body as { matchId?: unknown }).matchId
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.length > 128 ? null : trimmed
}

function readHash(body: Record<string, unknown>, name: string): `0x${string}` | null {
  const value = body[name]
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null
  return value as `0x${string}`
}

function rewardClaim(
  status: RewardClaim['status'],
  recipient: `0x${string}`,
  matchId: string,
  txHash: `0x${string}` | null,
): RewardClaim {
  return { matchId, recipient, txHash, status }
}

function errorToResponse(error: unknown, requestId: string): Response {
  if (error instanceof ChainNotConfiguredError) {
    return failure('CHAIN_NOT_CONFIGURED', CHAIN_MESSAGES.notConfigured, 503, false, requestId)
  }
  if (error instanceof MatchAlreadyRecordedError) {
    return envelope({ txHash: null, confirmed: true, alreadyRecorded: true }, requestId)
  }
  if (error instanceof ChainRetryableError) {
    return failure('CHAIN_RETRYABLE', CHAIN_MESSAGES.retryable, 503, true, requestId)
  }
  if (error instanceof ChainRejectedError) {
    const message = error.reason === 'RewardAlreadyClaimed'
      ? CHAIN_MESSAGES.alreadyClaimed
      : error.reason === 'MatchNotRecorded'
        ? CHAIN_MESSAGES.matchNotRecorded
        : `${error.message}. ${TESTNET_LABEL}.`
    return failure('CHAIN_REJECTED', message, 409, false, requestId)
  }
  return failure('CHAIN_UNAVAILABLE', `${CHAIN_MESSAGES.retryable} ${NO_VALUE_NOTICE}`, 503, true, requestId)
}

async function handleEligibility(deps: ChainHandlerDeps, matchId: string): Promise<Response> {
  const userId = deps.authenticatedUserId
  if (userId === null) return failure('AUTH_REQUIRED', CHAIN_MESSAGES.authRequired, 401, false, deps.requestId)
  if (deps.reader === null) return failure('CHAIN_NOT_CONFIGURED', CHAIN_MESSAGES.notConfigured, 503, false, deps.requestId)

  try {
    const [authoritativeWinner, linkedWallet] = await Promise.all([
      deps.lookup.getAuthoritativeWinner(matchId),
      deps.lookup.getVerifiedLinkedWallet(userId),
    ])

    // A read failure is reported as "not recorded yet" rather than as a reward, so an RPC
    // blip can never make the UI claim a match is on-chain.
    const chain = await deps.reader.getChainMatch(matchId).catch(() => ({ exists: false, claimed: false }))

    const { status, recipient } = deriveEligibility({
      chainConfigured: true,
      authenticatedUserId: userId,
      authoritativeWinner,
      linkedWallet,
      chain,
    })

    return envelope(rewardClaim(status, recipient, matchId, null), deps.requestId)
  } catch (error) {
    return errorToResponse(error, deps.requestId)
  }
}

async function handleClaim(deps: ChainHandlerDeps, request: Request): Promise<Response> {
  const userId = deps.authenticatedUserId
  if (userId === null) return failure('AUTH_REQUIRED', CHAIN_MESSAGES.authRequired, 401, false, deps.requestId)
  if (deps.adapter === null) return failure('CHAIN_NOT_CONFIGURED', CHAIN_MESSAGES.notConfigured, 503, false, deps.requestId)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return failure('INVALID_BODY', 'Body JSON tidak valid.', 400, false, deps.requestId)
  }

  const matchId = readMatchId(body)
  if (matchId === null) return failure('INVALID_MATCH_ID', 'matchId wajib diisi.', 400, false, deps.requestId)

  const [authoritativeWinner, linkedWallet] = await Promise.all([
    deps.lookup.getAuthoritativeWinner(matchId),
    deps.lookup.getVerifiedLinkedWallet(userId),
  ])

  if (authoritativeWinner !== userId) {
    return envelope(rewardClaim('ineligible', linkedWallet ?? NO_RECIPIENT, matchId, null), deps.requestId)
  }
  if (linkedWallet === null) {
    return envelope(rewardClaim('ineligible', NO_RECIPIENT, matchId, null), deps.requestId)
  }

  const chain = await deps.adapter.getChainMatch(matchId).catch(() => null)
  if (chain === null) return failure('CHAIN_UNAVAILABLE', CHAIN_MESSAGES.retryable, 503, true, deps.requestId)
  if (chain.claimed) return envelope(rewardClaim('already_claimed', linkedWallet, matchId, null), deps.requestId)
  if (!chain.exists) return failure('CHAIN_MATCH_NOT_RECORDED', CHAIN_MESSAGES.matchNotRecorded, 409, true, deps.requestId)

  try {
    const result = await deps.adapter.claimReward({ matchId, recipient: linkedWallet, authenticatedWinnerId: userId })
    const status: RewardClaim['status'] = result.confirmed ? 'confirmed' : 'pending'
    return envelope(rewardClaim(status, linkedWallet, matchId, result.txHash), deps.requestId)
  } catch (error) {
    if (error instanceof ChainRejectedError && error.reason === 'RewardAlreadyClaimed') {
      return envelope(rewardClaim('already_claimed', linkedWallet, matchId, null), deps.requestId)
    }
    return errorToResponse(error, deps.requestId)
  }
}

async function handleRecord(deps: ChainHandlerDeps, request: Request): Promise<Response> {
  const expectedSecret = deps.env.CHAIN_INTERNAL_SECRET?.trim()
  if (expectedSecret === undefined || expectedSecret.length === 0) {
    return failure('CHAIN_INTERNAL_SECRET_UNSET', CHAIN_MESSAGES.internalSecretUnset, 503, false, deps.requestId)
  }
  if (!secretMatches(request.headers.get(INTERNAL_SECRET_HEADER), expectedSecret)) {
    return failure('FORBIDDEN', CHAIN_MESSAGES.internalOnly, 403, false, deps.requestId)
  }
  if (deps.adapter === null) return failure('CHAIN_NOT_CONFIGURED', CHAIN_MESSAGES.notConfigured, 503, false, deps.requestId)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return failure('INVALID_BODY', 'Body JSON tidak valid.', 400, false, deps.requestId)
  }

  const matchId = readMatchId(body)
  if (matchId === null) return failure('INVALID_MATCH_ID', 'matchId wajib diisi.', 400, false, deps.requestId)

  const record = body as Record<string, unknown>
  const replayHash = readHash(record, 'replayHash')
  const resultHash = readHash(record, 'resultHash')
  const rulesetHash = readHash(record, 'rulesetHash')
  if (replayHash === null || resultHash === null || rulesetHash === null) {
    return failure('INVALID_HASH', 'replayHash, resultHash dan rulesetHash wajib bytes32 hex.', 400, false, deps.requestId)
  }

  // The winner comes from the server's own record. A body-supplied winner is ignored.
  const winnerUserId = await deps.lookup.getAuthoritativeWinner(matchId)
  if (winnerUserId === null) {
    return failure('CHAIN_MATCH_NOT_FINAL', CHAIN_MESSAGES.matchNotFinal, 409, true, deps.requestId)
  }

  try {
    const winnerCommitment = buildWinnerCommitment({
      matchId,
      winnerUserId,
      salt: readCommitmentSalt(deps.env),
    })
    const result = await deps.adapter.recordMatch({ matchId, replayHash, resultHash, rulesetHash, winnerCommitment })
    return envelope({ txHash: result.txHash, confirmed: result.confirmed }, deps.requestId)
  } catch (error) {
    return errorToResponse(error, deps.requestId)
  }
}

/**
 * Serves the three C-owned chain routes. Mounted by apps/worker/src/index.ts, which is the
 * only caller and owns the `authenticatedUserId` it passes in.
 */
export async function handleChainRequest(
  request: Request,
  env: Record<string, string | undefined>,
  lookup: ChainLookup,
  authenticatedUserId: string | null,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const url = new URL(request.url)

  let reader: Pick<ChainAdapter, 'getChainMatch'> | null = null
  let adapter: ChainAdapter | null = null
  try {
    reader = createChainReaderFromEnv(env)
    // A relayer key is only needed to write. Eligibility reads stay available without one.
    adapter = createChainAdapterFromEnv(env)
  } catch (error) {
    // Only a missing/invalid config degrades. Any other construction failure is a real bug.
    if (!(error instanceof ChainNotConfiguredError)) throw error
  }

  const deps: ChainHandlerDeps = { env, lookup, authenticatedUserId, reader, adapter, requestId }

  if (url.pathname.startsWith(REWARDS_PREFIX) && request.method === 'GET') {
    const matchId = decodeURIComponent(url.pathname.slice(REWARDS_PREFIX.length))
    if (matchId.length === 0) return failure('INVALID_MATCH_ID', 'matchId wajib diisi.', 400, false, requestId)
    return handleEligibility(deps, matchId)
  }

  if (url.pathname === CLAIM_PATH && request.method === 'POST') return handleClaim(deps, request)
  if (url.pathname === RECORD_PATH && request.method === 'POST') return handleRecord(deps, request)

  return failure('NOT_FOUND', `Rute chain tidak dikenal. ${OPERATOR_ATTESTED_NOTICE}`, 404, false, requestId)
}
