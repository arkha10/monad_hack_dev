import type { AgentSlot, Difficulty, SideRole } from '@boai/shared/types'

export const RULESET_VERSION = 'boai-blitz-v1'

export const ARENA = { width: 1000, height: 600 } as const

export const TICK_MS = 100

export const MATCH = {
  tickMs: TICK_MS,
  halfDurationMs: 75_000,
  halftimeDurationMs: 4_000,
  knockdownPhaseMs: 25_000,
  respawnMs: 12_000,
  stackPieces: 5,
} as const

export const STACK_CENTER = { x: 500, y: 300 } as const

export const SIDE_SPAWN: Record<'red' | 'blue', { x: number; y: number }> = {
  red: { x: 200, y: 300 },
  blue: { x: 800, y: 300 },
}

export const SLOT_OFFSETS: Record<AgentSlot, { x: number; y: number }> = {
  p1: { x: 0, y: -120 },
  p2: { x: 0, y: -60 },
  p3: { x: 0, y: 0 },
  p4: { x: 0, y: 60 },
  p5: { x: 0, y: 120 },
}

export const AGENT_PHYSICS = {
  radius: 14,
  maxStamina: 100,
  walkSpeed: 120,
  sprintSpeed: 190,
  sprintStaminaPerSecond: 22,
  staminaRegenPerSecond: 9,
  dodgeSpeed: 260,
  dodgeDurationMs: 300,
  dodgeStaminaCost: 18,
  pickupRadius: 26,
  throwRange: 420,
  throwMinRange: 90,
  throwSpeed: 520,
  throwStaminaCost: 12,
  throwCooldownMs: 1_500,
  buildRadius: 46,
  buildMsPerPiece: 8_000,
  collisionRadius: 26,
} as const

export const SCORING = {
  objectiveComplete: 1_000,
  buildPiece: 100,
  elimination: 60,
  remainingHalfSecond: 2,
} as const

export const LEDGER = {
  starterCredits: 100,
  adRewardCredits: 15,
  adCooldownMs: 60_000,
  practiceStake: 0,
} as const

export const DIFFICULTY_PRESETS: Record<Difficulty, { reactionMs: number; aimErrorDeg: number; label: string }> = {
  easy: { reactionMs: 900, aimErrorDeg: 18, label: 'Mudah' },
  medium: { reactionMs: 550, aimErrorDeg: 10, label: 'Sedang' },
  hard: { reactionMs: 300, aimErrorDeg: 4, label: 'Sulit' },
}

export const ROLE_FOR_HALF: Record<1 | 2, { red: SideRole; blue: SideRole }> = {
  1: { red: 'REBUILDERS', blue: 'HUNTERS' },
  2: { red: 'HUNTERS', blue: 'REBUILDERS' },
}

export const PRACTICE_OPPONENT_OWNER = 'bot-practice-opponent'
