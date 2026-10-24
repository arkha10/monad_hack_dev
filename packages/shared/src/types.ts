export type UserId = string
// Supabase auth subject (UUID), never accepted as authority from client
export type TeamId = string
export type MatchId = string
export type AgentSlot = 'p1' | 'p2' | 'p3' | 'p4' | 'p5'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Behavior = 'BUILD_FIRST' | 'DODGE_FIRST' | 'DECOY' | 'CHASE_BALL' | 'GUARD_STACK' | 'BALANCED'
export type CoachCommand = 'ATTACK' | 'DEFEND' | 'REBUILD' | 'DISTRACT'
export type MatchMode = 'practice' | 'pvp'
export type MatchPhase = 'QUEUE' | 'KNOCKDOWN' | 'REBUILD' | 'HALFTIME' | 'FINISHED' | 'CANCELLED'
export type Side = 'red' | 'blue'
export type SideRole = 'REBUILDERS' | 'HUNTERS'
export type AgentAction = 'MOVE_TO' | 'SPRINT' | 'DODGE' | 'PICKUP_BALL' | 'THROW' | 'PASS_BALL' | 'BUILD' | 'DISTRACT' | 'GUARD_STACK' | 'WAIT'

export interface PlayerPrompt { slot: AgentSlot
name: string
text: string
behavior: Behavior
skinId: string
}
export interface Team { id: TeamId
ownerId: UserId
name: string
agents: [PlayerPrompt, PlayerPrompt, PlayerPrompt, PlayerPrompt, PlayerPrompt]
updatedAt: string
}
export interface Vector2 { x: number
y: number
}
export interface AgentState { slot: AgentSlot
side: Side
position: Vector2
stamina: number
active: boolean
behavior: Behavior
currentAction: AgentAction
}
export interface BallState { position: Vector2
velocity: Vector2
holder: `${Side}:${AgentSlot}` | null
}
export interface StackState { position: Vector2
completed: number
total: number
knockedDown: boolean
}
export interface SideScore { buildCount: number
completionMs: number | null
eliminations: number
objectiveComplete: boolean
}
export interface MatchSnapshot {
  id: MatchId
mode: MatchMode
phase: MatchPhase
seed: string
rulesetVersion: string
  seq: number
serverTime: string
startedAt: string | null
half: 1 | 2
remainingMs: number
  redOwnerId: UserId
blueOwnerId: UserId | null
redRole: SideRole
blueRole: SideRole
  agents: AgentState[]
ball: BallState
stack: StackState
redScore: SideScore
blueScore: SideScore
  winnerSide: Side | 'draw' | null
}
export interface MatchEvent { id: string
matchId: MatchId
seq: number
atMs: number
kind: string
actor: `${Side}:${AgentSlot}` | null
payload: Record<string, string | number | boolean | null>
}
export interface MatchResult { matchId: MatchId
winnerSide: Side | 'draw'
scores: { red: SideScore
blue: SideScore }
seed: string
replayHash: `0x${string}`
rulesetHash: `0x${string}`
resultHash: `0x${string}`
chainTxHash: `0x${string}` | null
finalizedAt: string
}
export interface CreditBalance { available: number
reserved: number
unit: 'BOAI_CREDIT'
}
export interface WalletLink { address: `0x${string}`
chainId: number
verifiedAt: string
}
export interface Cosmetic { id: string
category: 'skin' | 'throw_effect'
name: string
priceCredits: number
gameplayModifier: false
}
export interface AuthenticatedProfile { userId: UserId
displayName: string
isGuest: boolean
teamId: TeamId | null
}
export interface ApiError { error: { code: string
message: string
retryable: boolean }
}
export interface RewardClaim { matchId: MatchId
recipient: `0x${string}`
txHash: `0x${string}` | null
status: 'eligible' | 'pending' | 'confirmed' | 'already_claimed' | 'ineligible'
}
export interface ApiEnvelope<T> { data: T
requestId: string
}

export type ClientWsMessage =
  | { type: 'CLIENT_READY'
matchId: string }
  | { type: 'COACH_SUBMIT'
matchId: string
command: CoachCommand
clientMsgId: string }
  | { type: 'PING'
clientTime: number }
export type ServerWsMessage =
  | { type: 'MATCH_SNAPSHOT'
snapshot: MatchSnapshot }
  | { type: 'MATCH_EVENT'
event: MatchEvent }
  | { type: 'MATCH_COMPLETE'
result: MatchResult }
  | { type: 'COACH_ACK'
clientMsgId: string
accepted: boolean
reason: string | null }
  | { type: 'PONG'
clientTime: number
serverTime: number }
  | { type: 'ERROR'
code: string
message: string }
