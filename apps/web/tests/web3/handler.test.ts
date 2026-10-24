import { describe, expect, it } from 'vitest'
import type { ApiError } from '@boai/shared/types'
import { handleChainRequest } from '../../../worker/src/chain/handler'
import type { ChainLookup } from '../../../worker/src/chain/handler'

/**
 * These exercise the guards that must hold before any chain client exists, so no relayer key
 * and no network are involved. The happy-path write needs a live Monad Testnet deployment and
 * is not covered here.
 */
const lookup: ChainLookup = {
  getAuthoritativeWinner: async () => null,
  getVerifiedLinkedWallet: async () => null,
}

const unconfiguredEnv: Record<string, string | undefined> = {}

function rewardsRequest(matchId: string): Request {
  return new Request(`https://api.test/api/v1/chain/rewards/${matchId}`, { method: 'GET' })
}

function recordRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.test/api/v1/chain/matches/record', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      matchId: 'match-boai-pvp-001',
      replayHash: `0x${'11'.repeat(32)}`,
      resultHash: `0x${'22'.repeat(32)}`,
      rulesetHash: `0x${'33'.repeat(32)}`,
    }),
  })
}

async function errorBody(response: Response): Promise<ApiError> {
  return (await response.json()) as ApiError
}

describe('handleChainRequest authentication', () => {
  it('rejects an unauthenticated eligibility read with 401', async () => {
    const response = await handleChainRequest(rewardsRequest('match-boai-pvp-001'), unconfiguredEnv, lookup, null)
    expect(response.status).toBe(401)
    expect((await errorBody(response)).error.code).toBe('AUTH_REQUIRED')
  })

  it('rejects an unauthenticated claim with 401 before reading the body', async () => {
    const request = new Request('https://api.test/api/v1/chain/reward-claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: 'match-boai-pvp-001' }),
    })
    const response = await handleChainRequest(request, unconfiguredEnv, lookup, null)
    expect(response.status).toBe(401)
  })
})

describe('handleChainRequest degraded deployment', () => {
  it('reports an unconfigured contract as unavailable rather than eligible', async () => {
    const response = await handleChainRequest(
      rewardsRequest('match-boai-pvp-001'),
      unconfiguredEnv,
      lookup,
      '00000000-0000-4000-8000-000000000101',
    )
    expect(response.status).toBe(503)
    const body = await errorBody(response)
    expect(body.error.code).toBe('CHAIN_NOT_CONFIGURED')
    expect(body.error.retryable).toBe(false)
  })

  it('labels every reward response with the testnet network header', async () => {
    const response = await handleChainRequest(
      rewardsRequest('match-boai-pvp-001'),
      unconfiguredEnv,
      lookup,
      '00000000-0000-4000-8000-000000000101',
    )
    expect(response.headers.get('x-boai-network')).toBe('monad-testnet')
  })
})

describe('handleChainRequest internal record route', () => {
  it('refuses to run when the server secret is unset', async () => {
    const response = await handleChainRequest(recordRequest(), unconfiguredEnv, lookup, null)
    expect(response.status).toBe(503)
    expect((await errorBody(response)).error.code).toBe('CHAIN_INTERNAL_SECRET_UNSET')
  })

  it('rejects a request with no secret header', async () => {
    const env = { CHAIN_INTERNAL_SECRET: 'server-only-value' }
    const response = await handleChainRequest(recordRequest(), env, lookup, null)
    expect(response.status).toBe(403)
    expect((await errorBody(response)).error.code).toBe('FORBIDDEN')
  })

  it('rejects a wrong secret of the same length', async () => {
    const env = { CHAIN_INTERNAL_SECRET: 'server-only-value' }
    const response = await handleChainRequest(
      recordRequest({ 'x-boai-internal-secret': 'server-only-valuf' }),
      env,
      lookup,
      null,
    )
    expect(response.status).toBe(403)
  })

  it('rejects a secret of a different length without throwing', async () => {
    const env = { CHAIN_INTERNAL_SECRET: 'server-only-value' }
    const response = await handleChainRequest(recordRequest({ 'x-boai-internal-secret': 'short' }), env, lookup, null)
    expect(response.status).toBe(403)
  })

  it('never exposes a reward to an unknown route', async () => {
    const response = await handleChainRequest(
      new Request('https://api.test/api/v1/chain/unknown', { method: 'POST' }),
      unconfiguredEnv,
      lookup,
      null,
    )
    expect(response.status).toBe(404)
  })
})
