/**
 * Exact ABI of contracts/src/BOAIArena.sol, kept as `const` so viem infers argument and
 * return types from it. Mismatching this with the deployed bytecode is the one failure a
 * typechecker cannot catch, so it mirrors the frozen B2.7 signature set one-for-one.
 */
export const BOAI_ARENA_ABI = [
  {
    type: 'function',
    name: 'recordMatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'replayHash', type: 'bytes32' },
      { name: 'resultHash', type: 'bytes32' },
      { name: 'rulesetHash', type: 'bytes32' },
      { name: 'winnerCommitment', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'awardDemoReward',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isMatchRecorded',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isRewardClaimed',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MatchRecorded',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'replayHash', type: 'bytes32', indexed: false },
      { name: 'resultHash', type: 'bytes32', indexed: false },
      { name: 'rulesetHash', type: 'bytes32', indexed: false },
      { name: 'winnerCommitment', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DemoRewardAwarded',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const
