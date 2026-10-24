import type { SqlCursor, SqlStore, SqlValue } from './sql'

interface TableSchema {
  name: string
  primaryKeys: string[]
  uniqueKeys: string[][]
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

function splitTableDefinitions(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim().length > 0) parts.push(current.trim())
  return parts
}

export class JsSqlStore implements SqlStore {
  private tables = new Map<string, Array<Record<string, SqlValue>>>()
  private schemas = new Map<string, TableSchema>()
  private rowIdCounter = 0
  private depth = 0
  private snapshots: Array<Map<string, string>> = []
  private dirty = false

  serialize(): { rowIdCounter: number; tables: Record<string, Array<Record<string, SqlValue>>> } {
    return {
      rowIdCounter: this.rowIdCounter,
      tables: Object.fromEntries(this.tables.entries()),
    }
  }

  deserialize(data: { rowIdCounter?: number; tables?: Record<string, Array<Record<string, SqlValue>>> }): void {
    if (typeof data.rowIdCounter === 'number') this.rowIdCounter = data.rowIdCounter
    if (data.tables) {
      this.tables.clear()
      for (const [k, v] of Object.entries(data.tables)) {
        this.tables.set(k.toLowerCase(), v)
      }
    }
    this.dirty = false
  }

  isDirty(): boolean {
    return this.dirty
  }

  markClean(): void {
    this.dirty = false
  }

  private getTable(name: string): Array<Record<string, SqlValue>> {
    const key = name.toLowerCase()
    let table = this.tables.get(key)
    if (!table) {
      table = []
      this.tables.set(key, table)
    }
    return table
  }

