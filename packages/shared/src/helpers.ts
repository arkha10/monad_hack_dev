import { keccak256, stringToBytes } from 'viem'
import type { AgentSlot, Behavior, CoachCommand, MatchResult, MatchSnapshot, Side, Vector2 } from './types'

const behaviorTerms: Array<[Behavior, string[]]> = [
  ['DECOY', ['alihkan', 'pengalih', 'decoy', 'distract']],
  ['DODGE_FIRST', ['hindari', 'menghindari', 'dodge']],
  ['CHASE_BALL', ['kejar bola', 'ambil bola', 'chase']],
  ['GUARD_STACK', ['jaga genting', 'jaga tumpukan', 'guard']],
  ['BUILD_FIRST', ['susun genting', 'menyusun genting', 'rebuild', 'build']],
]

export function parseBehavior(prompt: string): { behavior: Behavior, recognizedTerms: string[] } {
  const normalized = normalizePrompt(prompt)
  for (const [behavior, terms] of behaviorTerms) {
    const recognizedTerms = terms.filter(term => normalized.includes(term))
    if (recognizedTerms.length > 0) return { behavior, recognizedTerms }
  }
  return { behavior: 'BALANCED', recognizedTerms: [] }
}

export function parseCoachCommand(input: string): { command: CoachCommand | null, error: string | null } {
  const value = normalizePrompt(input)
  const map: Record<string, CoachCommand> = { attack: 'ATTACK', serang: 'ATTACK', defend: 'DEFEND', bertahan: 'DEFEND', rebuild: 'REBUILD', susun: 'REBUILD', distract: 'DISTRACT', alihkan: 'DISTRACT' }
  const command = map[value]
  return command ? { command, error: null } : { command: null, error: 'Perintah belum dikenali' }
}

export function normalizePrompt(input: string): string {
  return input.normalize('NFKC').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')
}

export function calculateWinner(red: MatchResult['scores']['red'], blue: MatchResult['scores']['blue']): Side | 'draw' {
  if (red.objectiveComplete !== blue.objectiveComplete) return red.objectiveComplete ? 'red' : 'blue'
  if (red.buildCount !== blue.buildCount) return red.buildCount > blue.buildCount ? 'red' : 'blue'
  if (red.eliminations !== blue.eliminations) return red.eliminations > blue.eliminations ? 'red' : 'blue'
  return 'draw'
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function stableMatchDigest(snapshot: MatchSnapshot, eventHashes: string[]): `0x${string}` {
  return keccak256(stringToBytes(JSON.stringify({ snapshot, eventHashes })))
}

export function buildExplorerTxUrl(txHash: `0x${string}`): string {
  return `https://testnet.monadscan.com/tx/${txHash}`
}

export function assertFiveAgentSlots(slots: AgentSlot[]): boolean {
  return slots.length === 5 && slots.every((slot, index) => slot === `p${index + 1}`)
}
