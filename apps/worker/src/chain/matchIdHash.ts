import { keccak256, stringToBytes } from 'viem'

/**
 * The frozen conversion from a UTF-8 match id to the on-chain `bytes32` id.
 *
 * Every caller of BOAIArena.recordMatch and every verifier of a recorded match must use
 * this function. Hashing the raw string (no trim, no lowercase) is the documented rule, so
 * `match-boai-pvp-001` and `Match-boai-pvp-001` are different matches on-chain.
 */
export function toChainMatchId(matchId: string): `0x${string}` {
  if (matchId.length === 0) throw new Error('matchId must not be empty')
  return keccak256(stringToBytes(matchId))
}
