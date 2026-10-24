import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { ChainAdapter } from '@boai/shared/contracts'
import { BOAI_ARENA_ABI } from './abi'
import {
  AWARD_DEMO_REWARD_GAS_LIMIT,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC_URL,
  RECORD_MATCH_GAS_LIMIT,
  readChainConfig,
  readRelayerKey,
  type ChainConfig,
} from './config'
import {
  ChainRejectedError,
  ChainRetryableError,
  MatchAlreadyRecordedError,
} from './errors'
import { toChainMatchId } from './matchIdHash'

export const monadTestnet: Chain = {
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: 'Monadscan', url: 'https://testnet.monadscan.com' } },
  testnet: true,
}

/** How long to wait for the recording block to reach `finalized` before reporting pending. */
const FINALITY_TIMEOUT_MS = 30_000
const FINALITY_POLL_MS = 1_000

const REVERT_ERROR_NAMES = new Set([
  'MatchNotRecorded',
  'RewardAlreadyClaimed',
  'MatchAlreadyRecorded',
  'InvalidRecipient',
  'EmptyMatchId',
  'ERC20InsufficientBalance',
])

/** RPC text that means "retry", never "the contract refused". */
const RETRYABLE_HINTS = [
  'insufficient funds',
  'reserve balance',
  'nonce too low',
  'nonce has already been used',
  'replacement transaction underpriced',
  'already known',
  'transaction underpriced',
  'timeout',
  'timed out',
  'econnreset',
  'connection reset',
  '429',
  'rate limit',
]

function errorText(error: unknown): string {
  if (error instanceof BaseError) return error.shortMessage
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Maps a viem/RPC failure to one of the three outcomes the API can act on. Monad specifics:
 * a faucet-fresh relayer inside the ~1.2s reserve window fails in a way that must be retried,
 * not reported as a contract rejection.
 */
export function classifyChainError(error: unknown): Error {
  if (error instanceof ContractFunctionExecutionError) {
    const cause = error.cause
    if (cause instanceof ContractFunctionRevertedError) {
      const name = cause.data?.errorName ?? cause.reason ?? ''
      if (REVERT_ERROR_NAMES.has(name)) return new ChainRejectedError(name)
      return new ChainRejectedError(name === '' ? 'execution reverted' : name)
    }
  }

  const text = errorText(error)
  const lowered = text.toLowerCase()
  if (RETRYABLE_HINTS.some(hint => lowered.includes(hint))) return new ChainRetryableError(text)
  return new ChainRetryableError(text)
}

export type ChainAdapterDeps = {
  publicClient: PublicClient
  /** The relayer signer. Constructing the wallet client is the adapter's own business. */
  account: Account
  contractAddress: Address
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function buildClients(
  config: ChainConfig,
  relayerPrivateKey: `0x${string}`,
): { publicClient: PublicClient; account: Account } {
  const transport = http(config.rpcUrl, { retryCount: 2, timeout: 20_000 })
  return {
    publicClient: createPublicClient({ chain: monadTestnet, transport }),
    account: privateKeyToAccount(relayerPrivateKey),
  }
}

/**
 * One reader for both entry points. The frozen ABI exposes no replay-hash getter, and
 * scanning MatchRecorded logs would mean an unbounded range that the public RPC rejects at
 * 100 blocks, so `replayHash` is null rather than a hash this module cannot verify.
 */
function makeGetChainMatch(
  publicClient: PublicClient,
  contractAddress: Address,
): ChainAdapter['getChainMatch'] {
  return async matchId => {
    const id = toChainMatchId(matchId)
    const [exists, claimed] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: BOAI_ARENA_ABI,
        functionName: 'isMatchRecorded',
        args: [id],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: BOAI_ARENA_ABI,
        functionName: 'isRewardClaimed',
        args: [id],
      }),
    ])
    return { exists, replayHash: null, claimed }
  }
}

/**
 * Builds the frozen ChainAdapter over viem. Idempotency lives here: a match already on-chain
 * short-circuits before any write, so a retried API call cannot produce a second transaction.
 */
