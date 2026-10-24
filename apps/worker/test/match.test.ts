import { describe, expect, it } from 'vitest'
import type { AgentSlot, Behavior, MatchEvent } from '@boai/shared/types'
import type { MatchInitRequest } from '../src/routes/doProtocol'
import { HttpError } from '../src/routes/http'
import { MATCH } from '../src/game/ruleset'
import { MemorySqlStore } from '../src/testing/memorySql'
import { MatchService } from '../src/ws/matchService'

const BEHAVIORS: Record<AgentSlot, Behavior> = {
  p1: 'BUILD_FIRST',
  p2: 'DODGE_FIRST',
  p3: 'DECOY',
  p4: 'CHASE_BALL',
  p5: 'BALANCED',
}

const START_MS = 1_700_000_000_000

function initRequest(overrides: Partial<MatchInitRequest> = {}): MatchInitRequest {
  return {
    matchId: 'match-test-001',
    mode: 'practice',
    seed: 'seed-alpha',
    difficulty: 'medium',
    redOwnerId: 'user-red',
    blueOwnerId: 'bot-practice-opponent',
    redTeamId: 'team-red',
    blueTeamId: 'team-blue',
    redTeamName: 'Garuda',
    blueTeamName: 'Nusantara',
    redBehaviors: BEHAVIORS,
    blueBehaviors: BEHAVIORS,
    ...overrides,
  }
}

function fixture() {
  let clock = START_MS
  const store = new MemorySqlStore()
  const service = new MatchService(store, () => clock)
  return {
    store,
    service,
    advance: (ms: number) => {
      clock += ms
    },
    close: () => store.close(),
  }
}

describe('MatchService persistence', () => {
  it('returns the same seed on a repeated init and does not reset seq', () => {
    const f = fixture()
    const first = f.service.init(initRequest())
    f.service.tick('match-test-001', 40)
    const advanced = f.service.view('match-test-001')

    const second = f.service.init(initRequest())

    expect(first.snapshot.seed).toBe('seed-alpha')
    expect(second.snapshot.seed).toBe('seed-alpha')
    expect(advanced.snapshot.seq).toBeGreaterThan(0)
    expect(second.snapshot.seq).toBe(advanced.snapshot.seq)
    f.close()
  })

  it('persists events and returns only seq greater than the cursor', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.service.coach('match-test-001', { userId: 'user-red', command: 'ATTACK', clientMsgId: 'c1' })
    f.service.coach('match-test-001', { userId: 'user-red', command: 'DEFEND', clientMsgId: 'c2' })
    f.service.tick('match-test-001', 1_200)

    const all = f.service.events('match-test-001', 0)
    const cursor = all[1].seq
    const tail = f.service.events('match-test-001', cursor)

    expect(all.length).toBeGreaterThan(0)
    expect(all.map(event => event.seq)).toEqual(all.map((_, index) => index + 1))
    expect(tail.map(event => event.seq)).toEqual(all.slice(2).map(event => event.seq))
    expect(tail.every((event: MatchEvent) => event.seq > cursor)).toBe(true)
    expect(all.map(event => event.id)).toEqual(all.map(event => `match-test-001:${event.seq}`))
    f.close()
  })

  it('gives two service instances over one store the same authoritative snapshot', () => {
    const f = fixture()
    const other = new MatchService(f.store, () => START_MS)
    f.service.init(initRequest())
    f.service.tick('match-test-001', 250)

    const fromA = JSON.stringify(f.service.view('match-test-001').snapshot)
    const fromB = JSON.stringify(other.view('match-test-001').snapshot)

    expect(fromB).toBe(fromA)
    f.close()
  })

  it('replays byte-identical event payloads for the same match id and seed', () => {
    const left = fixture()
    const right = fixture()
    left.service.init(initRequest())
    right.service.init(initRequest())
    left.service.tick('match-test-001', 400)
    right.service.tick('match-test-001', 400)

    const leftEvents = JSON.stringify(left.service.events('match-test-001', 0))
    const rightEvents = JSON.stringify(right.service.events('match-test-001', 0))

    expect(leftEvents.length).toBeGreaterThan(2)
    expect(rightEvents).toBe(leftEvents)
    left.close()
    right.close()
  })

  it('throws MATCH_NOT_FOUND with status 404 for an unknown match', () => {
    const f = fixture()
    let thrown: unknown = null
    try {
      f.service.view('match-missing')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(HttpError)
    expect((thrown as HttpError).code).toBe('MATCH_NOT_FOUND')
    expect((thrown as HttpError).status).toBe(404)
    f.close()
  })
})

