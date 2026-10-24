import type { AgentSlot, Behavior, PlayerPrompt, Team } from '@boai/shared/types'
import { SEED } from '@boai/shared/seed'
import { HttpError } from '../routes/http'

const SLOTS: AgentSlot[] = ['p1', 'p2', 'p3', 'p4', 'p5']
const BEHAVIORS: Behavior[] = ['BUILD_FIRST', 'DODGE_FIRST', 'DECOY', 'CHASE_BALL', 'GUARD_STACK', 'BALANCED']

export function defaultTeam(teamId: string, ownerId: string): Team {
  const agents = SLOTS.map((slot, index) => ({
    slot,
    name: `Agent ${index + 1}`,
    text: SEED.promptSamples[index % SEED.promptSamples.length].text,
    behavior: 'BALANCED' as Behavior,
    skinId: index % 2 === 0 ? 'skin-default-red' : 'skin-default-blue',
  })) as Team['agents']
  return { id: teamId, ownerId, name: 'Tim BOAI', agents, updatedAt: new Date().toISOString() }
}

export function validateTeamPayload(value: unknown): { name: string; agents: Team['agents'] } {
  if (!value || typeof value !== 'object') throw new HttpError('INVALID_TEAM', 'Payload tim tidak valid', 400)
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (name.length < 2 || name.length > 32) throw new HttpError('INVALID_TEAM', 'Nama tim harus 2 sampai 32 karakter', 400)

  const rawAgents = record.agents
  if (!Array.isArray(rawAgents) || rawAgents.length !== 5) {
    throw new HttpError('INVALID_TEAM', 'Tim harus berisi tepat lima agent', 400)
  }

  const agents = rawAgents.map((raw, index): PlayerPrompt => {
    if (!raw || typeof raw !== 'object') throw new HttpError('INVALID_TEAM', `Agent ${index + 1} tidak valid`, 400)
    const agent = raw as Record<string, unknown>
    if (agent.slot !== SLOTS[index]) throw new HttpError('INVALID_TEAM', `Slot agent ${index + 1} harus ${SLOTS[index]}`, 400)
    const agentName = typeof agent.name === 'string' ? agent.name.trim() : ''
    if (agentName.length === 0 || agentName.length > 24) throw new HttpError('INVALID_TEAM', `Nama agent ${index + 1} harus 1 sampai 24 karakter`, 400)
    const text = typeof agent.text === 'string' ? agent.text.trim() : ''
    if (text.length > 280) throw new HttpError('INVALID_TEAM', `Prompt agent ${index + 1} maksimal 280 karakter`, 400)
    const behavior = agent.behavior
    if (typeof behavior !== 'string' || !BEHAVIORS.includes(behavior as Behavior)) {
      throw new HttpError('INVALID_TEAM', `Behavior agent ${index + 1} tidak dikenali`, 400)
    }
    const skinId = typeof agent.skinId === 'string' ? agent.skinId : 'skin-default-red'
    return { slot: SLOTS[index], name: agentName, text, behavior: behavior as Behavior, skinId }
  }) as Team['agents']

  return { name, agents }
}

export function behaviorsFromTeam(team: Team): Record<AgentSlot, Behavior> {
  const result = {} as Record<AgentSlot, Behavior>
  for (const slot of SLOTS) {
    const agent = team.agents.find(item => item.slot === slot)
    result[slot] = agent ? agent.behavior : 'BALANCED'
  }
  return result
}
