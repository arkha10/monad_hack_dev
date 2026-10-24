import { describe, expect, it } from 'vitest'
import { hasLinkedWallet, shortenAddress, ZERO_ADDRESS } from '../../src/lib/web3/address'

const FULL = '0x7698a30c2a5732a7ae3be6685caedd3557c2fc11'

describe('shortenAddress', () => {
  it('keeps the 0x prefix, six leading characters and the last four', () => {
    expect(shortenAddress(FULL)).toBe('0x7698a3…fc11')
  })

  it('honours a wider window', () => {
    expect(shortenAddress(FULL, 10)).toBe('0x7698a30c2a…fc11')
  })

  it('returns a value that is too short to shorten unchanged', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234')
  })

  it('returns a non-hex label unchanged', () => {
    expect(shortenAddress('wallet belum terhubung')).toBe('wallet belum terhubung')
  })
})

describe('hasLinkedWallet', () => {
  it('accepts a real address', () => {
    expect(hasLinkedWallet(FULL)).toBe(true)
  })

  it('rejects the zero-address sentinel', () => {
    expect(hasLinkedWallet(ZERO_ADDRESS)).toBe(false)
  })

  it('rejects null, undefined and malformed input', () => {
    expect(hasLinkedWallet(null)).toBe(false)
    expect(hasLinkedWallet(undefined)).toBe(false)
    expect(hasLinkedWallet('0x1234')).toBe(false)
  })
})
