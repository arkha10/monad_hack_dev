import type { AuthenticatedProfile, CoachCommand, Cosmetic, CreditBalance, MatchEvent, Team } from '@boai/shared/types'
import { SEED } from '@boai/shared/seed'
import { verifyMessage } from 'viem'
import {
  clearDevSessionCookie,
  devSessionCookie,
  generateSalt,
  hashPassword,
  issueDevSession,
  requireIdentity,
  resolveIdentity,
  type ResolvedIdentity,
} from '../auth/session'
import { behaviorsFromTeam, validateTeamPayload } from '../storage/team'
import { ledgerFetch, matchFetch, matchmakerFetch, matchmakerGet, type PairTakeResponse } from './doClient'
import type {
  AdRewardResponse,
  CoachResponse,
  LedgerWalletResponse,
  MatchInitRequest,
  MatchViewResponse,
  NonceResponse,
  PracticeStartRequest,
  PurchaseResponse,
  QueueJoinRequest,
  QueueJoinResponse,
  QueueStatusResponse,
  WsTicketResponse,
} from './doProtocol'
import type { Env } from './env'
import {
  errorResponse,
  fail,
  HttpError,
  ok,
  parseMatchId,
  preflight,
  readJson,
  requireInteger,
  requireOneOf,
  requireString,
} from './http'

const API_PREFIX = '/api/v1/'
const PRACTICE_BOT_TEAM_ID = 'team-practice-bot'
const PRACTICE_BOT_TEAM_NAME = 'Bot Latihan'
const COACH_COMMANDS = ['ATTACK', 'DEFEND', 'REBUILD', 'DISTRACT'] as const satisfies readonly CoachCommand[]
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/
const NONCE_LINE = /^Nonce: (.+)$/m

type HttpMethod = 'GET' | 'POST' | 'PUT'
type IdentityMode = 'required' | 'mint-guest' | 'optional'

interface RouteContext {
  request: Request
  env: Env
  url: URL
  params: Record<string, string>
  identity: ResolvedIdentity
}

interface RouteDefinition {
  method: HttpMethod
  segments: readonly string[]
  identity: IdentityMode
  handler: (context: RouteContext) => Promise<Response>
}

interface RouteMatch {
  route: RouteDefinition
  params: Record<string, string>
}

function requireAddress(value: unknown): `0x${string}` {
  if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value.trim())) {
    throw new HttpError('INVALID_FIELD', 'Field address wajib alamat EVM 0x diikuti 40 digit heksadesimal', 400)
  }
  return value.trim() as `0x${string}`
}

function requireSignature(value: unknown): `0x${string}` {
  if (typeof value !== 'string' || !SIGNATURE_PATTERN.test(value.trim())) {
    throw new HttpError('INVALID_FIELD', 'Field signature wajib tanda tangan 65 byte berawalan 0x', 400)
  }
  return value.trim() as `0x${string}`
}

function parseAfterSeq(raw: string | null): number {
  if (raw === null || raw.trim().length === 0) return 0
  if (!/^-?\d+$/.test(raw.trim())) throw new HttpError('INVALID_FIELD', 'afterSeq wajib berupa bilangan bulat', 400)
  const value = Number(raw.trim())
  if (value < 0) throw new HttpError('INVALID_FIELD', 'afterSeq tidak boleh negatif', 400)
  return value
}

// The ledger DO owns the wallet message layout, so the nonce is read back out of the exact text that was signed.
function nonceFromMessage(message: string): string {
  const match = NONCE_LINE.exec(message)
  if (!match) throw new HttpError('INVALID_FIELD', 'Field message bukan pesan tautkan wallet BOAI', 400)
  return match[1].trim()
}

async function loadTeam(env: Env, userId: string, expectedTeamId: string | null): Promise<Team> {
  const team = await ledgerFetch<Team>(env, userId, '/team/get')
  if (expectedTeamId !== null && team.id !== expectedTeamId) {
    throw new HttpError('TEAM_FORBIDDEN', 'Tim yang diminta bukan milik akun ini', 403)
  }
  return team
}

function practiceInit(team: Team, userId: string, matchId: string, difficulty: MatchInitRequest['difficulty']): MatchInitRequest {
  const behaviors = behaviorsFromTeam(team)
  return {
    matchId,
    mode: 'practice',
    seed: crypto.randomUUID(),
    difficulty,
    redOwnerId: userId,
    blueOwnerId: null,
    redTeamId: team.id,
    blueTeamId: PRACTICE_BOT_TEAM_ID,
    redTeamName: team.name,
    blueTeamName: PRACTICE_BOT_TEAM_NAME,
    redBehaviors: behaviors,
    blueBehaviors: behaviors,
  }
}

