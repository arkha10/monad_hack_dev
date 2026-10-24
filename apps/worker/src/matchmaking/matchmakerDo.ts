import type { SqlCursor, SqlStore, SqlValue } from '../storage/sql'
import type { Env } from '../routes/env'
import type { LeaderboardRecordRequest, PracticeStartRequest, QueueJoinRequest } from '../routes/doProtocol'
import { HttpError, readJson, requireString } from '../routes/http'
import { DEFAULT_LEADERBOARD_LIMIT, MatchmakerService } from './matchmakerService'

export const DEFAULT_TICKET_MAX_AGE_MS = 120_000

type Handler = (request: Request, url: URL) => Promise<unknown>

function cursor<T extends Record<string, SqlValue>>(rows: T[]): SqlCursor<T> {
  let index = 0
  return {
    toArray: () => rows.slice(),
    one: () => {
      if (rows.length === 0) throw new Error('Query returned no rows')
      return rows[0]
    },
    next: () => {
      if (index >= rows.length) return { done: true, value: undefined }
      const value = rows[index]
      index += 1
      return { done: false, value }
    },
  }
}

// Durable Object SQL can return ArrayBuffer, which SqlStore does not model; narrow it at the adapter boundary.
function asRow<T extends Record<string, SqlValue>>(row: Record<string, SqlStorageValue>): T {
  const copy: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof ArrayBuffer) throw new Error(`Kolom ${key} tidak boleh berupa blob`)
    copy[key] = value
  }
  return copy as T
}

function durableObjectSql(state: DurableObjectState): SqlStore {
  return {
    exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => {
      const rows = state.storage.sql.exec<Record<string, SqlStorageValue>>(query, ...bindings).toArray()
      return cursor(rows.map(row => asRow<T>(row)))
    },
    transaction: closure => state.storage.transactionSync(closure),
  }
}

async function readUserId(request: Request, url: URL, field: string): Promise<string> {
  if (request.method === 'GET') return requireString(url.searchParams.get(field), field)
  const body = await readJson<Record<string, unknown>>(request)
  return requireString(body[field], field)
}

export class MatchmakerDurableObject {
  private readonly matchmaker: MatchmakerService

  constructor(readonly state: DurableObjectState, readonly env: Env) {
    this.matchmaker = new MatchmakerService(durableObjectSql(state), () => Date.now())
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const handler = this.routes().get(url.pathname)
    if (!handler) return Response.json({ error: 'Rute matchmaker tidak dikenal', code: 'NOT_FOUND' }, { status: 404 })
    try {
      return Response.json(await handler(request, url))
    } catch (error) {
      if (error instanceof HttpError) {
        return Response.json({ error: error.message, code: error.code }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Kesalahan tidak terduga'
      return Response.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
    }
  }

  private routes(): Map<string, Handler> {
    const matchmaker = this.matchmaker
    return new Map<string, Handler>([
      ['/join', async request => matchmaker.join(await readJson<QueueJoinRequest>(request))],
      [
        '/status',
        async (request, url) =>
          matchmaker.status(requireString(url.searchParams.get('ticket'), 'ticket'), await readUserId(request, url, 'userId')),
      ],
      [
        '/leave',
        async request => {
          const body = await readJson<Record<string, unknown>>(request)
          return matchmaker.leave(requireString(body.ticket, 'ticket'), requireString(body.userId, 'userId'))
        },
      ],
      [
        '/expire',
        async request => {
          const body = await readJson<Record<string, unknown>>(request)
          const maxAgeMs =
            typeof body.maxAgeMs === 'number' && Number.isFinite(body.maxAgeMs) ? body.maxAgeMs : DEFAULT_TICKET_MAX_AGE_MS
          return { cancelled: matchmaker.expireStale(maxAgeMs) }
        },
      ],
      ['/practice', async request => matchmaker.practice(await readJson<PracticeStartRequest>(request))],
      [
        '/practice/take',
        async request => {
          const body = await readJson<Record<string, unknown>>(request)
          return matchmaker.takePracticeRequest(requireString(body.matchId, 'matchId'))
        },
      ],
      ['/pair/take', async () => matchmaker.takeMatchedPair()],
      [
        '/leaderboard',
        async (_request, url) => {
          const raw = url.searchParams.get('limit')
          const limit = raw === null ? DEFAULT_LEADERBOARD_LIMIT : Number(raw)
          return matchmaker.leaderboard(limit)
        },
      ],
      [
        '/result',
        async request => {
          const body = await readJson<Record<string, unknown>>(request)
          const input: LeaderboardRecordRequest = {
            teamId: requireString(body.teamId, 'teamId'),
            name: requireString(body.name, 'name'),
            won: body.won === true,
          }
          return { recorded: matchmaker.recordResultOnce(requireString(body.matchId, 'matchId'), input) }
        },
      ],
    ])
  }
}
