import { describe, expect, it } from 'vitest'
import { toChainMatchId } from '../../../worker/src/chain/matchIdHash'
import { buildWinnerCommitment } from '../../../worker/src/chain/winnerCommitment'
import { deriveEligibility } from '../../../worker/src/chain/eligibility'

const SALT = 'unit-test-salt-not-a-real-secret'
const WINNER = '00000000-0000-4000-8000-000000000101'
const LOSER = '00000000-0000-4000-8000-000000000102'
const WALLET = '0x7698a30c2a5732a7ae3be6685caedd3557c2fc11ab'

describe('toChainMatchId', () => {
  it('hashes the UTF-8 match id with keccak256, matching the contract caller', () => {
    expect(toChainMatchId('match-boai-pvp-001')).toBe(
      '0x7698a30c2a5732a7ae3be6685caedd3557c2fc11abb5689bdde453bc617abd28',
    )
  })

  it('is case sensitive, because the raw string is hashed', () => {
    expect(toChainMatchId('match-boai-pvp-001')).not.toBe(toChainMatchId('Match-boai-pvp-001'))
  })

  it('refuses an empty id instead of hashing one', () => {
    expect(() => toChainMatchId('')).toThrow('matchId must not be empty')
  })
})

describe('buildWinnerCommitment', () => {
  it('is deterministic for the same match, winner and salt', () => {
    const first = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: SALT })
    const second = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: SALT })
    expect(first).toBe(second)
    expect(first).toBe('0x8a37ecb6756f6098095dabecbc8cf1fda88a444e09833e34d1ee8e50e1007497')
  })

  it('changes when the winner changes', () => {
    const red = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: SALT })
    const blue = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: LOSER, salt: SALT })
    expect(red).not.toBe(blue)
  })

  it('changes when the match changes', () => {
    const a = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: SALT })
    const b = buildWinnerCommitment({ matchId: 'match-boai-practice-001', winnerUserId: WINNER, salt: SALT })
    expect(a).not.toBe(b)
  })

  it('changes when the salt changes, which is why the salt must stay server-side', () => {
    const a = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: SALT })
    const b = buildWinnerCommitment({ matchId: 'match-boai-pvp-001', winnerUserId: WINNER, salt: `${SALT}-2` })
    expect(a).not.toBe(b)
  })

  it('produces a bytes32-shaped value', () => {
    const commitment = buildWinnerCommitment({ matchId: 'm', winnerUserId: WINNER, salt: SALT })
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('refuses an empty winner or an empty salt', () => {
    expect(() => buildWinnerCommitment({ matchId: 'm', winnerUserId: '  ', salt: SALT })).toThrow(
      'winnerUserId must not be empty',
    )
    expect(() => buildWinnerCommitment({ matchId: 'm', winnerUserId: WINNER, salt: '' })).toThrow(
      'commitment salt must not be empty',
    )
  })
})

describe('deriveEligibility', () => {
  const base = {
    chainConfigured: true,
    authenticatedUserId: WINNER,
    authoritativeWinner: WINNER,
    linkedWallet: WALLET as `0x${string}`,
    chain: { exists: true, claimed: false },
  }

  it('is eligible when the caller is the recorded winner with a linked wallet on a recorded match', () => {
    expect(deriveEligibility(base)).toEqual({ status: 'eligible', recipient: WALLET })
  })

  it('rejects a caller who is not the authoritative winner', () => {
    expect(deriveEligibility({ ...base, authenticatedUserId: LOSER }).status).toBe('ineligible')
  })

  it('rejects an unauthenticated caller', () => {
    expect(deriveEligibility({ ...base, authenticatedUserId: null }).status).toBe('ineligible')
  })

  it('rejects a winner with no linked wallet and reports the zero-address sentinel', () => {
    const result = deriveEligibility({ ...base, linkedWallet: null })
    expect(result.status).toBe('ineligible')
    expect(result.recipient).toBe('0x0000000000000000000000000000000000000000')
  })

  it('reports already_claimed before it reports eligible', () => {
    expect(deriveEligibility({ ...base, chain: { exists: true, claimed: true } }).status).toBe('already_claimed')
  })

  it('rejects a match that is not recorded on-chain', () => {
    expect(deriveEligibility({ ...base, chain: { exists: false, claimed: false } }).status).toBe('ineligible')
  })

  it('rejects everything when the chain is unconfigured', () => {
    expect(deriveEligibility({ ...base, chainConfigured: false }).status).toBe('ineligible')
  })
})