function pairInit(pair: NonNullable<PairTakeResponse>): MatchInitRequest {
  return {
    matchId: pair.matchId,
    mode: 'pvp',
    seed: crypto.randomUUID(),
    difficulty: 'medium',
    redOwnerId: pair.red.userId,
    blueOwnerId: pair.blue.userId,
    redTeamId: pair.red.teamId,
    blueTeamId: pair.blue.teamId,
    redTeamName: pair.red.teamName,
    blueTeamName: pair.blue.teamName,
    redBehaviors: pair.red.behaviors,
    blueBehaviors: pair.blue.behaviors,
  }
}

const ROUTES: readonly RouteDefinition[] = [
  {
    method: 'POST',
    segments: ['identity', 'signout'],
    identity: 'required',
    handler: async ({ env }) => {
      const response = ok({ signedOut: true }, env)
      response.headers.append('set-cookie', clearDevSessionCookie(env.BOAI_ENV === 'production'))
      return response
    },
  },
  {
    method: 'POST',
    segments: ['identity', 'sync'],
    identity: 'mint-guest',
    handler: async ({ env, identity }) => {
      const profile = await ledgerFetch<AuthenticatedProfile>(env, identity.userId, '/sync', {
        displayName: identity.username ?? identity.displayName ?? 'Pemain BOAI',
        isGuest: identity.isGuest,
      })
      return ok({ ...profile, username: identity.username ?? null }, env)
    },
  },
  {
    method: 'POST',
    segments: ['auth', 'register'],
    identity: 'optional',
    handler: async ({ env, request }) => {
      const body = await readJson<{ username?: unknown; password?: unknown }>(request)
      const rawUsername = typeof body.username === 'string' ? body.username.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''

      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(rawUsername)) {
        throw new HttpError(
          'INVALID_USERNAME',
          'Username harus 3-20 karakter alfanumerik (huruf, angka, _, -)',
          400,
        )
      }
      if (password.length < 6) {
        throw new HttpError('INVALID_PASSWORD', 'Password minimal 6 karakter', 400)
      }

      const salt = generateSalt()
      const passwordHash = await hashPassword(password, salt)
      const newUserId = `u_${crypto.randomUUID()}`

      const registered = await ledgerFetch<{ ok: boolean; reason?: string; user?: { username: string; userId: string } }>(
        env,
        'auth_registry',
        '/auth/register',
        {
          username: rawUsername,
          passwordHash,
          salt,
          newUserId,
        },
      )

      if (!registered.ok) {
        if (registered.reason === 'USERNAME_EXISTS') {
          throw new HttpError('USERNAME_EXISTS', 'Username sudah terdaftar. Silakan pilih username lain.', 409)
        }
        throw new HttpError('REGISTER_FAILED', 'Gagal mendaftarkan akun.', 400)
      }

      const profile = await ledgerFetch<AuthenticatedProfile>(env, newUserId, '/sync', {
        displayName: rawUsername,
        isGuest: false,
      })

      const token = await issueDevSession(env, newUserId, rawUsername)
      const cookie = devSessionCookie(token, undefined, env.BOAI_ENV === 'production')
      const response = ok(
        {
          user: {
            ...profile,
            username: rawUsername,
          },
          token,
        },
        env,
      )
      response.headers.append('set-cookie', cookie)
      return response
    },
  },
  {
    method: 'POST',
    segments: ['auth', 'login'],
    identity: 'optional',
    handler: async ({ env, request }) => {
      const body = await readJson<{ username?: unknown; password?: unknown }>(request)
      const rawUsername = typeof body.username === 'string' ? body.username.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''

      if (!rawUsername || !password) {
        throw new HttpError('INVALID_CREDENTIALS', 'Username dan password wajib diisi', 400)
      }

      const lookup = await ledgerFetch<{
        found: boolean
        user?: { username: string; userId: string; passwordHash: string; salt: string }
      }>(env, 'auth_registry', '/auth/get', { username: rawUsername })

      if (!lookup.found || !lookup.user) {
        throw new HttpError('UNAUTHORIZED', 'Username atau password salah', 401)
      }

      const expectedHash = await hashPassword(password, lookup.user.salt)
      if (expectedHash !== lookup.user.passwordHash) {
        throw new HttpError('UNAUTHORIZED', 'Username atau password salah', 401)
      }

      const profile = await ledgerFetch<AuthenticatedProfile>(env, lookup.user.userId, '/sync', {
        displayName: lookup.user.username,
        isGuest: false,
      })

      const token = await issueDevSession(env, lookup.user.userId, lookup.user.username)
      const cookie = devSessionCookie(token, undefined, env.BOAI_ENV === 'production')
      const response = ok(
        {
          user: {
            ...profile,
            username: lookup.user.username,
          },
          token,
        },
        env,
      )
      response.headers.append('set-cookie', cookie)
      return response
    },
  },
  {
    method: 'POST',
    segments: ['auth', 'logout'],
    identity: 'optional',
    handler: async ({ env }) => {
      const response = ok({ loggedOut: true }, env)
      response.headers.append('set-cookie', clearDevSessionCookie(env.BOAI_ENV === 'production'))
      return response
    },
  },
  {
    method: 'GET',
    segments: ['auth', 'me'],
    identity: 'required',
    handler: async ({ env, identity }) => {
      return ok(
        {
          userId: identity.userId,
          username: identity.username ?? null,
          displayName: identity.displayName ?? 'Pemain BOAI',
          isGuest: identity.isGuest,
        },
        env,
      )
    },
  },
  {
    method: 'GET',
    segments: ['team'],
    identity: 'required',
    handler: async ({ env, identity }) => ok(await loadTeam(env, identity.userId, null), env),
  },
  {
    method: 'PUT',
    segments: ['team'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const payload = validateTeamPayload(await readJson<unknown>(request))
      const team = await ledgerFetch<Team>(env, identity.userId, '/team/save', payload)
      return ok(team, env)
    },
  },
  {
    method: 'POST',
    segments: ['practice', 'start'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ difficulty?: unknown; teamId?: unknown }>(request)
      const difficulty = requireOneOf(body.difficulty, 'difficulty', SEED.practicePresets)
      const teamId = requireString(body.teamId, 'teamId', 128)
      const team = await loadTeam(env, identity.userId, teamId)
      const practiceRequest: PracticeStartRequest = {
        userId: identity.userId,
        teamId: team.id,
        teamName: team.name,
        difficulty,
        behaviors: behaviorsFromTeam(team),
      }
      const started = await matchmakerFetch<{ matchId: string }>(env, '/practice', practiceRequest)
      await matchFetch<unknown>(env, started.matchId, '/init', practiceInit(team, identity.userId, started.matchId, difficulty))
      return ok({ matchId: started.matchId }, env)
    },
  },
  {
    method: 'POST',
    segments: ['queue', 'join'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ teamId?: unknown; stakeCredits?: unknown }>(request)
      const teamId = requireString(body.teamId, 'teamId', 128)
      const stakeCredits = requireInteger(body.stakeCredits, 'stakeCredits', 0, 1_000_000)
      const team = await loadTeam(env, identity.userId, teamId)
      const joinRequest: QueueJoinRequest = {
        userId: identity.userId,
        teamId: team.id,
        teamName: team.name,
        stakeCredits,
        behaviors: behaviorsFromTeam(team),
      }
      const queued = await matchmakerFetch<QueueJoinResponse>(env, '/join', joinRequest)
      if (queued.status === 'matched' && queued.matchId) await handOffMatchedPair(env, queued.matchId)
      return ok({ queueTicket: queued.queueTicket, status: queued.status, matchId: queued.matchId }, env)
    },
  },
  {
    method: 'GET',
    segments: ['queue', 'status'],
    identity: 'required',
    handler: async ({ env, url, identity }) => {
      const queueTicket = url.searchParams.get('queueTicket')
      if (!queueTicket || queueTicket.trim().length === 0) {
        throw new HttpError('INVALID_FIELD', 'Field queueTicket wajib disertakan', 400)
      }
      const status = await matchmakerGet<QueueStatusResponse>(
        env,
        `/status?ticket=${encodeURIComponent(queueTicket.trim())}&userId=${encodeURIComponent(identity.userId)}`,
      )
      return ok({ status: status.status, matchId: status.matchId }, env)
    },
  },
  {
    method: 'POST',
    segments: ['queue', 'leave'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ queueTicket?: unknown }>(request)
      const queueTicket = requireString(body.queueTicket, 'queueTicket', 128)
      const left = await matchmakerFetch<{ status: 'cancelled' }>(env, '/leave', {
        ticket: queueTicket,
        userId: identity.userId,
      })
      return ok({ status: left.status }, env)
    },
  },
  {
    method: 'GET',
    segments: ['matches', ':matchId'],
    identity: 'required',
    handler: async ({ env, params }) => {
      const view = await matchFetch<MatchViewResponse>(env, parseMatchId(params.matchId), '/view')
      return ok(view.snapshot, env)
    },
  },
  {
    method: 'GET',
    segments: ['matches', ':matchId', 'events'],
    identity: 'required',
    handler: async ({ env, url, params }) => {
      const afterSeq = parseAfterSeq(url.searchParams.get('afterSeq'))
      const events = await matchFetch<MatchEvent[]>(
        env,
        parseMatchId(params.matchId),
        `/events?afterSeq=${afterSeq}`,
      )
      return ok(events, env)
    },
  },
  {
    method: 'POST',
    segments: ['matches', ':matchId', 'ws-ticket'],
    identity: 'required',
    handler: async ({ env, params, identity }) => {
      const ticket = await matchFetch<WsTicketResponse>(env, parseMatchId(params.matchId), '/ticket', {
        userId: identity.userId,
      })
      return ok(ticket, env)
    },
  },
  {
    method: 'POST',
    segments: ['matches', ':matchId', 'coach'],
    identity: 'required',
    handler: async ({ env, request, params, identity }) => {
      const body = await readJson<{ command?: unknown }>(request)
      const command = requireOneOf<CoachCommand>(body.command, 'command', COACH_COMMANDS)
      const coached = await matchFetch<CoachResponse>(env, parseMatchId(params.matchId), '/coach', {
        userId: identity.userId,
        command,
        clientMsgId: null,
      })
      return ok({ accepted: coached.accepted, seq: coached.seq }, env)
    },
  },
  {
    method: 'GET',
    segments: ['results', ':matchId'],
    identity: 'required',
    handler: async ({ env, params }) => {
      const view = await matchFetch<MatchViewResponse>(env, parseMatchId(params.matchId), '/view')
      if (!view.result) throw new HttpError('MATCH_NOT_FINISHED', 'Pertandingan belum selesai', 409)
      return ok(view.result, env)
    },
  },
  {
    method: 'GET',
    segments: ['credits'],
    identity: 'required',
    handler: async ({ env, identity }) => {
      const balance = await ledgerFetch<CreditBalance>(env, identity.userId, '/balance')
      return ok(balance, env)
    },
  },
  {
    method: 'GET',
    segments: ['shop', 'items'],
    identity: 'required',
    handler: async ({ env }) => {
      const cosmetics: Cosmetic[] = SEED.cosmetics.map(item => ({ ...item }))
      return ok(cosmetics, env)
    },
  },
  {
    method: 'POST',
    segments: ['shop', 'purchase'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ cosmeticId?: unknown }>(request)
      const cosmeticId = requireString(body.cosmeticId, 'cosmeticId', 64)
      const purchase = await ledgerFetch<PurchaseResponse>(env, identity.userId, '/purchase', { cosmeticId })
      if (!purchase.ok) {
        throw new HttpError(purchase.reason ?? 'PURCHASE_REJECTED', 'Pembelian kosmetik ditolak', 409)
      }
      return ok({ ownedCosmeticIds: purchase.ownedCosmeticIds, balance: purchase.balance }, env)
    },
  },
  {
    method: 'POST',
    segments: ['rewards', 'ad-demo'],
    identity: 'required',
    handler: async ({ env, identity }) => {
      const reward = await ledgerFetch<AdRewardResponse>(env, identity.userId, '/ad')
      return ok(reward, env)
    },
  },
  {
    method: 'GET',
    segments: ['leaderboard'],
    identity: 'required',
    handler: async ({ env }) => {
      const rows = await matchmakerFetch<Array<{ teamId: string; name: string; wins: number; losses: number }>>(
        env,
        '/leaderboard',
      )
      return ok(rows, env)
    },
  },
  {
    method: 'POST',
    segments: ['wallet', 'nonce'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ address?: unknown }>(request)
      const address = requireAddress(body.address)
      const nonce = await ledgerFetch<NonceResponse>(env, identity.userId, '/nonce/issue', { address })
      return ok(nonce, env)
    },
  },
  {
    method: 'POST',
    segments: ['wallet', 'link'],
    identity: 'required',
    handler: async ({ env, request, identity }) => {
      const body = await readJson<{ address?: unknown; signature?: unknown; message?: unknown }>(request)
      const address = requireAddress(body.address)
      const signature = requireSignature(body.signature)
      const nowMs = Date.now()
      // The frozen client sends only address and signature, so the server re-serves
      // the exact message it issued for this address instead of trusting client text.
      let message: string
      if (body.message === undefined || body.message === null) {
        const current = await ledgerFetch<NonceResponse | null>(env, identity.userId, '/nonce/current', {
          address,
          nowMs,
        })
        if (!current) throw new HttpError('NONCE_EXPIRED', 'Nonce tidak ada atau sudah kedaluwarsa. Minta nonce baru.', 400)
        message = current.message
      } else {
        message = requireString(body.message, 'message', 2000)
      }
      const signed = await verifyMessage({ address, message, signature }).catch(() => false)
      if (!signed) throw new HttpError('INVALID_SIGNATURE', 'Tanda tangan tidak cocok dengan alamat', 401)
      const consumed = await ledgerFetch<boolean>(env, identity.userId, '/nonce/consume', {
        address,
        nonce: nonceFromMessage(message),
        nowMs,
      })
      if (!consumed) throw new HttpError('NONCE_REJECTED', 'Nonce tidak valid, kedaluwarsa, atau sudah dipakai', 400)
      const link = await ledgerFetch<LedgerWalletResponse>(env, identity.userId, '/wallet/link', {
        address,
        verifiedAtMs: nowMs,
      })
      if (!link) throw new HttpError('WALLET_LINK_FAILED', 'Dompet gagal ditautkan', 400)
      return ok(link, env)
    },
  },
]

