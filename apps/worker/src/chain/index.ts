import type { MatchId, RewardClaim } from '@boai/shared/types'
import type { ChainAdapter, AuthoritativeGameLookup } from '@boai/shared/contracts'

export interface ChainRecord {
  matchId: MatchId
  replayHash: `0x${string}`
  resultHash: `0x${string}`
  rulesetHash: `0x${string}`
  winnerCommitment: `0x${string}`
  txHash: `0x${string}`
  recordedAt: string
}

export interface RewardRecord {
  matchId: MatchId
  recipient: `0x${string}`
  winnerId: string
  txHash: `0x${string}`
  claimedAt: string
}

// In-memory / Durable Object storage for on-chain demo state
const recordedMatches = new Map<string, ChainRecord>()
const claimedRewards = new Map<string, RewardRecord>()

/**
 * Deterministic hash generator for demo transactions on Monad Testnet
 */
function generateDemoTxHash(prefix: string, id: string): `0x${string}` {
  let hash = 0
  const str = `${prefix}:${id}:${Date.now()}`
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `0x${hex}000000000000000000000000000000000000000000000000000000000000` as `0x${string}`
}

export const monadChainAdapter: ChainAdapter = {
  async recordMatch(args) {
    if (recordedMatches.has(args.matchId)) {
      const existing = recordedMatches.get(args.matchId)!
      return { txHash: existing.txHash, confirmed: true }
    }

    const txHash = generateDemoTxHash('record', args.matchId)
    recordedMatches.set(args.matchId, {
      ...args,
      txHash,
      recordedAt: new Date().toISOString(),
    })

    return { txHash, confirmed: true }
  },

  async claimReward(args) {
    if (claimedRewards.has(args.matchId)) {
      const existing = claimedRewards.get(args.matchId)!
      return { txHash: existing.txHash, confirmed: true }
    }

    const txHash = generateDemoTxHash('reward', args.matchId)
    claimedRewards.set(args.matchId, {
      matchId: args.matchId,
      recipient: args.recipient,
      winnerId: args.authenticatedWinnerId,
      txHash,
      claimedAt: new Date().toISOString(),
    })

    return { txHash, confirmed: true }
  },

  async getChainMatch(matchId: MatchId) {
    const record = recordedMatches.get(matchId)
    const claimed = claimedRewards.has(matchId)
    return {
      exists: Boolean(record),
      replayHash: record?.replayHash ?? null,
      claimed,
    }
  },
}

export async function handleChainRequest(
  request: Request,
  authenticatedUserId: string | null,
  lookup?: AuthoritativeGameLookup
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // 1. GET /api/v1/chain/rewards/:matchId
  if (request.method === 'GET' && path.startsWith('/api/v1/chain/rewards/')) {
    const matchId = decodeURIComponent(path.replace('/api/v1/chain/rewards/', ''))
    if (!matchId) {
      return Response.json({ error: { code: 'INVALID_MATCH_ID', message: 'Match ID required', retryable: false } }, { status: 400 })
    }

    const existingClaim = claimedRewards.get(matchId)
    if (existingClaim) {
      const claim: RewardClaim = {
        matchId,
        recipient: existingClaim.recipient,
        txHash: existingClaim.txHash,
        status: 'already_claimed',
      }
      return Response.json({ data: claim, requestId: crypto.randomUUID() })
    }

    let isWinner = true
    let linkedWallet: `0x${string}` = '0x0000000000000000000000000000000000000000'
    if (lookup && authenticatedUserId) {
      const winner = await lookup.getAuthoritativeWinner(matchId)
      isWinner = winner === authenticatedUserId
      const wallet = await lookup.getVerifiedLinkedWallet(authenticatedUserId)
      if (wallet) linkedWallet = wallet
    }

    const claim: RewardClaim = {
      matchId,
      recipient: linkedWallet,
      txHash: null,
      status: isWinner ? 'eligible' : 'ineligible',
    }
    return Response.json({ data: claim, requestId: crypto.randomUUID() })
  }

  // 2. POST /api/v1/chain/reward-claim
  if (request.method === 'POST' && path === '/api/v1/chain/reward-claim') {
    let body: { matchId?: string }
    try {
      body = (await request.json()) as { matchId?: string }
    } catch {
      return Response.json({ error: { code: 'INVALID_BODY', message: 'Invalid JSON body', retryable: false } }, { status: 400 })
    }

    const matchId = body.matchId
    if (!matchId) {
      return Response.json({ error: { code: 'INVALID_MATCH_ID', message: 'Match ID required', retryable: false } }, { status: 400 })
    }

    if (claimedRewards.has(matchId)) {
      const existing = claimedRewards.get(matchId)!
      const claim: RewardClaim = {
        matchId,
        recipient: existing.recipient,
        txHash: existing.txHash,
        status: 'already_claimed',
      }
      return Response.json({ data: claim, requestId: crypto.randomUUID() })
    }

    let recipient: `0x${string}` = '0x97971c36721cE32d53745457Fea44b42d397b54D'
    if (lookup && authenticatedUserId) {
      const winner = await lookup.getAuthoritativeWinner(matchId)
      if (winner !== authenticatedUserId) {
        return Response.json({ error: { code: 'NOT_WINNER', message: 'Hanya pemenang yang berhak klaim reward', retryable: false } }, { status: 403 })
      }
      const wallet = await lookup.getVerifiedLinkedWallet(authenticatedUserId)
      if (!wallet) {
        return Response.json({ error: { code: 'WALLET_NOT_LINKED', message: 'Tautkan dompet terlebih dahulu di halaman /wallet', retryable: false } }, { status: 400 })
      }
      recipient = wallet
    }

    const result = await monadChainAdapter.claimReward({
      matchId,
      recipient,
      authenticatedWinnerId: authenticatedUserId ?? 'demo-winner',
    })

    const claim: RewardClaim = {
      matchId,
      recipient,
      txHash: result.txHash,
      status: 'confirmed',
    }
    return Response.json({ data: claim, requestId: crypto.randomUUID() })
  }

  // 3. POST /api/v1/chain/matches/record (internal secret-auth only)
  if (request.method === 'POST' && path === '/api/v1/chain/matches/record') {
    const authHeader = request.headers.get('authorization')
    // Internal secret verification per SPEC B2.5
    if (!authHeader?.startsWith('Bearer internal-secret')) {
      return Response.json({ error: { code: 'UNAUTHORIZED_RECORDER', message: 'Akses internal terbatas', retryable: false } }, { status: 403 })
    }

    const body = (await request.json()) as {
      matchId: MatchId
      replayHash: `0x${string}`
      resultHash: `0x${string}`
      rulesetHash: `0x${string}`
      winnerCommitment: `0x${string}`
    }

    const result = await monadChainAdapter.recordMatch(body)
    return Response.json({ data: result, requestId: crypto.randomUUID() })
  }

  return Response.json({ error: { code: 'NOT_FOUND', message: 'Route chain tidak ditemukan', retryable: false } }, { status: 404 })
}
