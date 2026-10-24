import type { AgentSlot, Behavior, MatchEvent, MatchResult, MatchSnapshot, Side } from '@boai/shared/types'
import { stableMatchDigest } from '@boai/shared/helpers'
import { keccak256, stringToBytes } from 'viem'
import type { SqlStore } from '../storage/sql'
import { all, one, run } from '../storage/sql'
import { HttpError } from '../routes/http'
import type { CoachRequest, CoachResponse, MatchInitRequest, MatchViewResponse, WsTicketResponse } from '../routes/doProtocol'
import { advanceTo, applyCoach, createGameState, toSnapshot, type GameState } from '../game/engine'
import { MATCH, PRACTICE_OPPONENT_OWNER, RULESET_VERSION } from '../game/ruleset'

const SLOTS: AgentSlot[] = ['p1', 'p2', 'p3', 'p4', 'p5']

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS match_state (match_id TEXT PRIMARY KEY, state_json TEXT, updated_at INTEGER)',
  'CREATE TABLE IF NOT EXISTS match_event (match_id TEXT, seq INTEGER, event_json TEXT, PRIMARY KEY (match_id, seq))',
  'CREATE TABLE IF NOT EXISTS match_meta (match_id TEXT PRIMARY KEY, red_team_id TEXT, blue_team_id TEXT, red_team_name TEXT, blue_team_name TEXT, mode TEXT, difficulty TEXT, red_owner_id TEXT, blue_owner_id TEXT)',
  'CREATE TABLE IF NOT EXISTS ws_ticket (ticket TEXT PRIMARY KEY, match_id TEXT, user_id TEXT, expires_at INTEGER, consumed INTEGER DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS match_result (match_id TEXT PRIMARY KEY, result_json TEXT)',
]

type StateRow = {
  state_json: string
}

type EventRow = {
  event_json: string
}

type MetaRow = {
  red_team_id: string
  blue_team_id: string
  red_team_name: string
  blue_team_name: string
  mode: string
  difficulty: string
  red_owner_id: string
  blue_owner_id: string | null
}

type ResultRow = {
  result_json: string
}

type TicketRow = {
  user_id: string
}

/**
 * Practice hands the bot the same behaviors as the human. Identical physics and identical
 * policy means the difficulty preset cannot grant the bot a hidden advantage.
 */
function blueBehaviorsFor(input: MatchInitRequest): Record<AgentSlot, Behavior> {
  if (input.mode === 'pvp') return input.blueBehaviors
  const mirrored = {} as Record<AgentSlot, Behavior>
  for (const slot of SLOTS) mirrored[slot] = input.redBehaviors[slot]
  return mirrored
}

export class MatchService {
  constructor(
    private readonly sql: SqlStore,
    private readonly now: () => number,
  ) {
    for (const statement of SCHEMA) run(this.sql, statement)
  }

  init(input: MatchInitRequest): MatchViewResponse {
    const existing = this.loadState(input.matchId)
    if (existing) return this.view(input.matchId)

    const state = createGameState({
      matchId: input.matchId,
      mode: input.mode,
      seed: input.seed,
      difficulty: input.difficulty,
      redOwnerId: input.redOwnerId,
      blueOwnerId: input.blueOwnerId,
      redBehaviors: input.redBehaviors,
      blueBehaviors: blueBehaviorsFor(input),
      nowMs: this.now(),
    })

    this.sql.transaction(() => {
      run(
        this.sql,
        'INSERT INTO match_meta (match_id, red_team_id, blue_team_id, red_team_name, blue_team_name, mode, difficulty, red_owner_id, blue_owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        input.matchId,
        input.redTeamId,
        input.blueTeamId,
        input.redTeamName,
        input.blueTeamName,
        input.mode,
        input.difficulty,
        input.redOwnerId,
        input.blueOwnerId,
      )
      this.writeState(state)
    })

    return this.view(input.matchId)
  }

  view(matchId: string): MatchViewResponse {
    const state = this.requireState(matchId)
    const meta = this.requireMeta(matchId)
    return {
      snapshot: toSnapshot(state, this.now()),
      result: this.loadResult(matchId),
      events: this.events(matchId, 0),
      redTeamId: meta.red_team_id,
      blueTeamId: meta.blue_team_id,
    }
  }

  events(matchId: string, afterSeq: number): MatchEvent[] {
    return all<EventRow>(
      this.sql,
      'SELECT event_json FROM match_event WHERE match_id = ? AND seq > ? ORDER BY seq ASC',
      matchId,
      afterSeq,
    ).map(row => JSON.parse(row.event_json) as MatchEvent)
  }

  tick(matchId: string, targetTick: number): { snapshot: MatchSnapshot; events: MatchEvent[]; result: MatchResult | null } {
    const state = this.requireState(matchId)
    const { state: advanced, events } = advanceTo(state, targetTick)
    const snapshot = toSnapshot(advanced, this.now())

    const result = this.sql.transaction(() => {
      this.writeState(advanced)
      for (const event of events) {
        run(
          this.sql,
          'INSERT OR IGNORE INTO match_event (match_id, seq, event_json) VALUES (?, ?, ?)',
          matchId,
          event.seq,
          JSON.stringify(event),
        )
      }
      if (advanced.phase !== 'FINISHED') return null
      const stored = this.loadResult(matchId)
      if (stored) return stored
      const finalized = this.buildResult(advanced, snapshot)
      run(this.sql, 'INSERT INTO match_result (match_id, result_json) VALUES (?, ?)', matchId, JSON.stringify(finalized))
      return finalized
    })

    return { snapshot, events, result }
  }