  private parseSchema(query: string): void {
    const match = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+)\)/i.exec(query)
    if (!match) return
    const name = match[1].toLowerCase()
    const body = match[2]
    const pks: string[] = []
    const uks: string[][] = []

    const lines = splitTableDefinitions(body)
    for (const line of lines) {
      const pkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(line)
      if (pkMatch) {
        pks.push(...pkMatch[1].split(',').map(s => s.trim().toLowerCase()))
        continue
      }
      const ukMatch = /UNIQUE\s*\(([^)]+)\)/i.exec(line)
      if (ukMatch) {
        uks.push(ukMatch[1].split(',').map(s => s.trim().toLowerCase()))
        continue
      }
      const colPkMatch = /^([a-zA-Z0-9_]+)\s+[^,]*\bPRIMARY\s+KEY\b/i.exec(line)
      if (colPkMatch) {
        pks.push(colPkMatch[1].toLowerCase())
      }
      const colUkMatch = /^([a-zA-Z0-9_]+)\s+[^,]*\bUNIQUE\b/i.exec(line)
      if (colUkMatch) {
        uks.push([colUkMatch[1].toLowerCase()])
      }
    }

    if (!this.schemas.has(name)) {
      this.schemas.set(name, { name, primaryKeys: pks, uniqueKeys: uks })
      this.getTable(name)
    }
  }

  transaction<T>(closure: () => T): T {
    const snapshot = new Map<string, string>()
    for (const [k, v] of this.tables.entries()) {
      snapshot.set(k, JSON.stringify(v))
    }
    this.snapshots.push(snapshot)
    this.depth += 1

    try {
      const result = closure()
      this.snapshots.pop()
      return result
    } catch (error) {
      const prev = this.snapshots.pop()
      if (prev) {
        this.tables.clear()
        for (const [k, v] of prev.entries()) {
          this.tables.set(k, JSON.parse(v) as Array<Record<string, SqlValue>>)
        }
      }
      throw error
    } finally {
      this.depth -= 1
    }
  }

  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursor<T> {
    const trimmed = query.trim()

    if (/^CREATE\s+TABLE/i.test(trimmed)) {
      this.parseSchema(trimmed)
      return cursor<T>([])
    }

    if (/^CREATE\s+INDEX/i.test(trimmed) || /^PRAGMA/i.test(trimmed)) {
      return cursor<T>([])
    }

    if (/^INSERT\s+OR\s+REPLACE/i.test(trimmed)) {
      return this.handleInsertOrReplace<T>(trimmed, bindings)
    }

    if (/^INSERT\s+OR\s+IGNORE/i.test(trimmed)) {
      return this.handleInsert<T>(trimmed, bindings, true)
    }

    if (/^INSERT\s+INTO/i.test(trimmed)) {
      return this.handleInsert<T>(trimmed, bindings, false)
    }

    if (/^UPDATE\s+/i.test(trimmed)) {
      return this.handleUpdate<T>(trimmed, bindings)
    }

    if (/^SELECT\s+/i.test(trimmed)) {
      return this.handleSelect<T>(trimmed, bindings)
    }

    if (/^DELETE\s+FROM/i.test(trimmed)) {
      return this.handleDelete<T>(trimmed, bindings)
    }

    return cursor<T>([])
  }

  private handleInsert<T extends Record<string, SqlValue>>(
    query: string,
    bindings: SqlValue[],
    isOrIgnore: boolean,
  ): SqlCursor<T> {
    const match = /^INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)([\s\S]*)$/i.exec(query)
    if (!match) throw new Error(`Could not parse INSERT query: ${query}`)

    const tableName = match[1].toLowerCase()
    const columns = match[2].split(',').map(s => s.trim().toLowerCase())
    const valuesPart = match[3]
    const conflictPart = match[4]?.trim() ?? ''

    const row: Record<string, SqlValue> = { _rowid_: ++this.rowIdCounter }
    let bIdx = 0
    const valPlaceholders = valuesPart.split(',').map(s => s.trim())
    for (let i = 0; i < columns.length; i++) {
      const ph = valPlaceholders[i]
      if (ph === '?') {
        row[columns[i]] = bindings[bIdx++] ?? null
      } else if (ph.startsWith("'") && ph.endsWith("'")) {
        row[columns[i]] = ph.slice(1, -1)
      } else if (!isNaN(Number(ph))) {
        row[columns[i]] = Number(ph)
      } else if (/^null$/i.test(ph)) {
        row[columns[i]] = null
      } else {
        row[columns[i]] = ph
      }
    }

    const table = this.getTable(tableName)
    const schema = this.schemas.get(tableName)

    let conflictCol = ''
    let isTargetConflict = false
    const onConflictTargetMatch = /ON\s+CONFLICT\s*\(([^)]+)\)/i.exec(conflictPart)
    const targetCols = onConflictTargetMatch
      ? onConflictTargetMatch[1].split(',').map(s => s.trim().toLowerCase())
      : null

    const findConflictingRow = (): { index: number; existing: Record<string, SqlValue> } | null => {
      if (!schema) return null
      for (let i = 0; i < table.length; i++) {
        const existing = table[i]
        if (schema.primaryKeys.length > 0) {
          const matchPk = schema.primaryKeys.every(k => existing[k] === row[k])
          if (matchPk) {
            conflictCol = schema.primaryKeys.map(k => `${tableName}.${k}`).join(', ')
            if (targetCols && targetCols.length === schema.primaryKeys.length && targetCols.every(k => schema.primaryKeys.includes(k))) {
              isTargetConflict = true
            }
            return { index: i, existing }
          }
        }
        for (const uks of schema.uniqueKeys) {
          const matchUk = uks.every(k => existing[k] === row[k])
          if (matchUk) {
            conflictCol = uks.map(k => `${tableName}.${k}`).join(', ')
            if (targetCols && targetCols.length === uks.length && targetCols.every(k => uks.includes(k))) {
              isTargetConflict = true
            }
            return { index: i, existing }
          }
        }
      }
      return null
    }

    const conflict = findConflictingRow()

    if (isOrIgnore) {
      if (!conflict) {
        table.push(row)
        this.dirty = true
      }
      return cursor<T>([])
    }

    if (conflictPart) {
      if (conflict && targetCols && !isTargetConflict) {
        throw new Error(`UNIQUE constraint failed: ${conflictCol}`)
      }

      if (/DO\s+NOTHING/i.test(conflictPart)) {
        if (!conflict) {
          table.push(row)
          this.dirty = true
        }
        return cursor<T>([])
      }

      const updateMatch = /DO\s+UPDATE\s+SET\s+([\s\S]+)$/i.exec(conflictPart)
      if (updateMatch && conflict) {
        this.dirty = true
        const assignments = updateMatch[1].split(',').map(s => s.trim())
        for (const assign of assignments) {
          const eqIdx = assign.indexOf('=')
          if (eqIdx === -1) continue
          const colName = assign.slice(0, eqIdx).trim().toLowerCase()
          const expr = assign.slice(eqIdx + 1).trim()

          if (/^excluded\.([a-zA-Z0-9_]+)$/i.test(expr)) {
            const exCol = expr.slice(9).toLowerCase()
            conflict.existing[colName] = row[exCol] ?? null
          } else if (/^([a-zA-Z0-9_.]+)\s*\+\s*excluded\.([a-zA-Z0-9_]+)$/i.test(expr)) {
            const m = /^([a-zA-Z0-9_.]+)\s*\+\s*excluded\.([a-zA-Z0-9_]+)$/i.exec(expr)!
            const baseCol = m[1].includes('.') ? m[1].split('.')[1].toLowerCase() : m[1].toLowerCase()
            const exCol = m[2].toLowerCase()
            conflict.existing[colName] = (Number(conflict.existing[baseCol]) || 0) + (Number(row[exCol]) || 0)
          } else if (/^([a-zA-Z0-9_.]+)\s*\+\s*(\d+)$/i.test(expr)) {
            const m = /^([a-zA-Z0-9_.]+)\s*\+\s*(\d+)$/i.exec(expr)!
            const baseCol = m[1].includes('.') ? m[1].split('.')[1].toLowerCase() : m[1].toLowerCase()
            conflict.existing[colName] = (Number(conflict.existing[baseCol]) || 0) + Number(m[2])
          } else if (expr === '?') {
            conflict.existing[colName] = bindings[bIdx++] ?? null
          } else if (!isNaN(Number(expr))) {
            conflict.existing[colName] = Number(expr)
          } else {
            conflict.existing[colName] = expr
          }
        }
        return cursor<T>([])
      }
    }

    if (conflict) {
      throw new Error(`UNIQUE constraint failed: ${conflictCol}`)
    }

    table.push(row)
    this.dirty = true
    return cursor<T>([])
  }

  private handleInsertOrReplace<T extends Record<string, SqlValue>>(query: string, bindings: SqlValue[]): SqlCursor<T> {
    const match = /^INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i.exec(query)
    if (!match) throw new Error(`Could not parse INSERT OR REPLACE: ${query}`)

    const tableName = match[1].toLowerCase()
    const columns = match[2].split(',').map(s => s.trim().toLowerCase())
    const row: Record<string, SqlValue> = { _rowid_: ++this.rowIdCounter }
    let bIdx = 0
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = bindings[bIdx++] ?? null
    }

    const table = this.getTable(tableName)
    const schema = this.schemas.get(tableName)

    let existingIdx = -1
    if (schema) {
      for (let i = 0; i < table.length; i++) {
        const item = table[i]
        if (schema.primaryKeys.length > 0 && schema.primaryKeys.every(k => item[k] === row[k])) {
          existingIdx = i
          break
        }
      }
    }

    if (existingIdx >= 0) {
      table[existingIdx] = { ...table[existingIdx], ...row }
    } else {
      table.push(row)
    }
    this.dirty = true

    return cursor<T>([])
  }

  private handleUpdate<T extends Record<string, SqlValue>>(query: string, bindings: SqlValue[]): SqlCursor<T> {
    const returningMatch = /\s+RETURNING\s+([a-zA-Z0-9_, ]+)$/i.exec(query)
    const withoutReturning = returningMatch ? query.slice(0, returningMatch.index) : query

    const match = /^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i.exec(withoutReturning)
    if (!match) throw new Error(`Could not parse UPDATE: ${query}`)

    const tableName = match[1].toLowerCase()
    const setClause = match[2]
    const whereClause = match[3]

    let bIdx = 0
    const assignments: Array<{ col: string; value: SqlValue }> = []
    for (const part of setClause.split(',').map(s => s.trim())) {
      const [col, expr] = part.split('=').map(s => s.trim())
      const colName = col.toLowerCase()
      if (expr === '?') {
        const val = bindings[bIdx++] ?? null
        assignments.push({ col: colName, value: val })
      } else if (!isNaN(Number(expr))) {
        assignments.push({ col: colName, value: Number(expr) })
      } else if (expr.startsWith("'") && expr.endsWith("'")) {
        assignments.push({ col: colName, value: expr.slice(1, -1) })
      } else {
        assignments.push({ col: colName, value: expr })
      }
    }

    const table = this.getTable(tableName)
    const returningRows: T[] = []

    for (const row of table) {
      if (whereClause && !this.evalWhere(row, whereClause, bindings, bIdx)) {
        continue
      }
      for (const a of assignments) {
        row[a.col] = a.value
      }
      this.dirty = true
      if (returningMatch) {
        const retCols = returningMatch[1].split(',').map(s => s.trim().toLowerCase())
        const retRow: Record<string, SqlValue> = {}
        for (const c of retCols) retRow[c] = row[c] ?? null
        returningRows.push(retRow as T)
      }
    }

    return cursor<T>(returningRows)
  }

  private handleDelete<T extends Record<string, SqlValue>>(query: string, bindings: SqlValue[]): SqlCursor<T> {
    const match = /^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?$/i.exec(query)
    if (!match) throw new Error(`Could not parse DELETE: ${query}`)

    const tableName = match[1].toLowerCase()
    const whereClause = match[2]
    const table = this.getTable(tableName)

    if (!whereClause) {
      table.length = 0
      this.dirty = true
      return cursor<T>([])
    }

    const filtered = table.filter(row => !this.evalWhere(row, whereClause, bindings, 0))
    this.tables.set(tableName, filtered)
    this.dirty = true
    return cursor<T>([])
  }

  private handleSelect<T extends Record<string, SqlValue>>(query: string, bindings: SqlValue[]): SqlCursor<T> {
    const limitMatch = /\s+LIMIT\s+(\?|\d+)$/i.exec(query)
    let limitVal: number | null = null
    let working = query
    if (limitMatch) {
      if (limitMatch[1] === '?') {
        limitVal = Number(bindings[bindings.length - 1])
      } else {
        limitVal = Number(limitMatch[1])
      }
      working = query.slice(0, limitMatch.index)
    }

    const orderMatch = /\s+ORDER\s+BY\s+([a-zA-Z0-9_, ]+)$/i.exec(working)
    let orderClause = ''
    if (orderMatch) {
      orderClause = orderMatch[1].trim()
      working = working.slice(0, orderMatch.index)
    }

    const fromMatch = /^SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?$/i.exec(working)
    if (!fromMatch) throw new Error(`Could not parse SELECT: ${query}`)

    const selectCols = fromMatch[1].trim()
    const tableName = fromMatch[2].toLowerCase()
    const whereClause = fromMatch[3]?.trim()

    const table = this.getTable(tableName)
    let filtered = table.filter(row => !whereClause || this.evalWhere(row, whereClause, bindings, 0))

    if (/COUNT\(\*\)/i.test(selectCols)) {
      const aliasMatch = /COUNT\(\*\)\s+AS\s+([a-zA-Z0-9_]+)/i.exec(selectCols)
      const alias = aliasMatch ? aliasMatch[1] : 'count'
      return cursor<T>([{ [alias]: filtered.length } as unknown as T])
    }

    if (orderClause) {
      const orderDirectives = orderClause.split(',').map(s => {
        const parts = s.trim().split(/\s+/)
        const col = parts[0].toLowerCase()
        const dir = (parts[1] ?? 'ASC').toUpperCase()
        return { col, asc: dir === 'ASC' }
      })

      filtered = filtered.slice().sort((a, b) => {
        for (const { col, asc } of orderDirectives) {
          const valA = col === 'rowid' ? (a._rowid_ ?? 0) : (a[col] ?? '')
          const valB = col === 'rowid' ? (b._rowid_ ?? 0) : (b[col] ?? '')
          if (valA < valB) return asc ? -1 : 1
          if (valA > valB) return asc ? 1 : -1
        }
        return 0
      })
    }

    if (limitVal !== null && limitVal >= 0) {
      filtered = filtered.slice(0, limitVal)
    }

    if (selectCols === '*') {
      return cursor(filtered.map(row => {
        const copy = { ...row }
        delete copy._rowid_
        return copy as T
      }))
    }

    const colList = selectCols.split(',').map(s => s.trim().toLowerCase())
    return cursor(filtered.map(row => {
      const out: Record<string, SqlValue> = {}
      for (const col of colList) {
        out[col] = row[col] ?? null
      }
      return out as T
    }))
  }

  private evalWhere(
    row: Record<string, SqlValue>,
    whereClause: string,
    bindings: SqlValue[],
    bindingOffset: number,
  ): boolean {
    let bIdx = bindingOffset

    if (whereClause.includes('(status = \'waiting\' OR (status = \'matched\' AND handed_off = 0))')) {
      const userIdVal = bindings[bIdx]
      if (row.user_id !== userIdVal) return false
      const isWaiting = row.status === 'waiting'
      const isMatchedPending = row.status === 'matched' && Number(row.handed_off) === 0
      return isWaiting || isMatchedPending
    }

    const conditions = whereClause.split(/\s+AND\s+/i)

    for (const cond of conditions) {
      const trimmed = cond.trim()

      if (/^lower\(([a-zA-Z0-9_]+)\)\s*=\s*lower\(\?\)$/i.test(trimmed)) {
        const col = /^lower\(([a-zA-Z0-9_]+)\)/i.exec(trimmed)![1].toLowerCase()
        const val = bindings[bIdx++]
        const cell = row[col]
        if (String(cell).toLowerCase() !== String(val).toLowerCase()) return false
        continue
      }

      const inMatch = /^([a-zA-Z0-9_]+)\s+IN\s*\(([^)]+)\)$/i.exec(trimmed)
      if (inMatch) {
        const col = inMatch[1].toLowerCase()
        const placeholders = inMatch[2].split(',').map(s => s.trim())
        const allowed: SqlValue[] = []
        for (const p of placeholders) {
          if (p === '?') allowed.push(bindings[bIdx++])
          else allowed.push(p.replace(/^'|'$/g, ''))
        }
        if (!allowed.includes(row[col])) return false
        continue
      }

      const isNullMatch = /^([a-zA-Z0-9_]+)\s+IS\s+NULL$/i.exec(trimmed)
      if (isNullMatch) {
        if (row[isNullMatch[1].toLowerCase()] !== null && row[isNullMatch[1].toLowerCase()] !== undefined) return false
        continue
      }

      const isNotNullMatch = /^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL$/i.exec(trimmed)
      if (isNotNullMatch) {
        if (row[isNotNullMatch[1].toLowerCase()] === null || row[isNotNullMatch[1].toLowerCase()] === undefined) return false
        continue
      }

      const cmpMatch = /^([a-zA-Z0-9_]+)\s*(=|<>|!=|>=|<=|>|<)\s*(.+)$/i.exec(trimmed)
      if (cmpMatch) {
        const col = cmpMatch[1].toLowerCase()
        const op = cmpMatch[2]
        const rhs = cmpMatch[3].trim()

        let rhsVal: SqlValue
        if (rhs === '?') {
          rhsVal = bindings[bIdx++]
        } else if (rhs.startsWith("'") && rhs.endsWith("'")) {
          rhsVal = rhs.slice(1, -1)
        } else if (!isNaN(Number(rhs))) {
          rhsVal = Number(rhs)
        } else {
          rhsVal = rhs
        }

        const cell = row[col]

        if (op === '=') {
          if (cell != rhsVal) return false
        } else if (op === '<>' || op === '!=') {
          if (cell == rhsVal) return false
        } else if (op === '>') {
          if (Number(cell) <= Number(rhsVal)) return false
        } else if (op === '>=') {
          if (Number(cell) < Number(rhsVal)) return false
        } else if (op === '<') {
          if (Number(cell) >= Number(rhsVal)) return false
        } else if (op === '<=') {
          if (Number(cell) > Number(rhsVal)) return false
        }
        continue
      }
    }

    return true
  }
}
