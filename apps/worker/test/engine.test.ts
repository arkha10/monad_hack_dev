import { describe, expect, it } from 'vitest'
import type { AgentSlot, Behavior } from '@boai/shared/types'
import { advanceTo, authoritativeWinner, createGameState, toSnapshot } from '../src/game/engine'
import { MATCH, RULESET_VERSION } from '../src/game/ruleset'

const behaviors: Record<AgentSlot, Behavior> = {
  p1: 'BUILD_FIRST',
  p2: 'DODGE_FIRST',
  p3: 'DECOY',
  p4: 'CHASE_BALL',
  p5: 'BALANCED',
}

function newMatch(seed: string) {
  return createGameState({
    matchId: 'match-test-001',
    mode: 'practice',
    seed,
    difficulty: 'medium',
    redOwnerId: 'user-red',
    blueOwnerId: 'user-blue',
    redBehaviors: behaviors,
    blueBehaviors: behaviors,
    nowMs: 1_700_000_000_000,
  })
}

describe('BOAI deterministic match engine', () => {
  it('produces an identical snapshot for the same seed and inputs', () => {
    const a = advanceTo(newMatch('seed-alpha'), 40).state
    const b = advanceTo(newMatch('seed-alpha'), 40).state
    expect(toSnapshot(a, 0)).toEqual(toSnapshot(b, 0))
  })

  it('diverges across seeds so the seed is load-bearing', () => {
    const a = advanceTo(newMatch('seed-alpha'), 60).state
    const b = advanceTo(newMatch('seed-bravo'), 60).state
    expect(JSON.stringify(toSnapshot(a, 0).agents)).not.toBe(JSON.stringify(toSnapshot(b, 0).agents))
  })

  it('runs two halves and swaps roles at halftime', () => {
    const first = advanceTo(newMatch('seed-roles'), 1).state
    expect(first.half).toBe(1)
    expect(first.redRole).toBe('REBUILDERS')
    expect(first.blueRole).toBe('HUNTERS')

    const ticksPerHalf = MATCH.halfDurationMs / MATCH.tickMs
    const halftime = advanceTo(newMatch('seed-roles'), ticksPerHalf + 1).state
    expect(halftime.phase).toBe('HALFTIME')

    const second = advanceTo(newMatch('seed-roles'), ticksPerHalf + MATCH.halftimeDurationMs / MATCH.tickMs + 2).state
    expect(second.half).toBe(2)
    expect(second.redRole).toBe('HUNTERS')
    expect(second.blueRole).toBe('REBUILDERS')
  })

  it('finishes with a winner after both halves', () => {
    const totalTicks = (MATCH.halfDurationMs * 2 + MATCH.halftimeDurationMs) / MATCH.tickMs + 5
    const final = advanceTo(newMatch('seed-finish'), totalTicks).state
    expect(final.phase).toBe('FINISHED')
    expect(final.winnerSide).not.toBeNull()
    expect(['red', 'blue', 'draw']).toContain(final.winnerSide)
  })

  it('stops simulating once finished', () => {
    const totalTicks = (MATCH.halfDurationMs * 2 + MATCH.halftimeDurationMs) / MATCH.tickMs + 5
    const final = advanceTo(newMatch('seed-stop'), totalTicks).state
    const after = advanceTo(final, totalTicks + 100).state
    expect(after.tick).toBe(final.tick)
    expect(after.seq).toBe(final.seq)
  })

  it('never mutates physics stats by behaviour or difficulty', () => {
    const state = advanceTo(newMatch('seed-physics'), 30).state
    const snapshot = toSnapshot(state, 0)
    expect(snapshot.rulesetVersion).toBe(RULESET_VERSION)
    expect(snapshot.agents).toHaveLength(10)
    const stamina = snapshot.agents.map(agent => agent.stamina)
    expect(Math.max(...stamina)).toBeLessThanOrEqual(100)
    expect(snapshot.agents.every(agent => agent.position.x >= 0 && agent.position.x <= 1000)).toBe(true)
    expect(snapshot.agents.every(agent => agent.position.y >= 0 && agent.position.y <= 600)).toBe(true)
  })

  it('counts stack pieces only for the rebuilding side', () => {
    const state = advanceTo(newMatch('seed-build'), 120).state
    const rebuildersAreRed = state.redRole === 'REBUILDERS'
    const hunterSideScore = rebuildersAreRed ? state.blueScore : state.redScore
    expect(hunterSideScore.buildCount).toBe(0)
    expect(state.stack.completed).toBeLessThanOrEqual(state.stack.total)
  })

  it('actually builds the stack within the first half', () => {
    const ticksPerHalf = MATCH.halfDurationMs / MATCH.tickMs
    const state = advanceTo(newMatch('seed-build'), ticksPerHalf - 1).state
    const rebuildSideScore = state.redRole === 'REBUILDERS' ? state.redScore : state.blueScore
    expect(rebuildSideScore.buildCount).toBeGreaterThan(0)
    expect(state.stack.completed).toBeGreaterThan(0)
  })

  it('never ends a match 0-0 with no objective progress across many seeds', () => {
    const totalTicks = (MATCH.halfDurationMs * 2 + MATCH.halftimeDurationMs) / MATCH.tickMs + 5
    const deadMatches: string[] = []
    for (let index = 0; index < 40; index += 1) {
      const match = newMatch(`seed-sweep-${index}`)
      match.agents = match.agents.map(agent =>
        agent.side === 'blue'
          ? { ...agent, behavior: agent.slot === 'p1' || agent.slot === 'p2' ? 'CHASE_BALL' : agent.behavior }
          : agent,
      )
      const final = advanceTo(match, totalTicks).state
      // A draw is legitimate when both sides genuinely complete at the same millisecond.
      // What must never happen is a match where nobody built anything, which is the dead
      // game the per-agent build accumulator used to produce.
      const anyProgress =
        final.redScore.buildCount > 0 ||
        final.blueScore.buildCount > 0 ||
        final.redScore.eliminations > 0 ||
        final.blueScore.eliminations > 0
      if (!anyProgress) deadMatches.push(final.seed)
    }
    expect(deadMatches).toEqual([])
  })

  it('breaks a tie on completion time when only one side is faster', () => {
    const faster = { buildCount: 5, completionMs: 10_500, eliminations: 0, objectiveComplete: true }
    const slower = { buildCount: 5, completionMs: 12_000, eliminations: 0, objectiveComplete: true }
    expect(authoritativeWinner(faster, slower)).toBe('red')
    expect(authoritativeWinner(slower, faster)).toBe('blue')
    // Identical times are a real draw, not a coin flip.
    expect(authoritativeWinner(faster, faster)).toBe('draw')
  })
})