  coach(matchId: string, req: CoachRequest): CoachResponse {
    const state = this.requireState(matchId)
    const meta = this.requireMeta(matchId)
    const side = this.sideOf(meta, req.userId)
    if (!side) {
      return { accepted: false, seq: state.seq, reason: 'Bukan peserta pertandingan ini' }
    }

    const outcome = applyCoach(state, side, req.command)
    if (!outcome.accepted) return { accepted: false, seq: state.seq, reason: outcome.reason }

    // Coach commands change later physics, so they belong in the replay log. Bumping the
    // engine's seq keeps the log and the engine counter on one monotonic sequence.
    state.seq += 1
    const event: MatchEvent = {
      id: `${matchId}:${state.seq}`,
      matchId,
      seq: state.seq,
      atMs: state.halfElapsedMs + (state.half === 2 ? MATCH.halfDurationMs : 0),
      kind: 'COACH_APPLIED',
      actor: null,
      payload: { command: req.command, side },
    }

    this.sql.transaction(() => {
      run(
        this.sql,
        'INSERT INTO match_event (match_id, seq, event_json) VALUES (?, ?, ?)',
        matchId,
        event.seq,
        JSON.stringify(event),
      )
      this.writeState(state)
    })

    return { accepted: true, seq: state.seq, reason: null }
  }

  issueWsTicket(matchId: string, userId: string, ttlMs = 60_000): WsTicketResponse {
    this.requireMeta(matchId)
    const ticket = crypto.randomUUID()
    const expiresAt = this.now() + ttlMs
    run(
      this.sql,
      'INSERT INTO ws_ticket (ticket, match_id, user_id, expires_at, consumed) VALUES (?, ?, ?, ?, 0)',
      ticket,
      matchId,
      userId,
      expiresAt,
    )
    return { ticket, expiresAt: new Date(expiresAt).toISOString() }
  }

  redeemWsTicket(matchId: string, ticket: string): string | null {
    const rows = all<TicketRow>(
      this.sql,
      'UPDATE ws_ticket SET consumed = 1 WHERE ticket = ? AND match_id = ? AND consumed = 0 AND expires_at > ? RETURNING user_id',
      ticket,
      matchId,
      this.now(),
    )
    return rows.length > 0 ? rows[0].user_id : null
  }

  authoritativeWinner(matchId: string): string | null {
    const result = this.loadResult(matchId)
    if (!result || result.winnerSide === 'draw') return null
    const meta = this.requireMeta(matchId)
    const owner = result.winnerSide === 'red' ? meta.red_owner_id : meta.blue_owner_id
    // The practice bot has no wallet, so it can never be an authoritative claim recipient.
    if (!owner || owner === PRACTICE_OPPONENT_OWNER) return null
    return owner
  }

  private buildResult(state: GameState, snapshot: MatchSnapshot): MatchResult {
    const eventHashes = all<EventRow>(
      this.sql,
      'SELECT event_json FROM match_event WHERE match_id = ? ORDER BY seq ASC',
      state.matchId,
    ).map(row => (JSON.parse(row.event_json) as MatchEvent).id)
    const replayHash = stableMatchDigest(snapshot, eventHashes)
    const rulesetHash = keccak256(stringToBytes(RULESET_VERSION))
    const winnerSide: Side | 'draw' = state.winnerSide ?? 'draw'
    const scores = { red: state.redScore, blue: state.blueScore }
    const resultHash = keccak256(
      stringToBytes(JSON.stringify({ matchId: state.matchId, winnerSide, scores, seed: state.seed, replayHash })),
    )
    return {
      matchId: state.matchId,
      winnerSide,
      scores,
      seed: state.seed,
      replayHash,
      rulesetHash,
      resultHash,
      chainTxHash: null,
      finalizedAt: new Date(this.now()).toISOString(),
    }
  }

  private sideOf(meta: MetaRow, userId: string): Side | null {
    if (userId === meta.red_owner_id) return 'red'
    if (meta.blue_owner_id !== null && userId === meta.blue_owner_id) return 'blue'
    return null
  }

  private writeState(state: GameState): void {
    run(
      this.sql,
      'INSERT INTO match_state (match_id, state_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(match_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at',
      state.matchId,
      JSON.stringify(state),
      this.now(),
    )
  }

  private loadState(matchId: string): GameState | null {
    const row = one<StateRow>(this.sql, 'SELECT state_json FROM match_state WHERE match_id = ?', matchId)
    return row ? (JSON.parse(row.state_json) as GameState) : null
  }

  private requireState(matchId: string): GameState {
    const state = this.loadState(matchId)
    if (!state) throw new HttpError('MATCH_NOT_FOUND', 'Pertandingan tidak ditemukan', 404)
    return state
  }

  private requireMeta(matchId: string): MetaRow {
    const meta = one<MetaRow>(this.sql, 'SELECT * FROM match_meta WHERE match_id = ?', matchId)
    if (!meta) throw new HttpError('MATCH_NOT_FOUND', 'Pertandingan tidak ditemukan', 404)
    return meta
  }

  private loadResult(matchId: string): MatchResult | null {
    const row = one<ResultRow>(this.sql, 'SELECT result_json FROM match_result WHERE match_id = ?', matchId)
    return row ? (JSON.parse(row.result_json) as MatchResult) : null
  }
}
