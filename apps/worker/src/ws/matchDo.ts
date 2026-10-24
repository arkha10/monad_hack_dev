import type { CoachCommand, MatchEvent, MatchSnapshot } from '@boai/shared/types'
import type { Env } from '../routes/env'
import { HttpError } from '../routes/http'
import type { CoachRequest, MatchInitRequest } from '../routes/doProtocol'
import { durableObjectSql } from '../storage/sql'
import { MATCH } from '../game/ruleset'
import { MatchService } from './matchService'
import { MatchSession } from './matchSocket'
import type { SocketSink } from './room'

interface Attached {
  sink: SocketSink
  userId: string
  matchId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function internalSecretMatches(provided: string | null, expected: string | undefined): boolean {
  if (provided === null || !expected || provided.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < provided.length; index += 1) difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message, retryable: error.retryable } },
      { status: error.status },
    )
  }
  const message = error instanceof Error ? error.message : 'Kesalahan tidak terduga'
  return Response.json({ error: { code: 'INTERNAL_ERROR', message, retryable: true } }, { status: 500 })
}

export class MatchDurableObject {
  private matchService: MatchService | null = null
  private session: MatchSession | null = null
  private readonly sockets = new Map<WebSocket, Attached>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    readonly state: DurableObjectState,
    readonly env: Env,
  ) {}

  private service(): MatchService {
    if (!this.matchService) {
      this.matchService = new MatchService(durableObjectSql(this.state), () => Date.now())
    }
    return this.matchService
  }

  private sessionFor(matchId: string): MatchSession {
    if (!this.session || this.session.matchId !== matchId) {
      this.session = new MatchSession(matchId, this.service(), () => Date.now())
    }
    return this.session
  }

  /**
   * The target tick comes from wall clock against match start, so a loop that was suspended
   * by eviction or hibernation catches up in one advanceTo call instead of drifting behind.
   */
  private targetTick(snapshot: MatchSnapshot): number {
    if (!snapshot.startedAt) return 0
    const elapsed = Date.now() - Date.parse(snapshot.startedAt)
    return Math.max(0, Math.floor(elapsed / MATCH.tickMs))
  }

  private startLoop(matchId: string): void {
    if (this.timer) return
    const session = this.sessionFor(matchId)
    this.timer = setInterval(() => {
      try {
        session.advanceTo(this.targetTick(this.service().view(matchId).snapshot))
      } catch {
        this.stopLoop()
      }
    }, MATCH.tickMs)
  }

  private stopLoop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  /**
   * A match started over plain HTTP has no socket driving it, and the interval only exists
   * while a socket is attached. Advancing against the wall clock on every read keeps the
   * snapshot correct regardless of transport, and is a no-op once the match is finished.
   */
  private catchUp(matchId: string): void {
    const snapshot = this.service().view(matchId).snapshot
    if (snapshot.phase === 'FINISHED') return
    try {
      this.sessionFor(matchId).advanceTo(this.targetTick(snapshot))
    } catch {
      this.stopLoop()
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const matchId = this.matchIdFrom(url)
      if (!matchId) throw new HttpError('INVALID_MATCH_ID', 'matchId wajib disertakan', 400)

      if (request.headers.get('Upgrade') === 'websocket') return this.upgrade(url, matchId)
      return await this.http(request, url, matchId)
    } catch (error) {
      return errorResponse(error)
    }
  }

  /** The Worker and doClient always address the DO as /ws/:matchId or /:matchId/:route. */
  private matchIdFrom(url: URL): string | null {
    const segments = url.pathname.split('/').filter(segment => segment.length > 0)
    if (segments.length < 2) return null
    if (segments[0] === 'ws') return segments.length > 1 ? decodeURIComponent(segments[1]) : null
    return decodeURIComponent(segments[0])
  }

  private upgrade(url: URL, matchId: string): Response {
    const ticket = url.searchParams.get('ticket')
    const userId = ticket ? this.service().redeemWsTicket(matchId, ticket) : null
    if (!userId) return new Response('Tiket WebSocket tidak valid', { status: 401 })

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)

    const sink: SocketSink = { send: payload => server.send(payload) }
    this.sockets.set(server, { sink, userId, matchId })
    this.sessionFor(matchId).attach(userId, sink)
    this.startLoop(matchId)

    return new Response(null, { status: 101, webSocket: client })
  }

  private async http(request: Request, url: URL, matchId: string): Promise<Response> {
    const route = url.pathname.split('/').filter(segment => segment.length > 0).pop() ?? ''
    const method = request.method

    if (route === 'init' && method === 'POST') {
      const body = (await request.json()) as MatchInitRequest
      return Response.json(this.service().init(body))
    }
    if (route === 'view' && method === 'GET') {
      this.catchUp(matchId)
      return Response.json(this.service().view(matchId))
    }
    if (route === 'events' && method === 'GET') {
      this.catchUp(matchId)
      const afterSeq = Number(url.searchParams.get('afterSeq') ?? '0')
      const events: MatchEvent[] = this.service().events(matchId, Number.isFinite(afterSeq) ? afterSeq : 0)
      return Response.json(events)
    }
    if (route === 'tick' && method === 'POST') {
      const body: unknown = await request.json()
      const targetTick = isRecord(body) && typeof body.targetTick === 'number' ? body.targetTick : 0
      this.sessionFor(matchId).advanceTo(targetTick)
      return Response.json(this.service().view(matchId))
    }
    if (route === 'coach' && method === 'POST') {
      const body: unknown = await request.json()
      if (!isRecord(body) || typeof body.userId !== 'string' || typeof body.command !== 'string') {
        throw new HttpError('INVALID_BODY', 'Body coach tidak valid', 400)
      }
      const coachRequest: CoachRequest = {
        userId: body.userId,
        command: body.command as CoachCommand,
        clientMsgId: typeof body.clientMsgId === 'string' ? body.clientMsgId : null,
      }
      return Response.json(this.service().coach(matchId, coachRequest))
    }
    if (route === 'ticket' && method === 'POST') {
      const body: unknown = await request.json()
      if (!isRecord(body) || typeof body.userId !== 'string') {
        throw new HttpError('INVALID_BODY', 'Body tiket tidak valid', 400)
      }
      return Response.json(this.service().issueWsTicket(matchId, body.userId))
    }
    if (route === 'winner' && method === 'GET') {
      return Response.json({ userId: this.service().authoritativeWinner(matchId) })
    }
    if (route === 'chain-tx' && method === 'POST') {
      if (!internalSecretMatches(request.headers.get('x-boai-internal-secret'), this.env.CHAIN_INTERNAL_SECRET)) {
        throw new HttpError('FORBIDDEN', 'Rute internal tidak dapat diakses', 403)
      }
      const body: unknown = await request.json()
      const txHash = isRecord(body) && typeof body.txHash === 'string' ? body.txHash : ''
      return Response.json(this.service().setChainTxHash(matchId, txHash as `0x${string}`))
    }

    throw new HttpError('NOT_FOUND', 'Rute Durable Object tidak dikenal', 404)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attached = this.sockets.get(ws)
    if (!attached || typeof message !== 'string') return
    const replies = this.sessionFor(attached.matchId).handleMessage(attached.userId, message)
    for (const reply of replies) attached.sink.send(JSON.stringify(reply))
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attached = this.sockets.get(ws)
    if (!attached) return
    this.sockets.delete(ws)
    if (this.session) this.session.detach(attached.sink)
    if (this.sockets.size === 0) this.stopLoop()
  }
}