/**
 * /pair/take hands off the oldest matched pair, not necessarily this ticket's pair, so a stale
 * handoff from a lost response has to be drained and initialised before ours can be reached.
 */
async function handOffMatchedPair(env: Env, matchId: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pair = await matchmakerFetch<PairTakeResponse>(env, '/pair/take')
    if (!pair) break
    await matchFetch<unknown>(env, pair.matchId, '/init', pairInit(pair))
    if (pair.matchId === matchId) return
  }
  // A concurrent join may have handed off and initialised this match already, which is success for us.
  const started = await matchFetch<MatchViewResponse>(env, matchId, '/view').catch(() => null)
  if (started) return
  throw new HttpError('MATCH_NOT_READY', 'Pasangan pertandingan belum siap', 409, true)
}

function matchSegments(pattern: readonly string[], actual: readonly string[]): Record<string, string> | null {
  if (pattern.length !== actual.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < pattern.length; index += 1) {
    const expected = pattern[index]
    const segment = actual[index]
    if (expected.startsWith(':')) {
      if (segment.length === 0) return null
      try {
        params[expected.slice(1)] = decodeURIComponent(segment)
      } catch {
        throw new HttpError('INVALID_PATH', 'Path permintaan tidak dapat dibaca', 400)
      }
      continue
    }
    if (expected !== segment) return null
  }
  return params
}