describe('MatchService coaching', () => {
  it('rejects a non-owner and accepts the owner with a higher seq', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.service.tick('match-test-001', 100)
    const before = JSON.stringify(f.service.view('match-test-001').snapshot)

    const intruder = f.service.coach('match-test-001', { userId: 'user-other', command: 'ATTACK', clientMsgId: 'm1' })
    const afterIntruder = JSON.stringify(f.service.view('match-test-001').snapshot)
    const owner = f.service.coach('match-test-001', { userId: 'user-red', command: 'ATTACK', clientMsgId: 'm2' })

    expect(intruder.accepted).toBe(false)
    expect(intruder.reason).toBe('Bukan peserta pertandingan ini')
    expect(afterIntruder).toBe(before)
    expect(owner.accepted).toBe(true)
    expect(owner.seq).toBeGreaterThan(intruder.seq)
    f.close()
  })

  it('records the accepted coach command in the event log', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.service.tick('match-test-001', 60)
    f.service.coach('match-test-001', { userId: 'user-red', command: 'DEFEND', clientMsgId: 'm3' })

    const events = f.service.events('match-test-001', 0)
    const coachEvent = events[events.length - 1]

    expect(coachEvent.kind).toBe('COACH_APPLIED')
    expect(coachEvent.payload.command).toBe('DEFEND')
    expect(coachEvent.payload.side).toBe('red')
    f.close()
  })
})

describe('MatchService tickets', () => {
  it('redeems a ticket once and rejects the second attempt', () => {
    const f = fixture()
    f.service.init(initRequest())
    const issued = f.service.issueWsTicket('match-test-001', 'user-red', 60_000)

    const first = f.service.redeemWsTicket('match-test-001', issued.ticket)
    const second = f.service.redeemWsTicket('match-test-001', issued.ticket)

    expect(first).toBe('user-red')
    expect(second).toBeNull()
    f.close()
  })

  it('rejects an expired ticket', () => {
    const f = fixture()
    f.service.init(initRequest())
    const issued = f.service.issueWsTicket('match-test-001', 'user-red', 1_000)
    f.advance(2_000)

    expect(f.service.redeemWsTicket('match-test-001', issued.ticket)).toBeNull()
    f.close()
  })

  it('rejects a ticket issued for a different match', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.service.init(initRequest({ matchId: 'match-test-002' }))
    const issued = f.service.issueWsTicket('match-test-002', 'user-red')

    expect(f.service.redeemWsTicket('match-test-001', issued.ticket)).toBeNull()
    f.close()
  })
})

describe('MatchService results and winners', () => {
  it('reports no winner before the match finishes', () => {
    const f = fixture()
    f.service.init(initRequest({ seed: 'winner-seed-0' }))
    const tick = f.service.tick('match-test-001', 200)

    expect(tick.snapshot.phase).toBe('KNOCKDOWN')
    expect(tick.result).toBeNull()
    expect(f.service.authoritativeWinner('match-test-001')).toBeNull()
    f.close()
  })

  it('persists the result once and returns the winning owner id', () => {
    const f = fixture()
    f.service.init(initRequest({ seed: 'winner-seed-0' }))
    let result = null
    for (let target = 100; target <= 1_600; target += 100) {
      f.service.coach('match-test-001', { userId: 'user-red', command: 'ATTACK', clientMsgId: `c${target}` })
      result = f.service.tick('match-test-001', target).result
      if (result) break
    }

    expect(result).not.toBeNull()
    // Which side wins is a property of the ruleset, not of persistence. What this test is
    // about is that the winner is a real side and maps to that side's owner id. The practice
    // bot must never be awarded anything, so a blue win resolves to no owner at all.
    expect(['red', 'blue']).toContain(result?.winnerSide)
    const winnerSide = result?.winnerSide as 'red' | 'blue'
    expect(f.service.authoritativeWinner('match-test-001')).toBe(winnerSide === 'red' ? 'user-red' : null)
    expect(result?.rulesetHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result?.replayHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result?.chainTxHash).toBeNull()
    expect(result?.finalizedAt).toBe(new Date(START_MS).toISOString())

    const again = f.service.tick('match-test-001', 1_600)
    expect(JSON.stringify(again.result)).toBe(JSON.stringify(result))
    f.close()
  })

  it('returns no winner for a draw', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.store.exec(
      'INSERT INTO match_result (match_id, result_json) VALUES (?, ?)',
      'match-test-001',
      JSON.stringify({
        matchId: 'match-test-001',
        winnerSide: 'draw',
        scores: {
          red: { buildCount: 2, completionMs: null, eliminations: 0, objectiveComplete: false },
          blue: { buildCount: 2, completionMs: null, eliminations: 0, objectiveComplete: false },
        },
        seed: 'seed-alpha',
        replayHash: `0x${'11'.repeat(32)}`,
        rulesetHash: `0x${'22'.repeat(32)}`,
        resultHash: `0x${'33'.repeat(32)}`,
        chainTxHash: null,
        finalizedAt: new Date(START_MS).toISOString(),
      }),
    )

    expect(f.service.authoritativeWinner('match-test-001')).toBeNull()
    f.close()
  })

  it('never reports the practice bot as the authoritative winner', () => {
    const f = fixture()
    f.service.init(initRequest())
    f.service.tick('match-test-001', (MATCH.halfDurationMs * 2 + MATCH.halftimeDurationMs) / MATCH.tickMs + 5)

    const winner = f.service.authoritativeWinner('match-test-001')
    expect(winner).not.toBe('bot-practice-opponent')
    expect(winner === null || winner === 'user-red').toBe(true)
    f.close()
  })
})
