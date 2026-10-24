import type { RewardClaim } from '@boai/shared/types'
import type {
  CreditOpRequest,
  LedgerSyncRequest,
  LedgerTeamRequest,
} from '../routes/doProtocol'
import type { Env } from '../routes/env'
import type { SqlStore } from '../storage/sql'
import { LedgerService, asAddress, asHash, isClaimStatus } from './ledgerService'

type Body = Record<string, unknown>

async function readBody(request: Request): Promise<Body> {
  try {
    const parsed: unknown = await request.json()
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Body permintaan harus objek JSON')
    }
    return parsed as Body
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Body permintaan bukan JSON yang valid', { cause: error })
    throw error
  }
}

function text(body: Body, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Field ${field} wajib berupa teks`)
  return value
}

function integer(body: Body, field: string): number {
  const value = body[field]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Field ${field} wajib berupa bilangan bulat`)
  }
  return value
}

function flag(body: Body, field: string): boolean {
  const value = body[field]
  if (typeof value !== 'boolean') throw new Error(`Field ${field} wajib berupa boolean`)
  return value
}

function creditOp(body: Body): CreditOpRequest {
  return { amount: integer(body, 'amount'), ref: text(body, 'ref') }
}

function syncRequest(body: Body): LedgerSyncRequest {
  return { displayName: text(body, 'displayName'), isGuest: flag(body, 'isGuest') }
}

function teamRequest(body: Body): LedgerTeamRequest {
  const agents = body.agents
  if (!Array.isArray(agents) || agents.length !== 5) throw new Error('Tim harus berisi tepat lima agent')
  return { name: text(body, 'name'), agents: agents as LedgerTeamRequest['agents'] }
}

function rewardClaim(body: Body): RewardClaim {
  const matchId = text(body, 'matchId')
  const recipient = asAddress(text(body, 'recipient'))
  const status = text(body, 'status')
  if (!isClaimStatus(status)) throw new Error(`Status klaim tidak dikenali: ${status}`)
  const rawTx = body.txHash
  if (rawTx !== null && typeof rawTx !== 'string') throw new Error('Field txHash wajib berupa teks atau null')
  const txHash = rawTx === null ? null : asHash(rawTx)
  return { matchId, recipient, status, txHash }
}

export class LedgerDurableObject {
  private service: LedgerService | null = null

  constructor(readonly state: DurableObjectState, readonly env: Env) {}

  private ledger(): LedgerService {
    if (!this.service) {
      this.service = new LedgerService(this.state.storage.sql as unknown as SqlStore, Date.now)
    }
    return this.service
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname
      const body = await readBody(request)
      const userId = text(body, 'userId')
      const ledger = this.ledger()
      switch (path) {
        case '/sync':
          return Response.json(ledger.syncProfile(userId, syncRequest(body)))
        case '/team/get':
          return Response.json(ledger.getTeam(userId))
        case '/team/save':
          return Response.json(ledger.saveTeam(userId, teamRequest(body)))
        case '/balance':
          return Response.json(ledger.getBalance(userId))
        case '/reserve':
          return Response.json(ledger.reserve(userId, creditOp(body)))
        case '/settle':
          return Response.json(ledger.settle(userId, creditOp(body)))
        case '/refund':
          return Response.json(ledger.refund(userId, creditOp(body)))
        case '/credit':
          return Response.json(ledger.credit(userId, creditOp(body)))
        case '/purchase':
          return Response.json(ledger.purchaseCosmetic(userId, text(body, 'cosmeticId')))
        case '/owned':
          return Response.json(ledger.listOwned(userId))
        case '/ad':
          return Response.json(ledger.claimAdReward(userId))
        case '/nonce/issue':
          return Response.json(ledger.issueNonce(userId, asAddress(text(body, 'address'))))
        case '/nonce/consume':
          return Response.json(
            ledger.consumeNonce(userId, text(body, 'address'), text(body, 'nonce'), integer(body, 'nowMs')),
          )
        case '/wallet/link':
          return Response.json(
            ledger.linkWallet(userId, asAddress(text(body, 'address')), integer(body, 'verifiedAtMs')),
          )
        case '/wallet/get':
          return Response.json(ledger.getWallet(userId))
        case '/reward/get':
          return Response.json(ledger.getRewardClaim(userId, text(body, 'matchId')))
        case '/reward/upsert':
          return Response.json(
            ledger.upsertRewardClaim(userId, rewardClaim(body), integer(body, 'nowMs')),
          )
        default:
          return Response.json({ error: `Rute tidak dikenali: ${path}` }, { status: 400 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kesalahan tidak terduga'
      return Response.json({ error: message }, { status: 400 })
    }
  }
}
