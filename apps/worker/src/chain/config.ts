import { getAddress, isAddress } from 'viem'
import { ChainNotConfiguredError } from './errors'

export const MONAD_TESTNET_CHAIN_ID = 10143
export const MONAD_TESTNET_RPC_URL = 'https://testnet-rpc.monad.xyz'

/**
 * Gas limits are explicit and derived from measurement, because Monad charges the gas
 * *limit*, not the gas used, so an inflated estimate is real money. Measured with
 * `forge test --root contracts --network monad -vvvv` on solc 0.8.28:
 *   recordMatch      109,325 gas (five cold slot writes plus the event)
 *   awardDemoReward   81,138 gas (status write plus one ERC20 mint)
 * The limits add ~37% and ~48% headroom over those cold-path measurements, which also
 * covers the 21,000 intrinsic cost and calldata.
 */
export const RECORD_MATCH_GAS_LIMIT = 150_000n
export const AWARD_DEMO_REWARD_GAS_LIMIT = 120_000n

/**
 * Monad caps `eth_getLogs` at 100 blocks on the public RPC. Nothing here scans logs, and a
 * future scan must chunk to this window rather than ask for an open range.
 */
export const MAX_GET_LOGS_BLOCK_RANGE = 100n

/** Monad's per-EOA reserve floor. Below it an account sends at most one tx per ~1.2s. */
export const MONAD_RESERVE_BALANCE_WEI = 10n * 10n ** 18n

export type ChainConfig = {
  rpcUrl: string
  chainId: number
  contractAddress: `0x${string}`
}

function readValue(env: Record<string, string | undefined>, name: string): string | null {
  const value = env[name]
  return value === undefined || value.trim().length === 0 ? null : value.trim()
}

/**
 * Connection config, parsed once at the boundary. A read-only caller needs nothing else.
 * The build is Testnet-only, so a non-10143 chain id is treated as unconfigured rather
 * than silently pointed at mainnet.
 */
export function readChainConfig(env: Record<string, string | undefined>): ChainConfig {
  const missing: string[] = []

  const contractRaw = readValue(env, 'BOAI_CONTRACT_ADDRESS')
  if (contractRaw === null || !isAddress(contractRaw)) missing.push('BOAI_CONTRACT_ADDRESS')

  let chainId = MONAD_TESTNET_CHAIN_ID
  const chainIdRaw = readValue(env, 'MONAD_CHAIN_ID')
  if (chainIdRaw !== null) {
    const parsed = Number(chainIdRaw)
    if (parsed === MONAD_TESTNET_CHAIN_ID) chainId = parsed
    else missing.push('MONAD_CHAIN_ID')
  }

  if (missing.length > 0) throw new ChainNotConfiguredError(missing)

  return {
    rpcUrl: readValue(env, 'MONAD_RPC_URL') ?? MONAD_TESTNET_RPC_URL,
    chainId,
    contractAddress: getAddress(contractRaw as string),
  }
}

/** The relayer signer. Only a write path needs this, so a read path stays usable. */
export function readRelayerKey(env: Record<string, string | undefined>): `0x${string}` {
  const value = readValue(env, 'CHAIN_RELAYER_PRIVATE_KEY')
  if (value === null) throw new ChainNotConfiguredError(['CHAIN_RELAYER_PRIVATE_KEY'])
  return value as `0x${string}`
}

/** Server-held salt for the winner commitment. Never leaves the Worker. */
export function readCommitmentSalt(env: Record<string, string | undefined>): string {
  const value = readValue(env, 'BOAI_COMMITMENT_SALT')
  if (value === null) throw new ChainNotConfiguredError(['BOAI_COMMITMENT_SALT'])
  return value
}

/** True when the deployment is wired to a chain at all. The UI labels the other case. */
export function isChainConfigured(env: Record<string, string | undefined>): boolean {
  try {
    readChainConfig(env)
    return true
  } catch {
    return false
  }
}
