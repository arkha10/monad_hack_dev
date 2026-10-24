import { useCallback, useEffect, useState } from 'react'
import { getInjectedProvider, type EthereumProvider } from './ethereum'
import {
  decideChainSwitch,
  describeWalletError,
  isMonadTestnet,
  WALLET_ERROR_CODES,
  type WalletErrorView,
} from './chain'
import { MONAD_TESTNET_CHAIN_ID_HEX, MONAD_TESTNET_EXPLORER_URL, MONAD_TESTNET_RPC_URL } from './labels'

export type WalletState = {
  provider: EthereumProvider | null
  address: `0x${string}` | null
  chainId: string | null
  connecting: boolean
  error: WalletErrorView | null
}

export type UseWallet = WalletState & {
  connect(): Promise<void>
  switchToMonadTestnet(): Promise<void>
  clearError(): void
}

const MONAD_ADD_CHAIN_PARAMS = {
  chainId: MONAD_TESTNET_CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: [MONAD_TESTNET_RPC_URL],
  blockExplorerUrls: [MONAD_TESTNET_EXPLORER_URL],
}

/**
 * Minimal injected-wallet hook. It never reads a private key or seed phrase and only asks
 * the wallet for anything after an explicit user action.
 */
export function useWallet(): UseWallet {
  const [provider, setProvider] = useState<EthereumProvider | null>(null)
  const [address, setAddress] = useState<`0x${string}` | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<WalletErrorView | null>(null)
  const [rejectedAddChain, setRejectedAddChain] = useState(false)

  useEffect(() => {
    const injected = getInjectedProvider()
    setProvider(injected)
    if (!injected?.on) return undefined

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0]
      setAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as `0x${string}`) : null)
    }
    const onChain = (...args: unknown[]) => {
      setChainId(typeof args[0] === 'string' ? args[0] : null)
    }

    injected.on('accountsChanged', onAccounts)
    injected.on('chainChanged', onChain)
    return () => {
      injected.removeListener?.('accountsChanged', onAccounts)
      injected.removeListener?.('chainChanged', onChain)
    }
  }, [])

  const connect = useCallback(async () => {
    const injected = getInjectedProvider()
    if (injected === null) {
      setError({ kind: 'no-provider', message: 'Wallet tidak terdeteksi. Pasang wallet EVM yang mendukung Monad Testnet.' })
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const accounts = await injected.request({ method: 'eth_requestAccounts' })
      const first = Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as `0x${string}`) : null
      setAddress(first)
      setProvider(injected)

      const currentChain = await injected.request({ method: 'eth_chainId' })
      setChainId(typeof currentChain === 'string' ? currentChain : null)
    } catch (caught) {
      setError(describeWalletError(caught))
    } finally {
      setConnecting(false)
    }
  }, [])

  const switchToMonadTestnet = useCallback(async () => {
    const injected = getInjectedProvider()
    if (injected === null) {
      setError({ kind: 'no-provider', message: 'Wallet tidak terdeteksi.' })
      return
    }

    const currentChain = await injected.request({ method: 'eth_chainId' }).catch(() => null)
    const plan = decideChainSwitch({
      currentChainId: typeof currentChain === 'string' ? currentChain : null,
      walletRejectedAddChain: rejectedAddChain,
    })
    if (plan.kind === 'ready') return

    try {
      await injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }],
      })
      setRejectedAddChain(false)
      const next = await injected.request({ method: 'eth_chainId' })
      setChainId(typeof next === 'string' ? next : null)
    } catch (caught) {
      const code = typeof caught === 'object' && caught !== null ? (caught as { code?: number }).code : undefined
      if (code === WALLET_ERROR_CODES.chainNotAdded || plan.kind === 'add-and-switch') {
        try {
          await injected.request({ method: 'wallet_addEthereumChain', params: [MONAD_ADD_CHAIN_PARAMS] })
          setRejectedAddChain(false)
          const next = await injected.request({ method: 'eth_chainId' })
          setChainId(typeof next === 'string' ? next : null)
          return
        } catch (addCaught) {
          setRejectedAddChain(true)
          setError(describeWalletError(addCaught))
          return
        }
      }
      setError(describeWalletError(caught))
    }
  }, [rejectedAddChain])

  const clearError = useCallback(() => setError(null), [])

  return { provider, address, chainId, connecting, error, connect, switchToMonadTestnet, clearError }
}

export function walletChainIsSupported(chainId: string | null): boolean {
  return isMonadTestnet(chainId)
}
