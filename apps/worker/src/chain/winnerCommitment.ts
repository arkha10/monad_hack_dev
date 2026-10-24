import { encodePacked, keccak256 } from 'viem'
import { toChainMatchId } from './matchIdHash'

/**
 * `keccak256(abi.encodePacked(matchIdHash, winnerUserId, salt))`.
 *
 * The salt is server-held (`BOAI_COMMITMENT_SALT`) and never published, so a public
 * observer holding the on-chain commitment cannot enumerate a match's winner: for a small
 * user space the commitment would otherwise be brute-forceable in milliseconds. This is
 * operator attestation, not a zero-knowledge proof, and the UI must not call it one.
 */
export function buildWinnerCommitment(args: {
  matchId: string
  winnerUserId: string
  salt: string
}): `0x${string}` {
  if (args.winnerUserId.trim().length === 0) throw new Error('winnerUserId must not be empty')
  if (args.salt.length === 0) throw new Error('commitment salt must not be empty')

  return keccak256(
    encodePacked(
      ['bytes32', 'string', 'string'],
      [toChainMatchId(args.matchId), args.winnerUserId, args.salt],
    ),
  )
}
