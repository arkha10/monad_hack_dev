import { handleApiRequest } from './routes/router'
import { MatchmakerDurableObject } from './matchmaking/matchmakerDo'
import { MatchDurableObject } from './ws/matchDo'
import { LedgerDurableObject } from './ledger/ledgerDo'
import { corsHeaders, errorResponse, fail, HttpError } from './routes/http'
import type { Env } from './routes/env'
import { resolveIdentity } from './auth/session'
import { getAuthoritativeWinner, getVerifiedLinkedWallet } from './routes/authority'
import { handleChainRequest } from './chain'
import { saveMatchChainTxHash } from './routes/doClient'
import type { MatchResult } from '@boai/shared/types'

export type { Env, AuthenticatedRequestContext } from './routes/env'

export class MatchmakerDO extends MatchmakerDurableObject {}
export class MatchDO extends MatchDurableObject {}
export class LedgerDO extends LedgerDurableObject {}

const WS_PREFIX = '/ws/v1/matches/'
const CHAIN_PREFIX = '/api/v1/chain/'

function chainEnv(env: Env): Record<string, string | undefined> {
  return {
    CHAIN_INTERNAL_SECRET: env.CHAIN_INTERNAL_SECRET,
    CHAIN_RELAYER_PRIVATE_KEY: env.CHAIN_RELAYER_PRIVATE_KEY,
    BOAI_COMMITMENT_SALT: env.BOAI_COMMITMENT_SALT,
    MONAD_RPC_URL: env.MONAD_RPC_URL,
    MONAD_CHAIN_ID: env.MONAD_CHAIN_ID,
    BOAI_CONTRACT_ADDRESS: env.BOAI_CONTRACT_ADDRESS,
  }
}

function chainLookup(env: Env) {
  return {
    getAuthoritativeWinner: (matchId: string) => getAuthoritativeWinner(env, matchId),
    getVerifiedLinkedWallet: (userId: string) => getVerifiedLinkedWallet(env, userId),
  }
}

async function maybeRecordFinalResult(request: Request, env: Env, response: Response): Promise<Response> {
  if (request.method !== 'GET' || !response.ok) return response
  const resultPath = /^\/api\/v1\/results\/([A-Za-z0-9_-]{1,128})$/.exec(new URL(request.url).pathname)
  if (!resultPath) return response

  try {
    const payload = await response.clone().json() as { data?: MatchResult; requestId?: string }
    const result = payload.data
    if (!result || result.winnerSide === 'draw' || result.chainTxHash !== null) return response
    const identity = await resolveIdentity(request, env)
    if (!identity) return response

    const internalRequest = new Request('https://boai.internal/api/v1/chain/matches/record', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-boai-internal-secret': env.CHAIN_INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({
        matchId: decodeURIComponent(resultPath[1]),
        replayHash: result.replayHash,
        resultHash: result.resultHash,
        rulesetHash: result.rulesetHash,
      }),
    })
    const chainResponse = await handleChainRequest(
      internalRequest,
      chainEnv(env),
      chainLookup(env),
      identity.userId,
    )
    if (!chainResponse.ok) return response
    const chainPayload = await chainResponse.json() as { data?: { txHash?: string | null } }
    if (typeof chainPayload.data?.txHash !== 'string') return response

    const stored = await saveMatchChainTxHash(env, result.matchId, chainPayload.data.txHash as `0x${string}`)
    const updatedPayload = { ...payload, data: stored }
    return new Response(JSON.stringify(updatedPayload), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } catch {
    // Chain recording is additive. A temporary RPC or relayer failure must not hide a result.
    return response
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'boai-api', phase: 2, ruleset: 'boai-blitz-v1' })
    }

    if (request.method === 'OPTIONS' && (url.pathname.startsWith('/api/') || url.pathname.startsWith(WS_PREFIX))) {
      return new Response(null, { status: 204, headers: corsHeaders(env) })
    }

    if (url.pathname.startsWith(WS_PREFIX)) {
      const matchId = decodeURIComponent(url.pathname.slice(WS_PREFIX.length))
      if (!matchId) return fail(env, 'INVALID_MATCH_ID', 'matchId wajib disertakan', 400)
      const stub = env.MATCHES.get(env.MATCHES.idFromName(matchId))
      return stub.fetch(new Request(new URL(`/ws/${matchId}${url.search}`, url.origin), request))
    }

    if (url.pathname.startsWith(CHAIN_PREFIX)) {
      try {
        const identity = await resolveIdentity(request, env)
        const response = await handleChainRequest(request, chainEnv(env), chainLookup(env), identity?.userId ?? null)
        const headers = new Headers(response.headers)
        for (const [name, value] of Object.entries(corsHeaders(env))) headers.set(name, value)
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
      } catch (error) {
        if (error instanceof HttpError) return errorResponse(env, error)
        return fail(env, 'CHAIN_UNAVAILABLE', 'Layanan chain sementara tidak tersedia.', 503, true)
      }
    }

    const apiResponse = await handleApiRequest(request, env)
    if (apiResponse) return maybeRecordFinalResult(request, env, apiResponse)

    return new Response('BOAI API', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': env.WEB_ORIGIN },
    })
  },
}
