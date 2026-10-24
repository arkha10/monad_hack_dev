import { describe, expect, it } from 'vitest'
import {
  decideChainSwitch,
  describeWalletError,
  isMonadTestnet,
  WALLET_ERROR_CODES,
} from '../../src/lib/web3/chain'

describe('decideChainSwitch', () => {
  it('is ready when the wallet is already on Monad Testnet', () => {
    expect(decideChainSwitch({ currentChainId: '0x279f', walletRejectedAddChain: false })).toEqual({ kind: 'ready' })
  })

  it('is ready when the wallet has not reported a chain yet', () => {
    expect(decideChainSwitch({ currentChainId: null, walletRejectedAddChain: false })).toEqual({ kind: 'ready' })
  })

  it('asks for a switch on another known chain', () => {
    expect(decideChainSwitch({ currentChainId: '0x1', walletRejectedAddChain: false })).toEqual({ kind: 'switch' })
  })

  it('falls back to adding the chain after the wallet refused to add it', () => {
    expect(decideChainSwitch({ currentChainId: '0x1', walletRejectedAddChain: true })).toEqual({
      kind: 'add-and-switch',
    })
  })

  it('compares chain ids case-insensitively', () => {
    expect(decideChainSwitch({ currentChainId: '0x279F', walletRejectedAddChain: false })).toEqual({ kind: 'ready' })
  })
})

describe('isMonadTestnet', () => {
  it('accepts 10143 in hex', () => {
    expect(isMonadTestnet('0x279f')).toBe(true)
  })

  it('rejects Ethereum mainnet, Monad mainnet and an unknown chain', () => {
    expect(isMonadTestnet('0x1')).toBe(false)
    expect(isMonadTestnet('0x8f')).toBe(false)
    expect(isMonadTestnet(null)).toBe(false)
  })
})

describe('describeWalletError', () => {
  it('names an explicit user rejection', () => {
    const view = describeWalletError({ code: WALLET_ERROR_CODES.userRejected })
    expect(view.kind).toBe('user-rejected')
    expect(view.message).toContain('ditolak')
  })

  it('names a missing provider', () => {
    const view = describeWalletError({ code: WALLET_ERROR_CODES.disconnected })
    expect(view.kind).toBe('no-provider')
  })

  it('separates an expired nonce from a generic failure', () => {
    const view = describeWalletError(new Error('Nonce sudah kedaluwarsa'))
    expect(view.kind).toBe('expired-nonce')
    expect(view.message).toContain('nonce baru')
  })

  it('falls back to unknown with the original text', () => {
    const view = describeWalletError(new Error('sesuatu gagal'))
    expect(view.kind).toBe('unknown')
    expect(view.message).toBe('sesuatu gagal')
  })

  it('never returns an empty message', () => {
    expect(describeWalletError(null).message.length).toBeGreaterThan(0)
  })
})
