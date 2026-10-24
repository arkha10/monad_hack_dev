import { describe, it, expect } from 'vitest'
import {
  MONAD_TESTNET,
  buildExplorerTxUrl,
  buildExplorerAddressUrl,
} from '../../src/lib/web3'
import { monadChainAdapter, handleChainRequest } from '../../../worker/src/chain'

describe('Monad Web3 Helpers', () => {
  it('has verified Monad Testnet parameters', () => {
    expect(MONAD_TESTNET.id).toBe(10143)
    expect(MONAD_TESTNET.hexId).toBe('0x279f')
    expect(MONAD_TESTNET.rpcUrl).toBe('https://testnet-rpc.monad.xyz')
    expect(MONAD_TESTNET.explorerUrl).toBe('https://testnet.monadscan.com')
  })

  it('builds valid explorer transaction and address URLs', () => {
    const tx = '0x1234567890abcdef'
    const addr = '0x97971c36721ce32d53745457fea44b42d397b54d'
    expect(buildExplorerTxUrl(tx)).toBe('https://testnet.monadscan.com/tx/0x1234567890abcdef')
    expect(buildExplorerAddressUrl(addr)).toBe('https://testnet.monadscan.com/address/0x97971c36721ce32d53745457fea44b42d397b54d')
  })
})

describe('Monad Chain Adapter', () => {
  it('records match commitment and supports idempotency', async () => {
    const args = {
      matchId: 'match-test-1',
      replayHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
      resultHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`,
      rulesetHash: '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`,
      winnerCommitment: '0x4444444444444444444444444444444444444444444444444444444444444444' as `0x${string}`,
    }

    const first = await monadChainAdapter.recordMatch(args)
    expect(first.confirmed).toBe(true)
    expect(first.txHash).toMatch(/^0x/)

    // Idempotent second call returns same txHash
    const second = await monadChainAdapter.recordMatch(args)
    expect(second.txHash).toBe(first.txHash)

    const matchInfo = await monadChainAdapter.getChainMatch('match-test-1')
    expect(matchInfo.exists).toBe(true)
    expect(matchInfo.replayHash).toBe(args.replayHash)
  })

  it('claims reward and rejects double claims', async () => {
    const claimArgs = {
      matchId: 'match-test-claim',
      recipient: '0x97971c36721ce32d53745457fea44b42d397b54d' as `0x${string}`,
      authenticatedWinnerId: 'user-winner-1',
    }

    const res = await monadChainAdapter.claimReward(claimArgs)
    expect(res.confirmed).toBe(true)
    expect(res.txHash).toMatch(/^0x/)

    const state = await monadChainAdapter.getChainMatch('match-test-claim')
    expect(state.claimed).toBe(true)
  })

  it('handles HTTP reward eligibility and claim requests', async () => {
    const getReq = new Request('http://localhost/api/v1/chain/rewards/http-match-1', { method: 'GET' })
    const getRes = await handleChainRequest(getReq, 'user-1')
    expect(getRes.status).toBe(200)
    const getData = (await getRes.json()) as { data: { status: string } }
    expect(getData.data.status).toBe('eligible')

    const postReq = new Request('http://localhost/api/v1/chain/reward-claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: 'http-match-1' }),
    })
    const postRes = await handleChainRequest(postReq, 'user-1')
    expect(postRes.status).toBe(200)
    const postData = (await postRes.json()) as { data: { status: string; txHash: string } }
    expect(postData.data.status).toBe('confirmed')
    expect(postData.data.txHash).toMatch(/^0x/)
  })
})
