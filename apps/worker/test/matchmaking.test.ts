import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSlot, Behavior, Difficulty } from '@boai/shared/types'
import type { PracticeStartRequest, QueueJoinRequest } from '../src/routes/doProtocol'
import type { Env } from '../src/routes/env'
import type { SqlValue } from '../src/storage/sql'
import { HttpError } from '../src/routes/http'
import { MemorySqlStore } from '../src/testing/memorySql'
import { MatchmakerService, matchSeed } from '../src/matchmaking/matchmakerService'
import { MatchmakerDurableObject } from '../src/matchmaking/matchmakerDo'
import { RULESET_VERSION } from '../src/game/ruleset'

const behaviors: Record<AgentSlot, Behavior> = {
  p1: 'BUILD_FIRST',
  p2: 'DODGE_FIRST',
  p3: 'DECOY',
  p4: 'CHASE_BALL',
  p5: 'BALANCED',
}

const ALICE = 'user-alice'
const BOB = 'user-bob'

function joinRequest(userId: string, teamId: string, teamName: string): QueueJoinRequest {
  return { userId, teamId, teamName, stakeCredits: 0, behaviors }
}

function practiceRequest(userId: string, difficulty: Difficulty): PracticeStartRequest {
  return { userId, teamId: `team-${userId}`, teamName: `Tim ${userId}`, difficulty, behaviors }
}

const stores: MemorySqlStore[] = []

function newMatchmaker(startAt = 1_000_000): { matchmaker: MatchmakerService; clock: { value: number } } {
  const sql = new MemorySqlStore()
  stores.push(sql)
  const clock = { value: startAt }
  return { matchmaker: new MatchmakerService(sql, () => clock.value), clock }
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
})

function fakeState(sql: MemorySqlStore): DurableObjectState {
  const storage = {
    sql: { exec: (query: string, ...bindings: SqlValue[]) => sql.exec(query, ...bindings) },
    transactionSync: <T>(closure: () => T): T => sql.transaction(closure),
  }
  return { storage } as unknown as DurableObjectState
}

function newDurableObject(): MatchmakerDurableObject {
  const sql = new MemorySqlStore()
  stores.push(sql)
  return new MatchmakerDurableObject(fakeState(sql), {} as unknown as Env)
}

function post(durableObject: MatchmakerDurableObject, path: string, body: unknown): Promise<Response> {
  return durableObject.fetch(new Request(`https://matchmaker.internal${path}`, { method: 'POST', body: JSON.stringify(body) }))
}