function findRoute(method: string, segments: readonly string[]): { match: RouteMatch; methodMismatch: boolean } | null {
  const candidates: RouteMatch[] = []
  for (const route of ROUTES) {
    const params = matchSegments(route.segments, segments)
    if (params) candidates.push({ route, params })
  }
  if (candidates.length === 0) return null
  const exact = candidates.find(candidate => candidate.route.method === method)
  if (exact) return { match: exact, methodMismatch: false }
  return { match: candidates[0], methodMismatch: true }
}

async function resolveRouteIdentity(
  request: Request,
  env: Env,
  mode: IdentityMode,
): Promise<{ identity: ResolvedIdentity; cookie: string | null }> {
  if (mode === 'required') return { identity: await requireIdentity(request, env), cookie: null }
  const existing = await resolveIdentity(request, env)
  if (existing) return { identity: existing, cookie: null }
  if (mode === 'optional') {
    return {
      identity: { userId: '', isGuest: true, displayName: null, sessionToken: null, username: null },
      cookie: null,
    }
  }
  const userId = crypto.randomUUID()
  const token = await issueDevSession(env, userId)
  return {
    identity: { userId, isGuest: true, displayName: 'Pemain Tamu', sessionToken: token, username: null },
    cookie: devSessionCookie(token, undefined, env.BOAI_ENV === 'production'),
  }
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api/v1' || pathname.startsWith(API_PREFIX)
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  if (!isApiPath(url.pathname)) return null
  if (request.method === 'OPTIONS') return preflight(env)

  try {
    const segments = url.pathname.slice(API_PREFIX.length).split('/').filter(segment => segment.length > 0)
    const found = findRoute(request.method, segments)
    if (!found) return fail(env, 'NOT_FOUND', `Rute ${url.pathname} tidak dikenal`, 404)
    if (found.methodMismatch) {
      return fail(env, 'METHOD_NOT_ALLOWED', `Metode ${request.method} tidak didukung untuk ${url.pathname}`, 405)
    }

    const { identity, cookie } = await resolveRouteIdentity(request, env, found.match.route.identity)
    const response = await found.match.route.handler({
      request,
      env,
      url,
      params: found.match.params,
      identity,
    })
    if (cookie) response.headers.append('set-cookie', cookie)
    return response
  } catch (error) {
    return errorResponse(env, error)
  }
}
