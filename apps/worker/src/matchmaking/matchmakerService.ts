import type { Behaviors, LeaderboardRecordRequest, LeaderboardRow, PracticeStartRequest, QueueJoinRequest, QueueJoinResponse, QueueStatusResponse } from '../routes/doProtocol'
import { RULESET_VERSION } from '../game/ruleset'
import { HttpError } from '../routes/http'
import { all, one, run } from '../storage/sql'
import type { SqlStore } from '../storage/sql'

export const DEFAULT_LEADERBOARD_LIMIT = 20
export const MAX_LEADERBOARD_LIMIT = 100

export function matchSeed(matchId: string): string {
  return `${RULESET_VERSION}:${matchId}`
}

type TicketStatus = 'waiting' | 'matched' | 'cancelled'

type QueueTicketRow = {
  ticket: string
  user_id: string
  team_id: string
  team_name: string
  stake_credits: number
  behaviors_json: string
  status: string
  match_id: string | null
  created_at: number
  matched_at: number | null
  handed_off: number
}

type PracticeRequestRow = {
  match_id: string
  payload_json: string
  handed_off: number
}

type CountRow = { total: number }
type MatchIdRow = { match_id: string }
type LeaderboardDbRow = { team_id: string; name: string; wins: number; losses: number }

function parseTicketStatus(value: string): TicketStatus {
  if (value === 'waiting' || value === 'matched' || value === 'cancelled') return value
  throw new Error(`Status tiket tidak dikenal: ${value}`)
}

function toJoinRequest(row: QueueTicketRow): QueueJoinRequest {
  return {
    userId: row.user_id,
    teamId: row.team_id,
    teamName: row.team_name,
    stakeCredits: row.stake_credits,
    behaviors: JSON.parse(row.behaviors_json) as Behaviors,
  }
}

export class MatchmakerService {
  constructor(private readonly sql: SqlStore, private readonly now: () => number) {
    run(sql, `CREATE TABLE IF NOT EXISTS queue_ticket (
      ticket TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      team_name TEXT NOT NULL,
      stake_credits INTEGER NOT NULL,
      behaviors_json TEXT NOT NULL,
      status TEXT NOT NULL,
      match_id TEXT,
      created_at INTEGER NOT NULL,
      matched_at INTEGER,
      handed_off INTEGER NOT NULL DEFAULT 0
    )`)
    run(sql, `CREATE INDEX IF NOT EXISTS queue_ticket_waiting ON queue_ticket (status, created_at)`)
    run(sql, `CREATE TABLE IF NOT EXISTS leaderboard (
      team_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`)
    run(sql, `CREATE TABLE IF NOT EXISTS practice_request (
      match_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      handed_off INTEGER NOT NULL DEFAULT 0
    )`)
    run(sql, `CREATE TABLE IF NOT EXISTS match_result (
      match_id TEXT PRIMARY KEY
    )`)
  }

  join(input: QueueJoinRequest): QueueJoinResponse {
    return this.sql.transaction(() => {
      const existing = this.liveTicketFor(input.userId)
      const ticket = existing ? existing.ticket : this.insertTicket(input)
      if (existing && existing.status === 'matched') {
        return { queueTicket: ticket, status: 'matched', matchId: existing.match_id }
      }

      const opponent = this.oldestWaitingOpponent(input.userId)
      if (!opponent) return { queueTicket: ticket, status: 'waiting', matchId: null }

      const matchId = crypto.randomUUID()
      run(
        this.sql,
        `UPDATE queue_ticket SET status = 'matched', match_id = ?, matched_at = ? WHERE ticket IN (?, ?)`,
        matchId,
        this.now(),
        ticket,
        opponent.ticket,
      )
      return { queueTicket: ticket, status: 'matched', matchId }
    })
  }

  status(ticket: string, userId: string): QueueStatusResponse {
    const row = this.requireTicket(ticket)
    this.requireOwner(row, userId)
    return { status: parseTicketStatus(row.status), matchId: row.match_id }
  }

  leave(ticket: string, userId: string): { status: 'cancelled' } {
    return this.sql.transaction(() => {
      const row = this.requireTicket(ticket)
      this.requireOwner(row, userId)
      if (row.status === 'matched') {
        throw new HttpError('QUEUE_TICKET_MATCHED', 'Tiket sudah cocok dengan lawan dan tidak dapat dibatalkan', 409)
      }
      if (row.status === 'waiting') {
        run(this.sql, `UPDATE queue_ticket SET status = 'cancelled' WHERE ticket = ?`, ticket)
      }
      return { status: 'cancelled' as const }
    })
  }

  expireStale(maxAgeMs: number): number {
    return this.sql.transaction(() => {
      const cutoff = this.now() - maxAgeMs
      const counted = one<CountRow>(this.sql, `SELECT COUNT(*) AS total FROM queue_ticket WHERE status = 'waiting' AND created_at < ?`, cutoff)
      const total = counted ? counted.total : 0
      if (total > 0) {
        run(this.sql, `UPDATE queue_ticket SET status = 'cancelled' WHERE status = 'waiting' AND created_at < ?`, cutoff)
      }
      return total
    })
  }

