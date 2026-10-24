import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WalletPage } from '../../src/routes/Wallet'
import { RewardsPage } from '../../src/routes/Rewards'

/**
 * App.tsx is a locked file, so these pages are mounted by the lead. Rendering them here is
 * the check that the route modules are real components carrying the mandatory labels, not
 * placeholders. No wallet and no backend are involved.
 */
describe('Web3 route modules', () => {
  it('renders the wallet page with the testnet label and the no-secret promise', () => {
    const html = renderToStaticMarkup(createElement(WalletPage))

    expect(html).toContain('Hubungkan wallet')
    expect(html).toContain('TESTNET · TANPA NILAI UANG')
    expect(html).toContain('private key')
    expect(html).toContain('seed phrase')
  })

  it('renders the rewards page with a match id input and the no-value label', () => {
    const html = renderToStaticMarkup(createElement(RewardsPage))

    expect(html).toContain('Hadiah demo')
    expect(html).toContain('Match ID')
    expect(html).toContain('TESTNET · TANPA NILAI UANG')
    expect(html).toContain('tanpa nilai uang')
    expect(html).toContain('bukan bukti kriptografis')
  })

  it('states that the contract rejects a second claim', () => {
    const html = renderToStaticMarkup(createElement(RewardsPage))
    expect(html).toContain('menolak klaim kedua')
  })
})
