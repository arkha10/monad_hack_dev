import type { ClientWsMessage, CoachCommand, ServerWsMessage } from '@boai/shared/types'
import { SocketRoom, type SocketSink } from './room'
import type { MatchService } from './matchService'

const COACH_COMMANDS: CoachCommand[] = ['ATTACK', 'DEFEND', 'REBUILD', 'DISTRACT']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Parses the untrusted wire message into the shared client union. Returns null on anything
 * that does not match, so the caller can answer one ERROR instead of throwing.
 */
function parseClientMessage(raw: string): ClientWsMessage | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(decoded)) return null

  switch (decoded.type) {
    case 'PING':
      return typeof decoded.clientTime === 'number' ? { type: 'PING', clientTime: decoded.clientTime } : null
    case 'CLIENT_READY':
      return typeof decoded.matchId === 'string' ? { type: 'CLIENT_READY', matchId: decoded.matchId } : null
    case 'COACH_SUBMIT': {
      if (typeof decoded.matchId !== 'string') return null
      if (typeof decoded.clientMsgId !== 'string') return null
      const command = decoded.command
      if (typeof command !== 'string' || !COACH_COMMANDS.includes(command as CoachCommand)) return null
      return { type: 'COACH_SUBMIT', matchId: decoded.matchId, command: command as CoachCommand, clientMsgId: decoded.clientMsgId }
    }
    default:
      return null
  }
}

export class MatchSession {
  private readonly room = new SocketRoom()

  constructor(
    readonly matchId: string,
    private readonly service: MatchService,
    private readonly now: () => number,
  ) {}

  attach(userId: string, sink: SocketSink): void {
    this.room.add(sink, userId)
  }

  detach(sink: SocketSink): void {
    this.room.remove(sink)
  }

  handleMessage(userId: string, raw: string): ServerWsMessage[] {
    const message = parseClientMessage(raw)
    if (!message) return [{ type: 'ERROR', code: 'BAD_MESSAGE', message: 'Pesan tidak dikenali' }]

    try {
      if (message.type === 'PING') {
        return [{ type: 'PONG', clientTime: message.clientTime, serverTime: this.now() }]
      }
      if (message.type === 'CLIENT_READY') {
        if (message.matchId !== this.matchId) {
          return [{ type: 'ERROR', code: 'MATCH_MISMATCH', message: 'matchId tidak cocok dengan koneksi ini' }]
        }
        return [{ type: 'MATCH_SNAPSHOT', snapshot: this.service.view(this.matchId).snapshot }]
      }
      if (message.matchId !== this.matchId) {
        return [{ type: 'ERROR', code: 'MATCH_MISMATCH', message: 'matchId tidak cocok dengan koneksi ini' }]
      }
      const response = this.service.coach(this.matchId, {
        userId,
        command: message.command,
        clientMsgId: message.clientMsgId,
      })
      return [
        { type: 'COACH_ACK', clientMsgId: message.clientMsgId, accepted: response.accepted, reason: response.reason },
      ]
    } catch {
      return [{ type: 'ERROR', code: 'MATCH_UNAVAILABLE', message: 'Pertandingan tidak tersedia' }]
    }
  }

  broadcast(message: ServerWsMessage): void {
    this.room.broadcast(message)
  }

  advanceTo(targetTick: number): void {
    const { snapshot, events, result } = this.service.tick(this.matchId, targetTick)
    if (this.room.size === 0) return
    this.broadcast({ type: 'MATCH_SNAPSHOT', snapshot })
    for (const event of events) this.broadcast({ type: 'MATCH_EVENT', event })
    if (result) this.broadcast({ type: 'MATCH_COMPLETE', result })
  }

  get attached(): number {
    return this.room.size
  }
}
