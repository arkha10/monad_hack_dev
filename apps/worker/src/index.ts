export interface Env {
  MATCHMAKER: DurableObjectNamespace
  MATCHES: DurableObjectNamespace
  LEDGER: DurableObjectNamespace
  WEB_ORIGIN: string
}

export interface AuthenticatedRequestContext { authenticatedUserId: string | null, isInternal: boolean }

export class MatchmakerDO {
  constructor(readonly state: DurableObjectState, readonly env: Env) {}
  async fetch(): Promise<Response> { return Response.json({ ok: true, service: 'MatchmakerDO', phase: 0 }) }
}

export class MatchDO {
  constructor(readonly state: DurableObjectState, readonly env: Env) {}
  async fetch(): Promise<Response> { return Response.json({ ok: true, service: 'MatchDO', phase: 0 }) }
}

export class LedgerDO {
  constructor(readonly state: DurableObjectState, readonly env: Env) {}
  async fetch(): Promise<Response> { return Response.json({ ok: true, service: 'LedgerDO', phase: 0 }) }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'boai-api', phase: 0 })
    if (url.pathname.startsWith('/api/v1/chain/')) return Response.json({ error: { code: 'PHASE_0_PLACEHOLDER', message: 'Chain handler menunggu Agent C', retryable: false } }, { status: 501 })
    if (url.pathname.startsWith('/api/v1/')) return Response.json({ error: { code: 'PHASE_0_PLACEHOLDER', message: 'API handler menunggu Agent B', retryable: true } }, { status: 501 })
    return new Response('BOAI API', { headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': env.WEB_ORIGIN } })
  },
}
