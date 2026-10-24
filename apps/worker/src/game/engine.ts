import type {
  AgentAction,
  AgentSlot,
  AgentState,
  BallState,
  Behavior,
  CoachCommand,
  Difficulty,
  MatchEvent,
  MatchMode,
  MatchPhase,
  MatchResult,
  MatchSnapshot,
  Side,
  SideRole,
  SideScore,
  StackState,
} from '@boai/shared/types'
import { calculateWinner } from '@boai/shared/helpers'
import { createRng, type Rng } from './prng'
import {
  AGENT_PHYSICS,
  ARENA,
  MATCH,
  ROLE_FOR_HALF,
  RULESET_VERSION,
  SCORING,
  SIDE_SPAWN,
  SLOT_OFFSETS,
  STACK_CENTER,
} from './ruleset'

export interface EngineAgent extends AgentState {
  stamina: number
  targetX: number
  targetY: number
  buildProgressMs: number
  dodgeUntilTick: number
  dodgeDirX: number
  dodgeDirY: number
}

export interface GameState {
  matchId: string
  mode: MatchMode
  seed: string
  difficulty: Difficulty
  redOwnerId: string
  blueOwnerId: string | null
  half: 1 | 2
  phase: MatchPhase
  tick: number
  seq: number
  halfElapsedMs: number
  phaseElapsedMs: number
  redRole: SideRole
  blueRole: SideRole
  agents: EngineAgent[]
  ball: BallState & { inFlight: boolean; thrower: `${Side}:${AgentSlot}` | null }
  stack: StackState
  redScore: SideScore
  blueScore: SideScore
  winnerSide: Side | 'draw' | null
  coachCommand: CoachCommand | null
  coachSide: Side | null
  coachExpiresTick: number
  startedAtMs: number
  finishedAtMs: number | null
  result: MatchResult | null
}

export interface TickOutput {
  state: GameState
  events: MatchEvent[]
}

const SLOTS: AgentSlot[] = ['p1', 'p2', 'p3', 'p4', 'p5']

function emptyScore(): SideScore {
  return { buildCount: 0, completionMs: null, eliminations: 0, objectiveComplete: false }
}

function slotKey(side: Side, slot: AgentSlot): `${Side}:${AgentSlot}` {
  return `${side}:${slot}`
}

function clampToArena(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(ARENA.width - AGENT_PHYSICS.radius, Math.max(AGENT_PHYSICS.radius, x)),
    y: Math.min(ARENA.height - AGENT_PHYSICS.radius, Math.max(AGENT_PHYSICS.radius, y)),
  }
}

function buildSide(side: Side, behaviors: Record<AgentSlot, Behavior>, role: SideRole): EngineAgent[] {
  const spawn = SIDE_SPAWN[side]
  return SLOTS.map(slot => {
    const offset = SLOT_OFFSETS[slot]
    const position = clampToArena(spawn.x + offset.x, spawn.y + offset.y)
    return {
      slot,
      side,
      position,
      stamina: AGENT_PHYSICS.maxStamina,
      active: true,
      behavior: behaviors[slot],
      currentAction: 'WAIT' as AgentAction,
      targetX: position.x,
      targetY: position.y,
      buildProgressMs: 0,
      dodgeUntilTick: 0,
      dodgeDirX: 0,
      dodgeDirY: 0,
    } satisfies EngineAgent
  }).map(agent => ({ ...agent, currentAction: (role === 'REBUILDERS' ? 'MOVE_TO' : 'PICKUP_BALL') as AgentAction }))
}

export interface CreateMatchInput {
  matchId: string
  mode: MatchMode
  seed: string
  difficulty: Difficulty
  redOwnerId: string
  blueOwnerId: string | null
  redBehaviors: Record<AgentSlot, Behavior>
  blueBehaviors: Record<AgentSlot, Behavior>
  nowMs: number
}