describe('BOAI matchmaker queue', () => {
  it('pairs two different users into one match id that both tickets report', () => {
    const { matchmaker } = newMatchmaker()

    const alice = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))
    expect(alice).toEqual({ queueTicket: alice.queueTicket, status: 'waiting', matchId: null })

    const bob = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))
    expect(bob.status).toBe('matched')
    expect(bob.matchId).toMatch(/^[0-9a-f-]{36}$/)

    expect(matchmaker.status(alice.queueTicket, ALICE)).toEqual({ status: 'matched', matchId: bob.matchId })
    expect(matchmaker.status(bob.queueTicket, BOB)).toEqual({ status: 'matched', matchId: bob.matchId })
    expect(matchmaker.status(alice.queueTicket, ALICE).matchId).toBe(matchmaker.status(bob.queueTicket, BOB).matchId)

    expect(matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))).toEqual({
      queueTicket: bob.queueTicket,
      status: 'matched',
      matchId: bob.matchId,
    })
  })

  it('returns one ticket for a repeated join and never matches a user with themselves', () => {
    const { matchmaker } = newMatchmaker()

    const first = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))
    const second = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))

    expect(second).toEqual({ queueTicket: first.queueTicket, status: 'waiting', matchId: null })
    expect(matchmaker.status(first.queueTicket, ALICE)).toEqual({ status: 'waiting', matchId: null })
    expect(matchmaker.takeMatchedPair()).toBeNull()

    const bob = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))
    expect(bob.status).toBe('matched')
    const pair = matchmaker.takeMatchedPair()
    expect(pair?.red.userId).toBe(ALICE)
    expect(pair?.blue.userId).toBe(BOB)
    expect(matchmaker.takeMatchedPair()).toBeNull()
  })

  it('refuses to read or cancel another user ticket', () => {
    const { matchmaker } = newMatchmaker()
    const alice = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))

    expect(() => matchmaker.status(alice.queueTicket, BOB)).toThrow(HttpError)
    expect(() => matchmaker.leave(alice.queueTicket, BOB)).toThrow(HttpError)
    expect(() => matchmaker.status(alice.queueTicket, BOB)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
    )
    expect(matchmaker.status(alice.queueTicket, ALICE)).toEqual({ status: 'waiting', matchId: null })
  })

  it('cancels idempotently and stops the cancelled ticket from pairing', () => {
    const { matchmaker } = newMatchmaker()
    const alice = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))

    expect(matchmaker.leave(alice.queueTicket, ALICE)).toEqual({ status: 'cancelled' })
    expect(matchmaker.leave(alice.queueTicket, ALICE)).toEqual({ status: 'cancelled' })
    expect(matchmaker.status(alice.queueTicket, ALICE)).toEqual({ status: 'cancelled', matchId: null })

    const bob = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))
    expect(bob).toEqual({ queueTicket: bob.queueTicket, status: 'waiting', matchId: null })
    expect(matchmaker.takeMatchedPair()).toBeNull()
  })

  it('expires a stale waiting ticket and keeps a fresh one waiting', () => {
    const { matchmaker, clock } = newMatchmaker(1_000_000)
    const stale = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))

    clock.value = 1_200_000
    expect(matchmaker.expireStale(120_000)).toBe(1)
    expect(matchmaker.status(stale.queueTicket, ALICE)).toEqual({ status: 'cancelled', matchId: null })

    const fresh = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))
    expect(matchmaker.expireStale(120_000)).toBe(0)
    expect(matchmaker.status(fresh.queueTicket, BOB)).toEqual({ status: 'waiting', matchId: null })
  })

  it('hands a matched pair over exactly once with a stable match id', () => {
    const { matchmaker } = newMatchmaker()
    matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))
    const bob = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))

    const pair = matchmaker.takeMatchedPair()
    expect(pair).not.toBeNull()
    if (!pair) throw new Error('pair missing')
    expect(pair.matchId).toBe(bob.matchId)
    expect(pair.red.userId).toBe(ALICE)
    expect(pair.blue.userId).toBe(BOB)
    expect(matchmaker.takeMatchedPair()).toBeNull()
    expect(matchmaker.status(bob.queueTicket, BOB)).toEqual({ status: 'matched', matchId: pair.matchId })
  })

  it('refuses to cancel a ticket that already formed a pair', () => {
    const { matchmaker } = newMatchmaker()
    const alice = matchmaker.join(joinRequest(ALICE, 'team-alice', 'Garuda'))
    const bob = matchmaker.join(joinRequest(BOB, 'team-bob', 'Nusantara'))

    expect(() => matchmaker.leave(alice.queueTicket, ALICE)).toThrow(
      expect.objectContaining({ code: 'QUEUE_TICKET_MATCHED', status: 409 }),
    )
    expect(matchmaker.status(bob.queueTicket, BOB)).toEqual({ status: 'matched', matchId: bob.matchId })
    expect(matchmaker.takeMatchedPair()?.matchId).toBe(bob.matchId)
  })

  it('records a leaderboard result once per match id', () => {
    const { matchmaker } = newMatchmaker()
    const record = { teamId: 'team-alice', name: 'Garuda', won: true }

    expect(matchmaker.recordResultOnce('match-001', record)).toBe(true)
    expect(matchmaker.recordResultOnce('match-001', record)).toBe(false)
    expect(matchmaker.leaderboard()).toEqual([{ teamId: 'team-alice', name: 'Garuda', wins: 1, losses: 0 }])
  })

  it('orders the leaderboard by wins then losses and keeps both counters', () => {
    const { matchmaker } = newMatchmaker()

    matchmaker.recordResultOnce('match-a1', { teamId: 'team-alice', name: 'Garuda', won: true })
    matchmaker.recordResultOnce('match-a2', { teamId: 'team-alice', name: 'Garuda', won: false })
    matchmaker.recordResultOnce('match-b1', { teamId: 'team-bob', name: 'Nusantara', won: true })
    matchmaker.recordResultOnce('match-c1', { teamId: 'team-chandra', name: 'Chandra', won: false })

    expect(matchmaker.leaderboard()).toEqual([
      { teamId: 'team-bob', name: 'Nusantara', wins: 1, losses: 0 },
      { teamId: 'team-alice', name: 'Garuda', wins: 1, losses: 1 },
      { teamId: 'team-chandra', name: 'Chandra', wins: 0, losses: 1 },
    ])
    expect(matchmaker.leaderboard(1)).toEqual([{ teamId: 'team-bob', name: 'Nusantara', wins: 1, losses: 0 }])
  })

  it('issues a distinct practice match per call and pairs nobody', () => {
    const { matchmaker } = newMatchmaker()

    const first = matchmaker.practice(practiceRequest(ALICE, 'easy'))
    const second = matchmaker.practice(practiceRequest(ALICE, 'hard'))

    expect(first.matchId).not.toBe(second.matchId)
    expect(first.matchId).toMatch(/^[0-9a-f-]{36}$/)
    expect(matchmaker.takeMatchedPair()).toBeNull()
    expect(matchmaker.takePracticeRequest(first.matchId)).toEqual(practiceRequest(ALICE, 'easy'))
    expect(matchmaker.takePracticeRequest(first.matchId)).toBeNull()
    expect(matchmaker.takePracticeRequest(second.matchId)).toEqual(practiceRequest(ALICE, 'hard'))
  })

  it('derives a ruleset-scoped seed from the match id', () => {
    expect(matchSeed('match-001')).toBe(`${RULESET_VERSION}:match-001`)
    expect(matchSeed('match-001')).not.toBe(matchSeed('match-002'))
  })
})

