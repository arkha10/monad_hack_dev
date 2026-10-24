import type { ServerWsMessage } from '@boai/shared/types'

export interface SocketSink {
  send(payload: string): void
}

export class SocketRoom {
  private readonly members = new Map<SocketSink, { userId: string }>()

  add(sink: SocketSink, userId: string): void {
    this.members.set(sink, { userId })
  }

  remove(sink: SocketSink): void {
    this.members.delete(sink)
  }

  get size(): number {
    return this.members.size
  }

  userIdFor(sink: SocketSink): string | null {
    return this.members.get(sink)?.userId ?? null
  }

  broadcast(message: ServerWsMessage): void {
    // Serialize once so every attached socket receives byte-identical JSON for the same tick.
    const payload = JSON.stringify(message)
    for (const sink of this.members.keys()) sink.send(payload)
  }
}
