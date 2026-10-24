import { describe, expect, it } from 'vitest'
import type { AgentSlot, Behavior, ServerWsMessage } from '@boai/shared/types'
import type { MatchInitRequest } from '../src/routes/doProtocol'
import { MATCH } from '../src/game/ruleset'
import { MemorySqlStore } from '../src/testing/memorySql'
import { MatchService } from '../src/ws/matchService'
import { MatchSession } from '../src/ws/matchSocket'
import { MatchDurableObject } from '../src/ws/matchDo'
import type { SocketSink } from '../src/ws/room'

const BEHAVIORS: Record<AgentSlot, Behavior> = {
  p1: 'BUILD_FIRST',
  p2: 'DODGE_FIRST',
  p3: 'DECOY',
  p4: 'CHASE_BALL',
  p5: 'BALANCED',
}

const START_MS = 1_700_000_000_000
const MATCH_ID = 'match-ws-001'

function initRequest(): MatchInitRequest {
  return {
    matchId: MATCH_ID,
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
  }
}

interface Recorder extends SocketSink {
  sent: string[]
}

function recorder(): Recorder {
  const sent: string[] = []
  return { sent, send: (payload: string) => sent.push(payload) }
}

function fixture() {
  const store = new MemorySqlStore()
  const service = new MatchService(store, () => START_MS)
  service.init(initRequest())
  const session = new MatchSession(MATCH_ID, service, () => START_MS)
  return { store, service, session, close: () => store.close() }
}

function parse(sent: string[]): ServerWsMessage[] {
  return sent.map(payload => JSON.parse(payload) as ServerWsMessage)
}

describe('MatchSession message handling', () => {
  it('answers CLIENT_READY with the current authoritative snapshot', () => {
    const f = fixture()
    f.service.tick(MATCH_ID, 120)
    const sink = recorder()
    f.session.attach('user-red', sink)

    const replies = f.session.handleMessage('user-red', JSON.stringify({ type: 'CLIENT_READY', matchId: MATCH_ID }))

    expect(replies).toHaveLength(1)
    expect(replies[0].type).toBe('MATCH_SNAPSHOT')
    if (replies[0].type !== 'MATCH_SNAPSHOT') throw new Error('unreachable')
    expect(replies[0].snapshot.id).toBe(MATCH_ID)
    expect(replies[0].snapshot.seed).toBe('seed-alpha')
    expect(replies[0].snapshot.seq).toBe(f.service.view(MATCH_ID).snapshot.seq)
    f.close()
  })

  it('echoes both times on PING', () => {
    const f = fixture()
    const replies = f.session.handleMessage('user-red', JSON.stringify({ type: 'PING', clientTime: 42 }))

    expect(replies).toEqual([{ type: 'PONG', clientTime: 42, serverTime: START_MS }])
    f.close()
  })

  it('acknowledges a coach command with the same clientMsgId', () => {
    const f = fixture()
    f.service.tick(MATCH_ID, 80)

    const replies = f.session.handleMessage(
      'user-red',
      JSON.stringify({ type: 'COACH_SUBMIT', matchId: MATCH_ID, command: 'ATTACK', clientMsgId: 'cm-9' }),
    )

    expect(replies).toEqual([{ type: 'COACH_ACK', clientMsgId: 'cm-9', accepted: true, reason: null }])
    f.close()
  })

  it('returns ERROR for a coach command from a non-owner', () => {
    const f = fixture()
    f.service.tick(MATCH_ID, 80)

    const replies = f.session.handleMessage(
      'user-stranger',
      JSON.stringify({ type: 'COACH_SUBMIT', matchId: MATCH_ID, command: 'ATTACK', clientMsgId: 'cm-10' }),
    )

    expect(replies).toEqual([{ type: 'COACH_ACK', clientMsgId: 'cm-10', accepted: false, reason: 'Bukan peserta pertandingan ini' }])
    f.close()
  })

  it('returns ERROR for a coach command aimed at another match', () => {
    const f = fixture()

    const replies = f.session.handleMessage(
      'user-red',
      JSON.stringify({ type: 'COACH_SUBMIT', matchId: 'match-other', command: 'ATTACK', clientMsgId: 'cm-11' }),
    )

    expect(replies).toHaveLength(1)
    expect(replies[0].type).toBe('ERROR')
    if (replies[0].type !== 'ERROR') throw new Error('unreachable')
    expect(replies[0].code).toBe('MATCH_MISMATCH')
    f.close()
  })

  it('returns exactly one BAD_MESSAGE ERROR for malformed JSON', () => {
    const f = fixture()

    const replies = f.session.handleMessage('user-red', '{not json')

    expect(replies).toEqual([{ type: 'ERROR', code: 'BAD_MESSAGE', message: 'Pesan tidak dikenali' }])
    f.close()
  })

  it('returns exactly one BAD_MESSAGE ERROR for an unknown message type', () => {
    const f = fixture()

    const replies = f.session.handleMessage('user-red', JSON.stringify({ type: 'LAUNCH_MISSILES' }))

    expect(replies).toEqual([{ type: 'ERROR', code: 'BAD_MESSAGE', message: 'Pesan tidak dikenali' }])
    f.close()
  })
})

