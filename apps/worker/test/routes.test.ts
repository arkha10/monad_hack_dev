import { describe, expect, it, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import type { AgentSlot, Behavior, PlayerPrompt } from '@boai/shared/types'
import { handleApiRequest } from '../src/routes/router'
import { getAuthoritativeWinner, getVerifiedLinkedWallet } from '../src/routes/authority'
import { HttpError } from '../src/routes/http'
import { createFakeEnv, guestCookie } from '../src/testing/harness'

const SLOTS: AgentSlot[] = ['p1', 'p2', 'p3', 'p4', 'p5']
const BASE = 'http://worker.test'
const WALLET_KEY = `0x${'4c'.repeat(32)}` as const

function teamAgents(count: number): PlayerPrompt[] {
  return SLOTS.slice(0, count).map((slot, index) => ({
    slot,
    name: `Agen ${index + 1}`,
    text: 'Susun genting saat aman.',
    behavior: 'BALANCED' as Behavior,
    skinId: 'skin-default-red',
  }))
}

function teamRow(name: string) {
  return { id: 'team-owner-1', ownerId: 'user-1', name, agents: teamAgents(5), updatedAt: '2026-10-24T00:00:00.000Z' }
}

function behaviors(count: number): Record<string, Behavior> {
  const result: Record<string, Behavior> = {}
  for (const slot of SLOTS.slice(0, count)) result[slot] = 'BALANCED'
  return result
}

function matchView(result: unknown) {
  return { snapshot: { id: 'match-1' }, result, events: [], redTeamId: 'team-a', blueTeamId: 'team-b' }
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`${BASE}${path}`, init)
}

async function jsonRequest(path: string, method: string, body: unknown, cookie?: string): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return request(path, { method, headers, body: JSON.stringify(body) })
}

interface Envelope {
  data?: unknown
  requestId?: string
  error?: { code: string; message: string; retryable: boolean }
}

async function envelope(response: Response): Promise<Envelope> {
  return (await response.json()) as Envelope
}