export function createGameState(input: CreateMatchInput): GameState {
  const roles = ROLE_FOR_HALF[1]
  return {
    matchId: input.matchId,
    mode: input.mode,
    seed: input.seed,
    difficulty: input.difficulty,
    redOwnerId: input.redOwnerId,
    blueOwnerId: input.blueOwnerId,
    half: 1,
    phase: 'KNOCKDOWN',
    tick: 0,
    seq: 0,
    halfElapsedMs: 0,
    phaseElapsedMs: 0,
    redRole: roles.red,
    blueRole: roles.blue,
    agents: [
      ...buildSide('red', input.redBehaviors, roles.red),
      ...buildSide('blue', input.blueBehaviors, roles.blue),
    ],
    ball: { position: { x: 350, y: 300 }, velocity: { x: 0, y: 0 }, holder: null, inFlight: false, thrower: null },
    stack: { position: { ...STACK_CENTER }, completed: 0, total: MATCH.stackPieces, knockedDown: true },
    redScore: emptyScore(),
    blueScore: emptyScore(),
    winnerSide: null,
    coachCommand: null,
    coachSide: null,
    coachExpiresTick: 0,
    startedAtMs: input.nowMs,
    finishedAtMs: null,
    result: null,
  }
}

function emit(
  state: GameState,
  events: MatchEvent[],
  kind: string,
  actor: `${Side}:${AgentSlot}` | null,
  payload: Record<string, string | number | boolean | null> = {},
): void {
  state.seq += 1
  events.push({
    id: `${state.matchId}:${state.seq}`,
    matchId: state.matchId,
    seq: state.seq,
    atMs: state.halfElapsedMs + (state.half === 2 ? MATCH.halfDurationMs : 0),
    kind,
    actor,
    payload,
  })
}

function scoreFor(state: GameState, side: Side): SideScore {
  return side === 'red' ? state.redScore : state.blueScore
}

function roleFor(state: GameState, side: Side): SideRole {
  return side === 'red' ? state.redRole : state.blueRole
}

function agentKey(agent: EngineAgent): `${Side}:${AgentSlot}` {
  return slotKey(agent.side, agent.slot)
}