describe('BOAI matchmaker Durable Object surface', () => {
  it('pairs two POST /join callers and serves both statuses', async () => {
    const durableObject = newDurableObject()

    const aliceResponse = await post(durableObject, '/join', joinRequest(ALICE, 'team-alice', 'Garuda'))
    expect(aliceResponse.status).toBe(200)
    const alice = (await aliceResponse.json()) as { queueTicket: string; status: string; matchId: string | null }
    expect(alice).toEqual({ queueTicket: alice.queueTicket, status: 'waiting', matchId: null })

    const bobResponse = await post(durableObject, '/join', joinRequest(BOB, 'team-bob', 'Nusantara'))
    const bob = (await bobResponse.json()) as { queueTicket: string; status: string; matchId: string | null }
    expect(bob.status).toBe('matched')
    expect(bob.matchId).toMatch(/^[0-9a-f-]{36}$/)

    const statusUrl = `https://matchmaker.internal/status?ticket=${alice.queueTicket}&userId=${ALICE}`
    const status = (await (await durableObject.fetch(new Request(statusUrl))).json()) as { status: string; matchId: string | null }
    expect(status).toEqual({ status: 'matched', matchId: bob.matchId })
  })

  it('maps a cross-user status poll to a 403 body', async () => {
    const durableObject = newDurableObject()
    const alice = (await (await post(durableObject, '/join', joinRequest(ALICE, 'team-alice', 'Garuda'))).json()) as {
      queueTicket: string
    }

    const response = await durableObject.fetch(
      new Request(`https://matchmaker.internal/status?ticket=${alice.queueTicket}&userId=${BOB}`),
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Tiket antrean milik pengguna lain', code: 'FORBIDDEN' })
  })

  it('returns 404 for an unknown route and for an unknown ticket', async () => {
    const durableObject = newDurableObject()

    const missingRoute = await durableObject.fetch(new Request('https://matchmaker.internal/nope'))
    expect(missingRoute.status).toBe(404)

    const missingTicket = await durableObject.fetch(
      new Request(`https://matchmaker.internal/status?ticket=ghost&userId=${ALICE}`),
    )
    expect(missingTicket.status).toBe(404)
    expect(await missingTicket.json()).toEqual({ error: 'Tiket antrean tidak ditemukan', code: 'QUEUE_TICKET_NOT_FOUND' })
  })

  it('hands off the pair through /pair/take exactly once', async () => {
    const durableObject = newDurableObject()
    await post(durableObject, '/join', joinRequest(ALICE, 'team-alice', 'Garuda'))
    await post(durableObject, '/join', joinRequest(BOB, 'team-bob', 'Nusantara'))

    const first = (await (await post(durableObject, '/pair/take', {})).json()) as {
      matchId: string
      red: QueueJoinRequest
      blue: QueueJoinRequest
    }
    expect(first.red.userId).toBe(ALICE)
    expect(first.blue.userId).toBe(BOB)
    expect(await (await post(durableObject, '/pair/take', {})).json()).toBeNull()
  })

  it('expires stale tickets through /expire using the 120000 default', async () => {
    const durableObject = newDurableObject()
    await post(durableObject, '/join', joinRequest(ALICE, 'team-alice', 'Garuda'))

    expect(await (await post(durableObject, '/expire', {})).json()).toEqual({ cancelled: 0 })
    expect(await (await post(durableObject, '/expire', { maxAgeMs: -1 })).json()).toEqual({ cancelled: 1 })
  })

  it('records a result once and serves it from /leaderboard', async () => {
    const durableObject = newDurableObject()
    const record = { matchId: 'match-do-001', teamId: 'team-alice', name: 'Garuda', won: true }

    expect(await (await post(durableObject, '/result', record)).json()).toEqual({ recorded: true })
    expect(await (await post(durableObject, '/result', record)).json()).toEqual({ recorded: false })
    expect(await (await post(durableObject, '/leaderboard?limit=5', {})).json()).toEqual([
      { teamId: 'team-alice', name: 'Garuda', wins: 1, losses: 0 },
    ])
  })
})