export function createChainAdapter(config: ChainConfig, deps: ChainAdapterDeps): ChainAdapter {
  const { publicClient, account, contractAddress } = deps
  const sleep = deps.sleep ?? defaultSleep
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(config.rpcUrl, { retryCount: 2, timeout: 20_000 }),
  })
  const readChainMatch = makeGetChainMatch(publicClient, contractAddress)

  async function readRecorded(matchId: `0x${string}`): Promise<boolean> {
    return publicClient.readContract({
      address: contractAddress,
      abi: BOAI_ARENA_ABI,
      functionName: 'isMatchRecorded',
      args: [matchId],
    })
  }

  async function readClaimed(matchId: `0x${string}`): Promise<boolean> {
    return publicClient.readContract({
      address: contractAddress,
      abi: BOAI_ARENA_ABI,
      functionName: 'isRewardClaimed',
      args: [matchId],
    })
  }

  /** `latest` is speculative on Monad, so `confirmed` means the block reached `finalized`. */
  async function waitForFinality(txHash: `0x${string}`): Promise<boolean> {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: FINALITY_TIMEOUT_MS })
    if (receipt.status !== 'success') return false

    const deadline = Date.now() + FINALITY_TIMEOUT_MS
    while (Date.now() < deadline) {
      const finalized = await publicClient.getBlock({ blockTag: 'finalized' })
      if (finalized.number >= receipt.blockNumber) return true
      await sleep(FINALITY_POLL_MS)
    }
    return false
  }

  async function sendAndConfirm(
    write: () => Promise<`0x${string}`>,
  ): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
    let txHash: `0x${string}`
    try {
      txHash = await write()
    } catch (error) {
      throw classifyChainError(error)
    }

    try {
      return { txHash, confirmed: await waitForFinality(txHash) }
    } catch (error) {
      throw classifyChainError(error)
    }
  }

  return {
    async recordMatch(args) {
      const matchId = toChainMatchId(args.matchId)

      if (await readRecorded(matchId)) throw new MatchAlreadyRecordedError(args.matchId)

      return sendAndConfirm(() =>
        walletClient.writeContract({
          account,
          address: contractAddress,
          abi: BOAI_ARENA_ABI,
          functionName: 'recordMatch',
          args: [matchId, args.replayHash, args.resultHash, args.rulesetHash, args.winnerCommitment],
          gas: RECORD_MATCH_GAS_LIMIT,
          chain: monadTestnet,
        }),
      )
    },

    async claimReward(args) {
      const matchId = toChainMatchId(args.matchId)

      if (!(await readRecorded(matchId))) throw new ChainRejectedError('MatchNotRecorded')
      if (await readClaimed(matchId)) throw new ChainRejectedError('RewardAlreadyClaimed')

      return sendAndConfirm(() =>
        walletClient.writeContract({
          account,
          address: contractAddress,
          abi: BOAI_ARENA_ABI,
          functionName: 'awardDemoReward',
          args: [matchId, args.recipient],
          gas: AWARD_DEMO_REWARD_GAS_LIMIT,
          chain: monadTestnet,
        }),
      )
    },

    getChainMatch: readChainMatch,
  }
}

/** Adapter for a Worker env. Throws ChainNotConfiguredError when the address or key is unset. */
export function createChainAdapterFromEnv(env: Record<string, string | undefined>): ChainAdapter {
  const config = readChainConfig(env)
  const { publicClient, account } = buildClients(config, readRelayerKey(env))
  return createChainAdapter(config, { publicClient, account, contractAddress: config.contractAddress })
}

/** Read-only adapter, so an unconfigured relayer key does not block eligibility reads. */
export function createChainReaderFromEnv(
  env: Record<string, string | undefined>,
): Pick<ChainAdapter, 'getChainMatch'> {
  const config = readChainConfig(env)
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(config.rpcUrl, { retryCount: 2, timeout: 20_000 }),
  })

  return { getChainMatch: makeGetChainMatch(publicClient, config.contractAddress) }
}