describe('MatchSession fan-out', () => {
  it('sends the identical snapshot JSON to two attached sinks', () => {
    const f = fixture()
    const red = recorder()
    const blue = recorder()
    f.session.attach('user-red', red)
    f.session.attach('user-blue', blue)

    f.session.advanceTo(150)

    const snapshots = parse(red.sent).filter(message => message.type === 'MATCH_SNAPSHOT')
    const mirrored = parse(blue.sent).filter(message => message.type === 'MATCH_SNAPSHOT')

    expect(snapshots).toHaveLength(1)
    expect(blue.sent[0]).toBe(red.sent[0])
    expect(JSON.stringify(mirrored[0])).toBe(JSON.stringify(snapshots[0]))
    f.close()
  })

  it('pushes each new event once and the result once', () => {
    const f = fixture()
    const sink = recorder()
    f.session.attach('user-red', sink)

    f.session.advanceTo((MATCH.halfDurationMs * 2 + MATCH.halftimeDurationMs) / MATCH.tickMs + 5)

    const messages = parse(sink.sent)
    const completes = messages.filter(message => message.type === 'MATCH_COMPLETE')
    const snapshots = messages.filter(message => message.type === 'MATCH_SNAPSHOT')
    const events = messages.filter(message => message.type === 'MATCH_EVENT')

    expect(completes).toHaveLength(1)
    expect(snapshots).toHaveLength(1)
    expect(events).toHaveLength(f.service.events(MATCH_ID, 0).length)
    expect(new Set(events.map(message => (message.type === 'MATCH_EVENT' ? message.event.seq : -1))).size).toBe(events.length)
    f.close()
  })

  it('stops delivering to a sink after detach', () => {
    const f = fixture()
    const leaving = recorder()
    f.session.attach('user-red', leaving)
    const replies = f.session.handleMessage('user-red', JSON.stringify({ type: 'CLIENT_READY', matchId: MATCH_ID }))
    for (const reply of replies) leaving.send(JSON.stringify(reply))
    const afterReady = leaving.sent.length

    f.session.detach(leaving)
    f.session.advanceTo(200)

    expect(afterReady).toBe(1)
    expect(leaving.sent).toHaveLength(afterReady)
    expect(parse(leaving.sent).some(message => message.type === 'MATCH_EVENT')).toBe(false)
    f.close()
  })

  it('keeps the detached socket out while another socket keeps receiving', () => {
    const f = fixture()
    const leaving = recorder()
    const staying = recorder()
    f.session.attach('user-red', leaving)
    f.session.attach('user-blue', staying)

    f.session.detach(leaving)
    f.session.advanceTo(160)

    expect(leaving.sent).toHaveLength(0)
    expect(parse(staying.sent).some(message => message.type === 'MATCH_SNAPSHOT')).toBe(true)
    f.close()
  })
})

