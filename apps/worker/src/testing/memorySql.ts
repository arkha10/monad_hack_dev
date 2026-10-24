import { DatabaseSync } from 'node:sqlite'
import type { SqlCursor, SqlStore, SqlValue } from '../storage/sql'

function normalize<T extends Record<string, SqlValue>>(row: unknown): T {
  return { ...(row as Record<string, SqlValue>) } as T
}

export class MemorySqlStore implements SqlStore {
  private readonly db: DatabaseSync
  private depth = 0

  constructor() {
    this.db = new DatabaseSync(':memory:')
    this.db.exec('PRAGMA foreign_keys = ON')
  }

  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursor<T> {
    const statement = this.db.prepare(query)
    const returnsRows = /^\s*(select|with|pragma)/i.test(query) || /\breturning\b/i.test(query)
    if (returnsRows) {
      const rows = statement.all(...(bindings as never[])).map(row => normalize<T>(row))
      return this.cursor(rows)
    }
    statement.run(...(bindings as never[]))
    return this.cursor<T>([])
  }

  private cursor<T extends Record<string, SqlValue>>(rows: T[]): SqlCursor<T> {
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

  transaction<T>(closure: () => T): T {
    if (this.depth > 0) return closure()
    this.depth += 1
    this.db.exec('BEGIN')
    try {
      const result = closure()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    } finally {
      this.depth -= 1
    }
  }

  close(): void {
    this.db.close()
  }
}
