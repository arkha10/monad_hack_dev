import type { RewardClaim } from '@boai/shared/types'
import { NO_RECIPIENT } from './labels'

export type ChainMatchState = { exists: boolean; claimed: boolean }

export type EligibilityInput = {
  chainConfigured: boolean
  authenticatedUserId: string | null
  authoritativeWinner: string | null
  linkedWallet: `0x${string}` | null
  chain: ChainMatchState
}

export type Eligibility = { status: RewardClaim['status']; recipient: `0x${string}` }

/**
 * The one place that decides a reward status. Ordered guards rather than nested
 * conditionals, so each rejection reason is visible and the first failing rule wins:
 * unconfigured -> unauthenticated -> unknown match -> not the winner -> no wallet ->
 * already claimed -> not yet recorded -> eligible.
 */
export function deriveEligibility(input: EligibilityInput): Eligibility {
  const recipient = input.linkedWallet ?? NO_RECIPIENT

  if (!input.chainConfigured) return { status: 'ineligible', recipient }
  if (input.authenticatedUserId === null) return { status: 'ineligible', recipient }
  if (input.authoritativeWinner === null) return { status: 'ineligible', recipient }
  if (input.authoritativeWinner !== input.authenticatedUserId) return { status: 'ineligible', recipient }
  if (input.linkedWallet === null) return { status: 'ineligible', recipient }
  if (input.chain.claimed) return { status: 'already_claimed', recipient }
  if (!input.chain.exists) return { status: 'ineligible', recipient }

  return { status: 'eligible', recipient }
}