  takeMatchedPair(): { matchId: string; red: QueueJoinRequest; blue: QueueJoinRequest } | null {
    return this.sql.transaction(() => {
      const head = one<QueueTicketRow>(
        this.sql,
        `SELECT * FROM queue_ticket WHERE status = 'matched' AND handed_off = 0 ORDER BY matched_at ASC, created_at ASC LIMIT 1`,
      )
      if (!head || head.match_id === null) return null

      const pair = all<QueueTicketRow>(
        this.sql,
        `SELECT * FROM queue_ticket WHERE match_id = ? ORDER BY created_at ASC, rowid ASC`,
        head.match_id,
      )
      if (pair.length !== 2) throw new Error(`Pasangan tiket untuk match ${head.match_id} tidak lengkap: ${pair.length}`)

      run(this.sql, `UPDATE queue_ticket SET handed_off = 1 WHERE match_id = ? AND status = 'matched'`, head.match_id)
      const [red, blue] = pair
      return { matchId: head.match_id, red: toJoinRequest(red), blue: toJoinRequest(blue) }
    })
  }

  practice(input: PracticeStartRequest): { matchId: string } {
    const matchId = crypto.randomUUID()
    run(
      this.sql,
      `INSERT INTO practice_request (match_id, payload_json, handed_off) VALUES (?, ?, 0)`,
      matchId,
      JSON.stringify(input),
    )
    return { matchId }
  }

  takePracticeRequest(matchId: string): PracticeStartRequest | null {
    return this.sql.transaction(() => {
      const row = one<PracticeRequestRow>(this.sql, `SELECT * FROM practice_request WHERE match_id = ? AND handed_off = 0`, matchId)
      if (!row) return null
      run(this.sql, `UPDATE practice_request SET handed_off = 1 WHERE match_id = ?`, matchId)
      return JSON.parse(row.payload_json) as PracticeStartRequest
    })
  }

  recordResult(input: LeaderboardRecordRequest): void {
    const wins = input.won ? 1 : 0
    const losses = input.won ? 0 : 1
    run(
      this.sql,
      `INSERT INTO leaderboard (team_id, name, wins, losses, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(team_id) DO UPDATE SET
         name = excluded.name,
         wins = leaderboard.wins + excluded.wins,
         losses = leaderboard.losses + excluded.losses,
         updated_at = excluded.updated_at`,
      input.teamId,
      input.name,
      wins,
      losses,
      this.now(),
    )
  }

  recordResultOnce(matchId: string, input: LeaderboardRecordRequest): boolean {
    return this.sql.transaction(() => {
      const seen = one<MatchIdRow>(this.sql, `SELECT match_id FROM match_result WHERE match_id = ?`, matchId)
      if (seen) return false
      run(this.sql, `INSERT INTO match_result (match_id) VALUES (?)`, matchId)
      this.recordResult(input)
      return true
    })
  }

  leaderboard(limit = DEFAULT_LEADERBOARD_LIMIT): LeaderboardRow[] {
    const bounded = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), MAX_LEADERBOARD_LIMIT) : DEFAULT_LEADERBOARD_LIMIT
    return all<LeaderboardDbRow>(
      this.sql,
      `SELECT team_id, name, wins, losses FROM leaderboard ORDER BY wins DESC, losses ASC, name ASC LIMIT ?`,
      bounded,
    ).map(row => ({ teamId: row.team_id, name: row.name, wins: row.wins, losses: row.losses }))
  }

  private insertTicket(input: QueueJoinRequest): string {
    const ticket = crypto.randomUUID()
    run(
      this.sql,
      `INSERT INTO queue_ticket (ticket, user_id, team_id, team_name, stake_credits, behaviors_json, status, match_id, created_at, matched_at, handed_off)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting', NULL, ?, NULL, 0)`,
      ticket,
      input.userId,
      input.teamId,
      input.teamName,
      input.stakeCredits,
      JSON.stringify(input.behaviors),
      this.now(),
    )
    return ticket
  }

  private liveTicketFor(userId: string): QueueTicketRow | null {
    return one<QueueTicketRow>(
      this.sql,
      `SELECT * FROM queue_ticket
       WHERE user_id = ? AND (status = 'waiting' OR (status = 'matched' AND handed_off = 0))
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      userId,
    )
  }

  private oldestWaitingOpponent(userId: string): QueueTicketRow | null {
    return one<QueueTicketRow>(
      this.sql,
      `SELECT * FROM queue_ticket WHERE status = 'waiting' AND user_id <> ? ORDER BY created_at ASC, rowid ASC LIMIT 1`,
      userId,
    )
  }

  private requireTicket(ticket: string): QueueTicketRow {
    const row = one<QueueTicketRow>(this.sql, `SELECT * FROM queue_ticket WHERE ticket = ?`, ticket)
    if (!row) throw new HttpError('QUEUE_TICKET_NOT_FOUND', 'Tiket antrean tidak ditemukan', 404)
    return row
  }

  private requireOwner(row: QueueTicketRow, userId: string): void {
    if (row.user_id !== userId) throw new HttpError('FORBIDDEN', 'Tiket antrean milik pengguna lain', 403)
  }
}
