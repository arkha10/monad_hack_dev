import { JsSqlStore } from './jsSql'

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

const stores = new WeakMap<DurableObjectState, JsSqlStore>()
const failedOverStates = new WeakSet<DurableObjectState>()

export function getJsSqlStore(state: DurableObjectState): JsSqlStore {
  let store = stores.get(state)
  if (!store) {
    store = new JsSqlStore()
    stores.set(state, store)
  }
  return store
}

export async function loadStorage(state: DurableObjectState): Promise<void> {
  if (typeof state?.storage?.get !== 'function') return
  try {
    const saved = await state.storage.get<{ rowIdCounter: number; tables: Record<string, Array<Record<string, SqlValue>>> }>('boai_sql_tables')
    if (saved) {
      failedOverStates.add(state)
      const store = getJsSqlStore(state)
      store.deserialize(saved)
    }
  } catch {
    // KV storage read fallback
  }
}

export async function persistStorage(state: DurableObjectState): Promise<void> {
  if (typeof state?.storage?.put !== 'function') return
  if (!failedOverStates.has(state)) return
  const store = getJsSqlStore(state)
  if (store.isDirty()) {
    try {
      await state.storage.put('boai_sql_tables', store.serialize())
      store.markClean()
    } catch {
      // KV storage write fallback
    }
  }
}

/**
 * Adapts Cloudflare Durable Object SQLite with synchronous transaction conversion.
 * If Cloudflare's free-tier row read limit is exceeded, automatically fails over
 * to an in-memory JS SQL store so the Durable Object continues running seamlessly.
 */
export function durableObjectSql(state: DurableObjectState): SqlStore {
  return {
    exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => {
      if (failedOverStates.has(state)) {
        return getJsSqlStore(state).exec<T>(query, ...bindings)
      }
      try {
        const rows = state.storage.sql.exec<Record<string, SqlStorageValue>>(query, ...bindings).toArray()
        return cursor(rows.map(row => asRow<T>(row)))
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Exceeded allowed rows read')) {
          failedOverStates.add(state)
          return getJsSqlStore(state).exec<T>(query, ...bindings)
        }
        throw err
      }
    },
    transaction: closure => {
      if (failedOverStates.has(state)) {
        return getJsSqlStore(state).transaction(closure)
      }
      try {
        return state.storage.transactionSync(closure)
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Exceeded allowed rows read')) {
          failedOverStates.add(state)
          return getJsSqlStore(state).transaction(closure)
        }
        throw err
      }
    },
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
