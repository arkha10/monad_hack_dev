export type SqlValue = string | number | boolean | null

export interface SqlCursor<T extends Record<string, SqlValue>> {
  toArray(): T[]
  one(): T
  next(): IteratorResult<T, undefined>
}

export interface SqlStore {
  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursor<T>
  transaction<T>(closure: () => T): T
}

function cursor<T extends Record<string, SqlValue>>(rows: T[]): SqlCursor<T> {
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

function asRow<T extends Record<string, SqlValue>>(row: Record<string, SqlStorageValue>): T {
  const copy: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof ArrayBuffer) throw new Error(`Kolom ${key} tidak boleh berupa blob`)
    copy[key] = value
  }
  return copy as T
}

/**
 * Cloudflare names the synchronous SQLite transaction `transactionSync`, and its rows may
 * contain ArrayBuffer. Both differ from the in-memory store used by tests, so every Durable
 * Object must adapt through this function instead of casting `state.storage.sql` directly.
 */
export function durableObjectSql(state: DurableObjectState): SqlStore {
  return {
    exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => {
      const rows = state.storage.sql.exec<Record<string, SqlStorageValue>>(query, ...bindings).toArray()
      return cursor(rows.map(row => asRow<T>(row)))
    },
    transaction: closure => state.storage.transactionSync(closure),
  }
}

export function migrate(sql: SqlStore, statements: string): void {
  sql.exec(statements)
}

export function all<T extends Record<string, SqlValue>>(sql: SqlStore, query: string, ...bindings: SqlValue[]): T[] {
  return sql.exec<T>(query, ...bindings).toArray()
}

export function one<T extends Record<string, SqlValue>>(sql: SqlStore, query: string, ...bindings: SqlValue[]): T | null {
  const rows = sql.exec<T>(query, ...bindings).toArray()
  return rows.length > 0 ? rows[0] : null
}

export function run(sql: SqlStore, query: string, ...bindings: SqlValue[]): void {
  sql.exec(query, ...bindings)
}