describe('handleApiRequest dispatch', () => {
  it('returns 404 in the ApiError shape for an unknown API path and null outside the API prefix', async () => {
    const env = createFakeEnv({})

    const unknown = await handleApiRequest(request('/api/v1/nope'), env)
    expect(unknown?.status).toBe(404)
    expect((await envelope(unknown as Response)).error?.code).toBe('NOT_FOUND')

    expect(await handleApiRequest(request('/health'), env)).toBeNull()
  })

  it('answers OPTIONS preflight with 204 and the configured web origin', async () => {
    const env = createFakeEnv({})

    const response = await handleApiRequest(request('/api/v1/team', { method: 'OPTIONS' }), env)

    expect(response?.status).toBe(204)
    expect(response?.headers.get('access-control-allow-origin')).toBe(env.WEB_ORIGIN)
  })

  it('mints a guest session on identity sync and keeps the same user on replay', async () => {
    const env = createFakeEnv({
      ledger: (path, body) => {
        if (path !== '/sync') return undefined
        const { userId } = body as { userId: string }
        return { userId, displayName: 'Pemain Tamu', isGuest: true, teamId: null }
      },
    })

    const first = await handleApiRequest(request('/api/v1/identity/sync', { method: 'POST' }), env)
    expect(first?.status).toBe(200)
    const cookie = first?.headers.get('set-cookie') as string
    expect(cookie).toContain('boai_session=')
    expect(cookie).toContain('HttpOnly')
    const firstUserId = ((await envelope(first as Response)).data as { userId: string }).userId
    expect(firstUserId).toMatch(/^[0-9a-f-]{36}$/)

    const token = cookie.split(';')[0]
    const second = await handleApiRequest(
      request('/api/v1/identity/sync', { method: 'POST', headers: { cookie: token } }),
      env,
    )
    expect(second?.status).toBe(200)
    expect(second?.headers.get('set-cookie')).toBeNull()
    expect(((await envelope(second as Response)).data as { userId: string }).userId).toBe(firstUserId)
  })

  it('rejects an anonymous team read with 401 UNAUTHORIZED', async () => {
    const env = createFakeEnv({})

    const response = await handleApiRequest(request('/api/v1/team'), env)

    expect(response?.status).toBe(401)
    expect((await envelope(response as Response)).error?.code).toBe('UNAUTHORIZED')
  })

  it('rejects a four agent team before the ledger is called', async () => {
    const ledger = vi.fn(() => teamRow('Tim Uji'))
    const env = createFakeEnv({ ledger })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/team', 'PUT', { name: 'Tim Uji', agents: teamAgents(4) }, cookie),
      env,
    )

    expect(response?.status).toBe(400)
    expect((await envelope(response as Response)).error?.code).toBe('INVALID_TEAM')
    expect(ledger).not.toHaveBeenCalled()
  })

  it('saves a five agent team and returns the stored agents', async () => {
    const saved: unknown[] = []
    const env = createFakeEnv({
      ledger: (path, body) => {
        if (path !== '/team/save') return undefined
        saved.push(body)
        return teamRow('Tim Garuda')
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/team', 'PUT', { name: 'Tim Garuda', agents: teamAgents(5) }, cookie),
      env,
    )

    expect(response?.status).toBe(200)
    expect(((await envelope(response as Response)).data as { agents: unknown[] }).agents).toHaveLength(5)
    expect(saved).toEqual([expect.objectContaining({ userId: 'user-1', name: 'Tim Garuda' })])
  })

  it('rejects an unknown practice difficulty', async () => {
    const env = createFakeEnv({})
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/practice/start', 'POST', { difficulty: 'impossible', teamId: 'team-owner-1' }, cookie),
      env,
    )

    expect(response?.status).toBe(400)
    expect((await envelope(response as Response)).error?.code).toBe('INVALID_FIELD')
  })

  it('starts a practice match through the matchmaker and then initialises the match DO', async () => {
    const inits: unknown[] = []
    const env = createFakeEnv({
      ledger: path => (path === '/team/get' ? teamRow('Tim Garuda') : undefined),
      matchmaker: path => (path === '/practice' ? { matchId: 'match-practice-1' } : undefined),
      match: (path, body) => {
        if (!path.endsWith('/init')) return undefined
        inits.push(body)
        return matchView(null)
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/practice/start', 'POST', { difficulty: 'hard', teamId: 'team-owner-1' }, cookie),
      env,
    )

    expect(response?.status).toBe(200)
    expect((await envelope(response as Response)).data).toEqual({ matchId: 'match-practice-1' })
    expect(inits).toEqual([
      expect.objectContaining({
        matchId: 'match-practice-1',
        mode: 'practice',
        difficulty: 'hard',
        blueOwnerId: null,
        blueTeamId: 'team-practice-bot',
      }),
    ])
  })

  it('initialises the paired match when queue join reports matched', async () => {
    const inits: unknown[] = []
    const takes = vi.fn()
    const env = createFakeEnv({
      ledger: path => (path === '/team/get' ? teamRow('Tim Garuda') : undefined),
      matchmaker: path => {
        if (path === '/join') return { queueTicket: 'ticket-1', status: 'matched', matchId: 'match-pvp-1' }
        if (path === '/pair/take') {
          takes()
          return {
            matchId: 'match-pvp-1',
            red: { userId: 'user-1', teamId: 'team-owner-1', teamName: 'Tim Garuda', behaviors: behaviors(5) },
            blue: { userId: 'user-2', teamId: 'team-owner-2', teamName: 'Tim Nusantara', behaviors: behaviors(5) },
          }
        }
        return undefined
      },
      match: (path, body) => {
        if (!path.endsWith('/init')) return undefined
        inits.push(body)
        return matchView(null)
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/queue/join', 'POST', { teamId: 'team-owner-1', stakeCredits: 0 }, cookie),
      env,
    )

    expect(response?.status).toBe(200)
    expect((await envelope(response as Response)).data).toEqual({
      queueTicket: 'ticket-1',
      status: 'matched',
      matchId: 'match-pvp-1',
    })
    expect(takes).toHaveBeenCalledTimes(1)
    expect(inits).toEqual([
      expect.objectContaining({
        matchId: 'match-pvp-1',
        mode: 'pvp',
        redOwnerId: 'user-1',
        blueOwnerId: 'user-2',
      }),
    ])
  })

  it('drains a stale handed-off pair before initialising the requested match', async () => {
    const initialised: string[] = []
    const pairs = [
      {
        matchId: 'match-stale',
        red: { userId: 'user-8', teamId: 'team-8', teamName: 'Tim Lama', behaviors: behaviors(5) },
        blue: { userId: 'user-9', teamId: 'team-9', teamName: 'Tim Lama 2', behaviors: behaviors(5) },
      },
      {
        matchId: 'match-pvp-1',
        red: { userId: 'user-1', teamId: 'team-owner-1', teamName: 'Tim Garuda', behaviors: behaviors(5) },
        blue: { userId: 'user-2', teamId: 'team-owner-2', teamName: 'Tim Nusantara', behaviors: behaviors(5) },
      },
    ]
    const env = createFakeEnv({
      ledger: path => (path === '/team/get' ? teamRow('Tim Garuda') : undefined),
      matchmaker: path => {
        if (path === '/join') return { queueTicket: 'ticket-1', status: 'matched', matchId: 'match-pvp-1' }
        if (path === '/pair/take') return pairs.shift() ?? null
        return undefined
      },
      match: (path, body) => {
        if (!path.endsWith('/init')) return undefined
        initialised.push((body as { matchId: string }).matchId)
        return matchView(null)
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/queue/join', 'POST', { teamId: 'team-owner-1', stakeCredits: 0 }, cookie),
      env,
    )

    expect(response?.status).toBe(200)
    expect(initialised).toEqual(['match-stale', 'match-pvp-1'])
  })

  it('polls queue status with the ticket and user on the query string', async () => {
    const seen: Array<{ path: string; body: unknown; search: string }> = []
    const env = createFakeEnv({
      matchmaker: (path, body, url) => {
        seen.push({ path, body, search: url.search })
        if (path === '/status') return { status: 'waiting', matchId: null }
        return undefined
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      request('/api/v1/queue/status?queueTicket=ticket-1', { headers: { cookie } }),
      env,
    )

    expect(response?.status).toBe(200)
    expect((await envelope(response as Response)).data).toEqual({ status: 'waiting', matchId: null })
    expect(seen).toEqual([{ path: '/status', body: undefined, search: '?ticket=ticket-1&userId=user-1' }])
  })

  it('rejects queue status without a ticket', async () => {
    const env = createFakeEnv({})
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(request('/api/v1/queue/status', { headers: { cookie } }), env)

    expect(response?.status).toBe(400)
    expect((await envelope(response as Response)).error?.code).toBe('INVALID_FIELD')
  })

  it('rejects an unknown coach command and accepts ATTACK with accepted and seq', async () => {
    const env = createFakeEnv({
      match: path => (path.endsWith('/coach') ? { accepted: true, seq: 12, reason: null } : undefined),
    })
    const cookie = await guestCookie(env, 'user-1')

    const rejected = await handleApiRequest(
      await jsonRequest('/api/v1/matches/match-1/coach', 'POST', { command: 'NOPE' }, cookie),
      env,
    )
    expect(rejected?.status).toBe(400)

    const accepted = await handleApiRequest(
      await jsonRequest('/api/v1/matches/match-1/coach', 'POST', { command: 'ATTACK' }, cookie),
      env,
    )
    expect(accepted?.status).toBe(200)
    expect((await envelope(accepted as Response)).data).toEqual({ accepted: true, seq: 12 })
  })

  it('returns 409 MATCH_NOT_FINISHED while the match has no result', async () => {
    const env = createFakeEnv({ match: path => (path.endsWith('/view') ? matchView(null) : undefined) })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(request('/api/v1/results/match-1', { headers: { cookie } }), env)

    expect(response?.status).toBe(409)
    expect((await envelope(response as Response)).error?.code).toBe('MATCH_NOT_FINISHED')
  })

  it('rejects a malformed wallet address', async () => {
    const env = createFakeEnv({})
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest('/api/v1/wallet/nonce', 'POST', { address: 'nope' }, cookie),
      env,
    )

    expect(response?.status).toBe(400)
    expect((await envelope(response as Response)).error?.code).toBe('INVALID_FIELD')
  })

  it('links a wallet once and refuses the replayed signature', async () => {
    const account = privateKeyToAccount(WALLET_KEY)
    const message = ['BOAI - Tautkan Wallet', `Alamat: ${account.address.toLowerCase()}`, 'Nonce: nonce-abc'].join('\n')
    const signature = await account.signMessage({ message })
    const consumed = new Set<string>()
    const env = createFakeEnv({
      ledger: (path, body) => {
        if (path === '/nonce/consume') {
          const { nonce } = body as { nonce: string }
          if (consumed.has(nonce)) return false
          consumed.add(nonce)
          return true
        }
        if (path === '/wallet/link') {
          return { address: account.address.toLowerCase(), chainId: 10143, verifiedAt: '2026-10-24T00:00:00.000Z' }
        }
        return undefined
      },
    })
    const cookie = await guestCookie(env, 'user-1')
    const payload = { address: account.address, signature, message }

    const linked = await handleApiRequest(await jsonRequest('/api/v1/wallet/link', 'POST', payload, cookie), env)
    expect(linked?.status).toBe(200)
    expect((await envelope(linked as Response)).data).toEqual({
      address: account.address.toLowerCase(),
      chainId: 10143,
      verifiedAt: '2026-10-24T00:00:00.000Z',
    })

    const replay = await handleApiRequest(await jsonRequest('/api/v1/wallet/link', 'POST', payload, cookie), env)
    expect(replay?.status).toBe(400)
    expect((await envelope(replay as Response)).error?.code).toBe('NONCE_REJECTED')
  })

  it('links a wallet using the server-issued message when the client sends no message', async () => {
    const message = ['BOAI - Tautkan Wallet', `Alamat: 0x${'11'.repeat(20)}`, 'Nonce: abc123', 'Chain ID: 10143', 'TESTNET - TANPA NILAI UANG'].join('\n')
    const env = createFakeEnv({
      ledger: (path, body) => {
        const payload = body as Record<string, unknown>
        if (path === '/nonce/current') return { nonce: 'abc123', message, expiresAt: new Date(Date.now() + 60_000).toISOString() }
        if (path === '/nonce/consume') return payload.nonce === 'abc123'
        if (path === '/wallet/link') return { address: payload.address, chainId: 10143, verifiedAt: new Date().toISOString() }
        return undefined
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest(
        '/api/v1/wallet/link',
        'POST',
        { address: `0x${'11'.repeat(20)}`, signature: `0x${'22'.repeat(65)}` },
        cookie,
      ),
      env,
    )

    expect(response?.status).toBe(401)
    expect((await envelope(response as Response)).error?.code).toBe('INVALID_SIGNATURE')
  })

  it('refuses a wallet link when no unexpired nonce was issued for the address', async () => {
    const env = createFakeEnv({
      ledger: path => (path === '/nonce/current' ? null : undefined),
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(
      await jsonRequest(
        '/api/v1/wallet/link',
        'POST',
        { address: `0x${'11'.repeat(20)}`, signature: `0x${'22'.repeat(65)}` },
        cookie,
      ),
      env,
    )

    expect(response?.status).toBe(400)
    expect((await envelope(response as Response)).error?.code).toBe('NONCE_EXPIRED')
  })

  it('keeps a durable object 404 as a 404 for the client', async () => {
    const env = createFakeEnv({
      match: path => {
        if (path.endsWith('/view')) throw new HttpError('MATCH_NOT_FOUND', 'Pertandingan tidak ditemukan', 404)
        return undefined
      },
    })
    const cookie = await guestCookie(env, 'user-1')

    const response = await handleApiRequest(request('/api/v1/matches/match-missing', { headers: { cookie } }), env)

    expect(response?.status).toBe(404)
    expect((await envelope(response as Response)).error).toEqual({
      code: 'MATCH_NOT_FOUND',
      message: 'Pertandingan tidak ditemukan',
      retryable: false,
    })
  })

  it('returns truthy data and a requestId on every success response', async () => {
    const env = createFakeEnv({
      ledger: path => {
        if (path === '/team/get') return teamRow('Tim Garuda')
        if (path === '/balance') return { available: 100, reserved: 0, unit: 'BOAI_CREDIT' }
        if (path === '/nonce/issue') return { nonce: 'n-1', message: 'BOAI n-1', expiresAt: '2026-10-24T01:00:00.000Z' }
        return undefined
      },
      match: path => {
        if (path.endsWith('/view')) return matchView(null)
        if (path.endsWith('/events')) return [{ id: 'match-1:1', matchId: 'match-1', seq: 1, atMs: 0, kind: 'X', actor: null, payload: {} }]
        if (path.endsWith('/ticket')) return { ticket: 't-1', expiresAt: '2026-10-24T01:00:00.000Z' }
        return undefined
      },
      matchmaker: path =>
        path === '/leaderboard' ? [{ teamId: 'team-owner-1', name: 'Tim Garuda', wins: 1, losses: 0 }] : undefined,
    })
    const cookie = await guestCookie(env, 'user-1')
    const address = `0x${'11'.repeat(20)}`

    const successes: Array<[string, Request]> = [
      ['GET /team', request('/api/v1/team', { headers: { cookie } })],
      ['GET /credits', request('/api/v1/credits', { headers: { cookie } })],
      ['GET /shop/items', request('/api/v1/shop/items', { headers: { cookie } })],
      ['GET /leaderboard', request('/api/v1/leaderboard', { headers: { cookie } })],
      ['GET /matches/:id', request('/api/v1/matches/match-1', { headers: { cookie } })],
      ['GET /matches/:id/events', request('/api/v1/matches/match-1/events?afterSeq=0', { headers: { cookie } })],
      ['POST /matches/:id/ws-ticket', request('/api/v1/matches/match-1/ws-ticket', { method: 'POST', headers: { cookie } })],
      ['POST /wallet/nonce', await jsonRequest('/api/v1/wallet/nonce', 'POST', { address }, cookie)],
    ]

    for (const [label, call] of successes) {
      const response = await handleApiRequest(call, env)
      expect(response?.status, label).toBe(200)
      const body = await envelope(response as Response)
      expect(body.data, label).toBeTruthy()
      expect(typeof body.requestId, label).toBe('string')
    }
  })
})

describe('authority lookups', () => {
  it('reads the authoritative winner and the verified linked wallet from the durable objects', async () => {
    const env = createFakeEnv({
      match: path => (path.endsWith('/winner') ? { userId: 'user-1' } : undefined),
      ledger: path =>
        path === '/wallet/get' ? { address: `0x${'ab'.repeat(20)}`, chainId: 10143, verifiedAt: '2026-10-24T00:00:00.000Z' } : undefined,
    })

    await expect(getAuthoritativeWinner(env, 'match-1')).resolves.toBe('user-1')
    await expect(getVerifiedLinkedWallet(env, 'user-1')).resolves.toBe(`0x${'ab'.repeat(20)}`)
  })

  it('returns null when the match has no winner and no wallet is linked', async () => {
    const env = createFakeEnv({
      match: path => (path.endsWith('/winner') ? { userId: null } : undefined),
      ledger: path => (path === '/wallet/get' ? null : undefined),
    })

    await expect(getAuthoritativeWinner(env, 'match-1')).resolves.toBeNull()
    await expect(getVerifiedLinkedWallet(env, 'user-1')).resolves.toBeNull()
  })
})
