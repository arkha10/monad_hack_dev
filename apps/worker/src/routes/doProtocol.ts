import type {
  AgentSlot,
  Behavior,
  CoachCommand,
  CreditBalance,
  Difficulty,
  MatchEvent,
  MatchResult,
  MatchSnapshot,
  Team,
  WalletLink,
} from '@boai/shared/types'

export type Behaviors = Record<AgentSlot, Behavior>

export interface LedgerSyncRequest {
  displayName: string
  isGuest: boolean
}

export interface LedgerTeamRequest {
  name: string
  agents: Team['agents']
}

export interface CreditOpRequest {
  amount: number
  ref: string
}

export interface CreditOpResponse {
  ok: boolean
  balance: CreditBalance
  reason: string | null
}

export interface PurchaseResponse {
  ok: boolean
  ownedCosmeticIds: string[]
  balance: CreditBalance
  reason: string | null
}

export interface AdRewardResponse {
  balance: CreditBalance
  nextEligibleAt: string | null
}

export interface NonceResponse {
  nonce: string
  message: string
  expiresAt: string
}

export interface LinkWalletRequest {
  address: `0x${string}`
  signature: `0x${string}`
  message: string
}

export interface QueueJoinRequest {
  userId: string
  teamId: string
  teamName: string
  stakeCredits: number
  behaviors: Behaviors
}

export interface QueueJoinResponse {
  queueTicket: string
  status: 'waiting' | 'matched'
  matchId: string | null
}

export interface QueueStatusResponse {
  status: 'waiting' | 'matched' | 'cancelled'
  matchId: string | null
}

export interface PracticeStartRequest {
  userId: string
  teamId: string
  teamName: string
  difficulty: Difficulty
  behaviors: Behaviors
}

export interface LeaderboardRow {
  teamId: string
  name: string
  wins: number
  losses: number
}

export interface LeaderboardRecordRequest {
  teamId: string
  name: string
  won: boolean
}

export interface MatchInitRequest {
  matchId: string
  mode: 'practice' | 'pvp'
  seed: string
  difficulty: Difficulty
  redOwnerId: string
  blueOwnerId: string | null
  redTeamId: string
  blueTeamId: string
  redTeamName: string
  blueTeamName: string
  redBehaviors: Behaviors
  blueBehaviors: Behaviors
}

export interface WsTicketResponse {
  ticket: string
  expiresAt: string
}

export interface CoachRequest {
  userId: string
  command: CoachCommand
  clientMsgId: string | null
}

export interface CoachResponse {
  accepted: boolean
  seq: number
  reason: string | null
}

export interface MatchViewResponse {
  snapshot: MatchSnapshot
  result: MatchResult | null
  events: MatchEvent[]
  redTeamId: string
  blueTeamId: string
}

export type LedgerWalletResponse = WalletLink | null
