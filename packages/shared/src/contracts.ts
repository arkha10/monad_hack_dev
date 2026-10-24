import type { Team, MatchSnapshot, MatchResult, MatchEvent, CreditBalance, Cosmetic, AuthenticatedProfile, Difficulty, MatchId, TeamId, CoachCommand, WalletLink, RewardClaim, ApiEnvelope } from './types'

export interface BoaiDataLayer {
  syncIdentity(): Promise<ApiEnvelope<AuthenticatedProfile>>
  getTeam(): Promise<ApiEnvelope<Team>>
  saveTeam(team: Pick<Team, 'name' | 'agents'>): Promise<ApiEnvelope<Team>>
  startPractice(difficulty: Difficulty, teamId: TeamId): Promise<ApiEnvelope<{ matchId: MatchId }>>
  joinQueue(teamId: TeamId, stakeCredits: number): Promise<ApiEnvelope<{ queueTicket: string
status: 'waiting' | 'matched'
matchId: MatchId | null }>>
  getQueueStatus(queueTicket: string): Promise<ApiEnvelope<{ status: 'waiting' | 'matched' | 'cancelled'
matchId: MatchId | null }>>
  leaveQueue(queueTicket: string): Promise<ApiEnvelope<{ status: 'cancelled' }>>
  getMatch(matchId: MatchId): Promise<ApiEnvelope<MatchSnapshot>>
  getMatchEvents(matchId: MatchId, afterSeq: number): Promise<ApiEnvelope<MatchEvent[]>>
  createMatchSocketTicket(matchId: MatchId): Promise<ApiEnvelope<{ ticket: string
expiresAt: string }>>
  sendCoach(matchId: MatchId, command: CoachCommand): Promise<ApiEnvelope<{ accepted: boolean
seq: number }>>
  getResult(matchId: MatchId): Promise<ApiEnvelope<MatchResult>>
  getCredits(): Promise<ApiEnvelope<CreditBalance>>
  listCosmetics(): Promise<ApiEnvelope<Cosmetic[]>>
  purchaseCosmetic(cosmeticId: string): Promise<ApiEnvelope<{ ownedCosmeticIds: string[]
balance: CreditBalance }>>
  claimDemoAdReward(): Promise<ApiEnvelope<{ balance: CreditBalance
nextEligibleAt: string | null }>>
  getLeaderboard(): Promise<ApiEnvelope<Array<{ teamId: TeamId
name: string
wins: number
losses: number }>>>
  requestWalletNonce(address: `0x${string}`): Promise<ApiEnvelope<{ nonce: string
message: string
expiresAt: string }>>
  linkWallet(address: `0x${string}`, signature: `0x${string}`): Promise<ApiEnvelope<WalletLink>>
  getRewardEligibility(matchId: MatchId): Promise<ApiEnvelope<RewardClaim>>
  claimTestnetReward(matchId: MatchId): Promise<ApiEnvelope<RewardClaim>>
}

export type AuthoritativeGameLookup = {
  getAuthoritativeWinner(matchId: MatchId): Promise<string | null>
  getVerifiedLinkedWallet(userId: string): Promise<`0x${string}` | null>
}

export type ChainAdapter = {
  recordMatch(args: { matchId: MatchId
replayHash: `0x${string}`
resultHash: `0x${string}`
rulesetHash: `0x${string}`
winnerCommitment: `0x${string}` }): Promise<{ txHash: `0x${string}`
confirmed: boolean }>
  claimReward(args: { matchId: MatchId
recipient: `0x${string}`
authenticatedWinnerId: string }): Promise<{ txHash: `0x${string}`
confirmed: boolean }>
  getChainMatch(matchId: MatchId): Promise<{ exists: boolean
replayHash: `0x${string}` | null
claimed: boolean }>
}
