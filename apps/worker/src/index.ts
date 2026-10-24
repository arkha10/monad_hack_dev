import { handleApiRequest } from './routes/router'
import { MatchmakerDurableObject } from './matchmaking/matchmakerDo'
import { MatchDurableObject } from './ws/matchDo'
import { LedgerDurableObject } from './ledger/ledgerDo'
import { corsHeaders, errorResponse, fail, HttpError } from './routes/http'
import type { Env } from './routes/env'
import { resolveIdentity } from './auth/session'
import { getAuthoritativeWinner, getVerifiedLinkedWallet } from './routes/authority'
import { handleChainRequest } from './chain'

export type { Env, AuthenticatedRequestContext } from './routes/env'

export class MatchmakerDO extends MatchmakerDurableObject {}
export class MatchDO extends MatchDurableObject {}
export class LedgerDO extends LedgerDurableObject {}

const WS_PREFIX = '/ws/v1/matches/'
const CHAIN_PREFIX = '/api/v1/chain/'

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
        const chainEnv: Record<string, string | undefined> = {
          CHAIN_INTERNAL_SECRET: env.CHAIN_INTERNAL_SECRET,
          CHAIN_RELAYER_PRIVATE_KEY: env.CHAIN_RELAYER_PRIVATE_KEY,
          BOAI_COMMITMENT_SALT: env.BOAI_COMMITMENT_SALT,
          MONAD_RPC_URL: env.MONAD_RPC_URL,
          MONAD_CHAIN_ID: env.MONAD_CHAIN_ID,
          BOAI_CONTRACT_ADDRESS: env.BOAI_CONTRACT_ADDRESS,
        }
        const response = await handleChainRequest(request, chainEnv, {
          getAuthoritativeWinner: matchId => getAuthoritativeWinner(env, matchId),
          getVerifiedLinkedWallet: userId => getVerifiedLinkedWallet(env, userId),
        }, identity?.userId ?? null)
        const headers = new Headers(response.headers)
        for (const [name, value] of Object.entries(corsHeaders(env))) headers.set(name, value)
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
      } catch (error) {
        if (error instanceof HttpError) return errorResponse(env, error)
        return fail(env, 'CHAIN_UNAVAILABLE', 'Layanan chain sementara tidak tersedia.', 503, true)
      }
    }

    const apiResponse = await handleApiRequest(request, env)
    if (apiResponse) return apiResponse

    return new Response('BOAI API', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': env.WEB_ORIGIN },
    })
  },
}