function nearestOpponent(agent: EngineAgent, agents: EngineAgent[]): EngineAgent | null {
  let best: EngineAgent | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of agents) {
    if (candidate.side === agent.side || !candidate.active) continue
    const distance = Math.hypot(candidate.position.x - agent.position.x, candidate.position.y - agent.position.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

function behaviorTarget(agent: EngineAgent, state: GameState, rng: Rng): { x: number; y: number; action: AgentAction } {
  const role = roleFor(state, agent.side)
  const coachActive = state.coachSide === agent.side && state.tick < state.coachExpiresTick
  const coach = coachActive ? state.coachCommand : null
  const stack = state.stack
  const ballLoose = state.ball.holder === null

  if (role === 'REBUILDERS') {
    if (coach === 'DISTRACT') {
      const angle = rng.angleRadians()
      return { x: STACK_CENTER.x + Math.cos(angle) * 220, y: STACK_CENTER.y + Math.sin(angle) * 140, action: 'DISTRACT' }
    }
    if (coach === 'ATTACK' || coach === 'REBUILD') {
      const jitter = rng.range(-30, 30)
      return { x: STACK_CENTER.x + jitter, y: STACK_CENTER.y + jitter, action: 'MOVE_TO' }
    }
    switch (agent.behavior) {
      case 'DECOY': {
        const angle = rng.angleRadians()
        return { x: STACK_CENTER.x + Math.cos(angle) * 200, y: STACK_CENTER.y + Math.sin(angle) * 120, action: 'DISTRACT' }
      }
      case 'DODGE_FIRST':
        if (state.ball.inFlight) {
          return { x: agent.position.x + rng.range(-120, 120), y: agent.position.y + rng.range(-90, 90), action: 'DODGE' }
        }
        return { x: STACK_CENTER.x, y: STACK_CENTER.y, action: 'MOVE_TO' }
      case 'GUARD_STACK':
        return { x: STACK_CENTER.x - 40, y: STACK_CENTER.y, action: 'GUARD_STACK' }
      case 'CHASE_BALL':
        if (ballLoose) return { x: state.ball.position.x, y: state.ball.position.y, action: 'PICKUP_BALL' }
        return { x: STACK_CENTER.x, y: STACK_CENTER.y, action: 'MOVE_TO' }
      case 'BUILD_FIRST':
        return { x: STACK_CENTER.x + rng.range(-20, 20), y: STACK_CENTER.y + rng.range(-20, 20), action: 'BUILD' }
      default:
        if (state.ball.inFlight) return { x: agent.position.x + rng.range(-90, 90), y: agent.position.y + rng.range(-60, 60), action: 'DODGE' }
        return { x: STACK_CENTER.x + rng.range(-25, 25), y: STACK_CENTER.y + rng.range(-25, 25), action: 'BUILD' }
    }
  }

  if (coach === 'DEFEND') {
    return { x: STACK_CENTER.x + 60, y: STACK_CENTER.y, action: 'GUARD_STACK' }
  }
  if (coach === 'DISTRACT') {
    const angle = rng.angleRadians()
    return { x: STACK_CENTER.x + Math.cos(angle) * 180, y: STACK_CENTER.y + Math.sin(angle) * 120, action: 'DISTRACT' }
  }
  if (ballLoose) {
    return { x: state.ball.position.x, y: state.ball.position.y, action: 'PICKUP_BALL' }
  }
  const holderIsAlly = state.ball.holder?.startsWith(`${agent.side}:`) ?? false
  if (!holderIsAlly) {
    const opponent = nearestOpponent(agent, state.agents)
    if (opponent) return { x: opponent.position.x, y: opponent.position.y, action: 'DODGE' }
  }
  if (coach === 'ATTACK' && state.ball.holder === agentKey(agent)) {
    const opponent = nearestOpponent(agent, state.agents)
    if (opponent) return { x: opponent.position.x, y: opponent.position.y, action: 'THROW' }
  }
  return { x: STACK_CENTER.x, y: STACK_CENTER.y, action: 'MOVE_TO' }
}

function moveAgent(agent: EngineAgent, dtSeconds: number, rng: Rng): void {
  const dx = agent.targetX - agent.position.x
  const dy = agent.targetY - agent.position.y
  const distance = Math.hypot(dx, dy)
  const wantsDodge = agent.currentAction === 'DODGE'
  const wantsSprint = agent.currentAction === 'SPRINT' || agent.currentAction === 'DISTRACT'

  let speed: number = AGENT_PHYSICS.walkSpeed
  if (wantsDodge && agent.stamina >= AGENT_PHYSICS.dodgeStaminaCost) {
    speed = AGENT_PHYSICS.dodgeSpeed
    agent.stamina -= AGENT_PHYSICS.dodgeStaminaCost
  } else if (wantsSprint && agent.stamina > 0) {
    speed = AGENT_PHYSICS.sprintSpeed
    agent.stamina = Math.max(0, agent.stamina - AGENT_PHYSICS.sprintStaminaPerSecond * dtSeconds)
  } else {
    agent.stamina = Math.min(AGENT_PHYSICS.maxStamina, agent.stamina + AGENT_PHYSICS.staminaRegenPerSecond * dtSeconds)
  }

  if (distance < 2) {
    if (wantsDodge) agent.currentAction = 'WAIT'
    return
  }
  const step = Math.min(speed * dtSeconds, distance)
  const jitterX = rng.range(-0.6, 0.6)
  const jitterY = rng.range(-0.6, 0.6)
  const next = clampToArena(
    agent.position.x + (dx / distance) * step + jitterX,
    agent.position.y + (dy / distance) * step + jitterY,
  )
  agent.position = next
  if (!wantsDodge) agent.currentAction = speed === AGENT_PHYSICS.sprintSpeed ? 'SPRINT' : 'MOVE_TO'
}

function resolveBall(state: GameState, dtSeconds: number, events: MatchEvent[]): void {
  const ball = state.ball
  if (ball.holder) return
  if (!ball.inFlight) {
    for (const agent of state.agents) {
      if (!agent.active) continue
      const distance = Math.hypot(agent.position.x - ball.position.x, agent.position.y - ball.position.y)
      if (distance <= AGENT_PHYSICS.pickupRadius) {
        ball.holder = agentKey(agent)
        ball.inFlight = false
        ball.velocity = { x: 0, y: 0 }
        agent.currentAction = 'PICKUP_BALL'
        emit(state, events, 'BALL_PICKUP', agentKey(agent), { x: agent.position.x, y: agent.position.y })
        return
      }
    }
    return
  }

  const nextX = ball.position.x + ball.velocity.x * dtSeconds
  const nextY = ball.position.y + ball.velocity.y * dtSeconds
  ball.position = { x: nextX, y: nextY }

  for (const agent of state.agents) {
    if (!agent.active) continue
    if (ball.thrower === agentKey(agent)) continue
    const distance = Math.hypot(agent.position.x - ball.position.x, agent.position.y - ball.position.y)
    if (distance <= AGENT_PHYSICS.collisionRadius) {
      agent.active = false
      agent.currentAction = 'WAIT'
      scoreFor(state, agent.side === 'red' ? 'blue' : 'red').eliminations += 1
      emit(state, events, 'AGENT_ELIMINATED', agentKey(agent), { hitBy: ball.thrower ?? 'unknown' })
      ball.inFlight = false
      ball.velocity = { x: 0, y: 0 }
      ball.thrower = null
      return
    }
  }

  const stackDistance = Math.hypot(ball.position.x - state.stack.position.x, ball.position.y - state.stack.position.y)
  if (stackDistance <= AGENT_PHYSICS.collisionRadius + 12) {
    if (!state.stack.knockedDown) {
      state.stack.knockedDown = true
      state.stack.completed = 0
      emit(state, events, 'STACK_KNOCKED', ball.thrower, { by: ball.thrower ?? 'unknown' })
    }
    ball.inFlight = false
    ball.velocity = { x: 0, y: 0 }
    ball.thrower = null
    return
  }

  if (ball.position.x < 0 || ball.position.x > ARENA.width || ball.position.y < 0 || ball.position.y > ARENA.height) {
    ball.position = clampToArena(ball.position.x, ball.position.y)
    ball.inFlight = false
    ball.velocity = { x: 0, y: 0 }
    ball.thrower = null
  }
}

function tryThrow(state: GameState, agent: EngineAgent, rng: Rng, events: MatchEvent[]): boolean {
  const ball = state.ball
  if (ball.holder !== agentKey(agent)) return false
  if (agent.stamina < AGENT_PHYSICS.throwStaminaCost) return false
  if (agent.currentAction !== 'THROW') return false
  const target = roleFor(state, agent.side) === 'HUNTERS' ? state.stack.position : nearestOpponent(agent, state.agents)?.position
  if (!target) return false
  const distance = Math.hypot(target.x - agent.position.x, target.y - agent.position.y)
  if (distance > AGENT_PHYSICS.throwRange) return false

  const aimError = rng.range(-0.09, 0.09)
  const angle = Math.atan2(target.y - agent.position.y, target.x - agent.position.x) + aimError
  ball.holder = null
  ball.inFlight = true
  ball.thrower = agentKey(agent)
  ball.position = { x: agent.position.x, y: agent.position.y }
  ball.velocity = {
    x: Math.cos(angle) * AGENT_PHYSICS.throwSpeed,
    y: Math.sin(angle) * AGENT_PHYSICS.throwSpeed,
  }
  agent.stamina = Math.max(0, agent.stamina - AGENT_PHYSICS.throwStaminaCost)
  emit(state, events, 'BALL_THROW', agentKey(agent), { targetX: Math.round(target.x), targetY: Math.round(target.y) })
  return true
}

function resolveBuilding(state: GameState, dtMs: number, events: MatchEvent[]): void {
  const stack = state.stack
  if (stack.completed >= stack.total) return
  let builders = 0
  for (const agent of state.agents) {
    if (!agent.active) continue
    if (roleFor(state, agent.side) !== 'REBUILDERS') continue
    const distance = Math.hypot(agent.position.x - stack.position.x, agent.position.y - stack.position.y)
    if (distance > AGENT_PHYSICS.buildRadius) continue
    builders += 1
    agent.currentAction = 'BUILD'
    agent.buildProgressMs += dtMs
  }
  if (builders === 0) return

  let progress = 0
  for (const agent of state.agents) {
    if (!agent.active) continue
    if (roleFor(state, agent.side) !== 'REBUILDERS') continue
    progress += agent.buildProgressMs
    agent.buildProgressMs = 0
  }
  const pieces = Math.floor(progress / AGENT_PHYSICS.buildMsPerPiece)
  if (pieces <= 0) return
  const side: Side = state.redRole === 'REBUILDERS' ? 'red' : 'blue'
  const applied = Math.min(pieces, stack.total - stack.completed)
  stack.completed += applied
  stack.knockedDown = stack.completed < stack.total
  scoreFor(state, side).buildCount += applied
  emit(state, events, 'STACK_PIECE', null, { completed: stack.completed, total: stack.total, side })
  if (stack.completed >= stack.total) {
    const score = scoreFor(state, side)
    score.objectiveComplete = true
    score.completionMs = Math.round(state.halfElapsedMs)
    emit(state, events, 'STACK_COMPLETE', null, { side, completionMs: score.completionMs })
  }
}

function transitionPhase(state: GameState, next: MatchPhase, events: MatchEvent[]): void {
  state.phase = next
  state.phaseElapsedMs = 0
  emit(state, events, 'PHASE_CHANGED', null, { phase: next, half: state.half })
}

function resetForHalf(state: GameState, half: 1 | 2): void {
  const roles = ROLE_FOR_HALF[half]
  state.half = half
  state.redRole = roles.red
  state.blueRole = roles.blue
  state.halfElapsedMs = 0
  state.phaseElapsedMs = 0
  state.stack = { position: { ...STACK_CENTER }, completed: 0, total: MATCH.stackPieces, knockedDown: true }
  state.ball = { position: { x: 350, y: 300 }, velocity: { x: 0, y: 0 }, holder: null, inFlight: false, thrower: null }
  state.coachCommand = null
  state.coachSide = null
  state.coachExpiresTick = 0
  for (const agent of state.agents) {
    const spawn = SIDE_SPAWN[agent.side]
    const offset = SLOT_OFFSETS[agent.slot]
    agent.position = clampToArena(spawn.x + offset.x, spawn.y + offset.y)
    agent.stamina = AGENT_PHYSICS.maxStamina
    agent.active = true
    agent.currentAction = roleFor(state, agent.side) === 'REBUILDERS' ? 'MOVE_TO' : 'PICKUP_BALL'
    agent.buildProgressMs = 0
    agent.dodgeUntilTick = 0
  }
}

function finalize(state: GameState, events: MatchEvent[]): void {
  state.winnerSide = calculateWinner(state.redScore, state.blueScore)
  state.finishedAtMs = state.startedAtMs + state.tick * MATCH.tickMs
  transitionPhase(state, 'FINISHED', events)
  emit(state, events, 'MATCH_COMPLETE', null, { winnerSide: state.winnerSide })
}

export function advance(state: GameState, dtMs: number): TickOutput {
  const events: MatchEvent[] = []
  if (state.phase === 'FINISHED' || state.phase === 'CANCELLED') return { state, events }

  const dtSeconds = dtMs / 1000
  state.tick += 1
  state.phaseElapsedMs += dtMs
  state.halfElapsedMs += dtMs
  const rng = createRng(`${state.seed}:${state.half}:${state.tick}`)

  if (state.phase === 'HALFTIME') {
    if (state.phaseElapsedMs >= MATCH.halftimeDurationMs) {
      resetForHalf(state, 2)
      transitionPhase(state, 'KNOCKDOWN', events)
    }
    return { state, events }
  }

  const desiredPhase: MatchPhase = state.halfElapsedMs < MATCH.knockdownPhaseMs ? 'KNOCKDOWN' : 'REBUILD'
  if (state.phase !== desiredPhase) transitionPhase(state, desiredPhase, events)

  for (const agent of state.agents) {
    if (!agent.active) continue
    const decision = behaviorTarget(agent, state, rng)
    agent.targetX = decision.x
    agent.targetY = decision.y
    if (decision.action === 'THROW' || decision.action === 'DODGE') agent.currentAction = decision.action
    if (decision.action === 'DISTRACT') agent.currentAction = 'DISTRACT'
  }

  for (const agent of state.agents) {
    if (!agent.active) continue
    moveAgent(agent, dtSeconds, rng)
    tryThrow(state, agent, rng, events)
  }

  resolveBall(state, dtSeconds, events)
  resolveBuilding(state, dtMs, events)

  if (state.halfElapsedMs >= MATCH.halfDurationMs) {
    if (state.half === 1) {
      transitionPhase(state, 'HALFTIME', events)
      emit(state, events, 'HALFTIME', null, { redRole: state.redRole, blueRole: state.blueRole })
    } else {
      finalize(state, events)
    }
  }

  return { state, events }
}

export function advanceTo(state: GameState, targetTick: number): TickOutput {
  const events: MatchEvent[] = []
  let current = state
  while (current.tick < targetTick && current.phase !== 'FINISHED' && current.phase !== 'CANCELLED') {
    const output = advance(current, MATCH.tickMs)
    current = output.state
    events.push(...output.events)
  }
  return { state: current, events }
}

export function applyCoach(state: GameState, side: Side, command: CoachCommand): { accepted: boolean; reason: string | null } {
  if (state.phase === 'FINISHED' || state.phase === 'CANCELLED') {
    return { accepted: false, reason: 'Pertandingan sudah selesai' }
  }
  if (state.phase === 'HALFTIME') return { accepted: false, reason: 'Jeda babak, arahan ditunda' }
  state.coachCommand = command
  state.coachSide = side
  state.coachExpiresTick = state.tick + Math.floor(8_000 / MATCH.tickMs)
  return { accepted: true, reason: null }
}

export function toSnapshot(state: GameState, nowMs: number): MatchSnapshot {
  const halfRemaining = Math.max(0, MATCH.halfDurationMs - state.halfElapsedMs)
  return {
    id: state.matchId,
    mode: state.mode,
    phase: state.phase,
    seed: state.seed,
    rulesetVersion: RULESET_VERSION,
    seq: state.seq,
    serverTime: new Date(nowMs).toISOString(),
    startedAt: new Date(state.startedAtMs).toISOString(),
    half: state.half,
    remainingMs: Math.round(halfRemaining),
    redOwnerId: state.redOwnerId,
    blueOwnerId: state.blueOwnerId,
    redRole: state.redRole,
    blueRole: state.blueRole,
    agents: state.agents.map(agent => ({
      slot: agent.slot,
      side: agent.side,
      position: { x: Math.round(agent.position.x), y: Math.round(agent.position.y) },
      stamina: Math.round(agent.stamina),
      active: agent.active,
      behavior: agent.behavior,
      currentAction: agent.currentAction,
    })),
    ball: {
      position: { x: Math.round(state.ball.position.x), y: Math.round(state.ball.position.y) },
      velocity: { x: Math.round(state.ball.velocity.x), y: Math.round(state.ball.velocity.y) },
      holder: state.ball.holder,
    },
    stack: {
      position: { ...state.stack.position },
      completed: state.stack.completed,
      total: state.stack.total,
      knockedDown: state.stack.knockedDown,
    },
    redScore: { ...state.redScore },
    blueScore: { ...state.blueScore },
    winnerSide: state.winnerSide,
  }
}