interface FakeDoState {
  storage: { sql: MemorySqlStore; setAlarm: () => Promise<void>; getAlarm: () => Promise<null> }
  acceptWebSocket: (ws: WebSocket) => void
  accepted: WebSocket[]
}

function fakeDoState(store: MemorySqlStore): FakeDoState {
  const accepted: WebSocket[] = []
  return {
    accepted,
    storage: { sql: store, setAlarm: async () => {}, getAlarm: async () => null },
    acceptWebSocket: (ws: WebSocket) => {
      accepted.push(ws)
    },
  }
}

function durableObject(store: MemorySqlStore): MatchDurableObject {
  const state = fakeDoState(store)
  return new MatchDurableObject(state as unknown as DurableObjectState, {} as never)
}

describe('MatchDurableObject routing', () => {
  it('serves the match view and maps a missing match to 404', async () => {
    const store = new MemorySqlStore()
    const durable = durableObject(store)
    await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/init`, { method: 'POST', body: JSON.stringify(initRequest()) }),
    )

    const view = await durable.fetch(new Request(`https://do.internal/${MATCH_ID}/view`))
    const body = (await view.json()) as { snapshot: { id: string; seed: string }; redTeamId: string }

    expect(view.status).toBe(200)
    expect(body.snapshot.id).toBe(MATCH_ID)
    expect(body.snapshot.seed).toBe('seed-alpha')
    expect(body.redTeamId).toBe('team-red')

    const missing = await durable.fetch(new Request('https://do.internal/match-nope/view'))
    expect(missing.status).toBe(404)
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe('MATCH_NOT_FOUND')
    store.close()
  })

  it('rejects a websocket upgrade without a valid ticket', async () => {
    const store = new MemorySqlStore()
    const durable = durableObject(store)

    const response = await durable.fetch(
      new Request(`https://do.internal/ws/${MATCH_ID}?ticket=bogus`, { headers: { Upgrade: 'websocket' } }),
    )

    expect(response.status).toBe(401)
    store.close()
  })

  it('answers the winner route from the persisted result', async () => {
    const store = new MemorySqlStore()
    const durable = durableObject(store)
    await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/init`, { method: 'POST', body: JSON.stringify(initRequest()) }),
    )

    const response = await durable.fetch(new Request(`https://do.internal/${MATCH_ID}/winner`))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: null })
    store.close()
  })

  it('advances the match through the tick route and returns the new snapshot', async () => {
    const store = new MemorySqlStore()
    const durable = durableObject(store)
    await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/init`, { method: 'POST', body: JSON.stringify(initRequest()) }),
    )

    const ticked = await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/tick`, { method: 'POST', body: JSON.stringify({ targetTick: 200 }) }),
    )
    const body = (await ticked.json()) as { snapshot: { seq: number; phase: string } }

    expect(ticked.status).toBe(200)
    expect(body.snapshot.seq).toBeGreaterThan(0)
    expect(body.snapshot.phase).toBe('KNOCKDOWN')
    store.close()
  })

  it('burns the ticket so a second upgrade is rejected before any socket is opened', async () => {
    const store = new MemorySqlStore()
    const durable = durableObject(store)
    await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/init`, { method: 'POST', body: JSON.stringify(initRequest()) }),
    )
    const issued = await durable.fetch(
      new Request(`https://do.internal/${MATCH_ID}/ticket`, { method: 'POST', body: JSON.stringify({ userId: 'user-red' }) }),
    )
    const { ticket } = (await issued.json()) as { ticket: string }

    const upgrade = () =>
      durable.fetch(new Request(`https://do.internal/ws/${MATCH_ID}?ticket=${ticket}`, { headers: { Upgrade: 'websocket' } }))

    // The first attempt reaches the WebSocketPair constructor, which does not exist under Node.
    await upgrade().catch(() => undefined)
    const second = await upgrade()

    expect(second.status).toBe(401)
    store.close()
  })
})
