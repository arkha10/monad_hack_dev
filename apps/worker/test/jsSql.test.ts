import { describe, expect, it } from 'vitest'
import { JsSqlStore } from '../src/storage/jsSql'
import { all, one, run } from '../src/storage/sql'

describe('JsSqlStore', () => {
  it('creates tables, inserts, queries, and updates', () => {
    const sql = new JsSqlStore()
    run(sql, 'CREATE TABLE IF NOT EXISTS test (id TEXT PRIMARY KEY, count INTEGER)')
    run(sql, 'INSERT INTO test (id, count) VALUES (?, ?)', 'item1', 10)
    
    const row = one<{ id: string; count: number }>(sql, 'SELECT id, count FROM test WHERE id = ?', 'item1')
    expect(row).toEqual({ id: 'item1', count: 10 })

    run(sql, 'UPDATE test SET count = ? WHERE id = ?', 20, 'item1')
    const updated = one<{ count: number }>(sql, 'SELECT count FROM test WHERE id = ?', 'item1')
    expect(updated?.count).toBe(20)
  })

  it('handles events query', () => {
    const sql = new JsSqlStore()
    run(sql, 'CREATE TABLE match_event (match_id TEXT, seq INTEGER, tick INTEGER, type TEXT, payload_json TEXT, PRIMARY KEY(match_id, seq))')
    run(sql, 'INSERT INTO match_event (match_id, seq, tick, type, payload_json) VALUES (?, ?, ?, ?, ?)', 'm1', 0, 0, 'START', '{}')
    run(sql, 'INSERT INTO match_event (match_id, seq, tick, type, payload_json) VALUES (?, ?, ?, ?, ?)', 'm1', 1, 10, 'TICK', '{}')

    const rows = all(sql, 'SELECT * FROM match_event WHERE match_id = ? AND seq >= ? ORDER BY seq ASC', 'm1', 0)
    expect(rows).toHaveLength(2)
  })
})
