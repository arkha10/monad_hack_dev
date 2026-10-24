import { ledgerFetch, matchFetch, type WinnerResponse } from './doClient'
import type { LedgerWalletResponse } from './doProtocol'
import type { Env } from './env'

export async function getAuthoritativeWinner(env: Env, matchId: string): Promise<string | null> {
  const winner = await matchFetch<WinnerResponse>(env, matchId, '/winner')
  return winner.userId
}

export async function getVerifiedLinkedWallet(env: Env, userId: string): Promise<`0x${string}` | null> {
  const link = await ledgerFetch<LedgerWalletResponse>(env, userId, '/wallet/get')
  return link ? link.address : null
}
