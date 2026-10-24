import { handleApiRequest } from './routes/router'
import { MatchmakerDurableObject } from './matchmaking/matchmakerDo'
import { MatchDurableObject } from './ws/matchDo'
import { LedgerDurableObject } from './ledger/ledgerDo'
import { corsHeaders, fail } from './routes/http'
import type { Env } from './routes/env'

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
      return Response.json({ ok: true, service: 'boai-api', phase: 1, ruleset: 'boai-blitz-v1' })
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

    // Agent C's chain module is mounted by the lead during the Phase 2 integration
    // merge, so this branch stays buildable without owning apps/worker/src/chain/**.
    if (url.pathname.startsWith(CHAIN_PREFIX)) {
      return fail(env, 'CHAIN_NOT_MOUNTED', 'Handler chain dipasang saat integrasi Phase 2', 501, false)
    }

    const apiResponse = await handleApiRequest(request, env)
    if (apiResponse) return apiResponse

    return new Response('BOAI API', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': env.WEB_ORIGIN },
    })
  },
}
