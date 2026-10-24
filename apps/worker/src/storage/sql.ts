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
