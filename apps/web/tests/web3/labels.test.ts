import { describe, expect, it } from 'vitest'
import type { RewardClaim } from '@boai/shared/types'
import { buildExplorerTxUrl } from '@boai/shared/helpers'
import {
  NO_VALUE_NOTICE,
  OPERATOR_ATTESTED_NOTICE,
  REWARD_STATUS_VIEW,
  rewardStatusView,
  TESTNET_LABEL,
} from '../../src/lib/web3/labels'
import { classifyRewardFailure, isRewardSurfaceUnavailable } from '../../src/lib/web3/failure'

const ALL_STATUSES: RewardClaim['status'][] = ['eligible', 'pending', 'confirmed', 'already_claimed', 'ineligible']

describe('reward status labels', () => {
  it('maps every status to a non-empty Indonesian label and detail', () => {
    for (const status of ALL_STATUSES) {
      const view = rewardStatusView(status)
      expect(view.label.length).toBeGreaterThan(0)
      expect(view.detail.length).toBeGreaterThan(0)
      expect(['ok', 'wait', 'bad']).toContain(view.tone)
    }
  })

  it('covers every status exactly once', () => {
    expect(Object.keys(REWARD_STATUS_VIEW).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('never labels a claimed or pending reward as a monetary success', () => {
    expect(rewardStatusView('confirmed').detail).toContain('final')
    expect(rewardStatusView('already_claimed').detail).toContain('menolak klaim kedua')
    expect(rewardStatusView('ineligible').tone).toBe('bad')
  })

  it('keeps the mandatory testnet label and no-value notice', () => {
    expect(TESTNET_LABEL).toBe('TESTNET · TANPA NILAI UANG')
    expect(NO_VALUE_NOTICE).toContain('tanpa nilai uang')
    expect(OPERATOR_ATTESTED_NOTICE).toContain('bukan bukti kriptografis')
  })
})

describe('explorer link', () => {
  const txHash = '0xd9288b83c9d193c6fabb071903297bf5d5c18f3e589e98a3232288e06cff7dfe'

  it('points at the verified Monad Testnet explorer path for a transaction', () => {
    expect(buildExplorerTxUrl(txHash)).toBe(`https://testnet.monadscan.com/tx/${txHash}`)
  })

  it('embeds the whole hash unchanged', () => {
    expect(buildExplorerTxUrl(txHash)).toContain(txHash.slice(2))
  })
})

describe('classifyRewardFailure', () => {
  it('treats an unconfigured contract as unavailable', () => {
    const failure = classifyRewardFailure(new Error('Kontrak testnet belum dikonfigurasi di server.'))
    expect(failure.kind).toBe('not-configured')
    expect(isRewardSurfaceUnavailable(failure)).toBe(true)
  })

  it('treats a dead backend as unavailable', () => {
    const failure = classifyRewardFailure(new TypeError('Failed to fetch'))
    expect(failure.kind).toBe('unreachable')
    expect(isRewardSurfaceUnavailable(failure)).toBe(true)
  })

  it('keeps a domain rejection distinct from an unavailable surface', () => {
    const failure = classifyRewardFailure(new Error('Hadiah demo untuk match ini sudah diklaim.'))
    expect(failure.kind).toBe('other')
    expect(isRewardSurfaceUnavailable(failure)).toBe(false)
  })

  it('always produces a message', () => {
    expect(classifyRewardFailure(undefined).message.length).toBeGreaterThan(0)
  })
})
