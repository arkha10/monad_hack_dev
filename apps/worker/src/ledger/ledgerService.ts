import type { AuthenticatedProfile, CreditBalance, RewardClaim, Team, WalletLink } from '@boai/shared/types'
import { SEED } from '@boai/shared/seed'
import { LEDGER } from '../game/ruleset'
import type {
  AdRewardResponse,
  CreditOpRequest,
  CreditOpResponse,
  LedgerSyncRequest,
  LedgerTeamRequest,
  NonceResponse,
  PurchaseResponse,
} from '../routes/doProtocol'
import { all, one, run, type SqlStore } from '../storage/sql'
import { defaultTeam } from '../storage/team'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profile (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    is_guest INTEGER,
    created_at INTEGER,
    starter_granted INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS team (
    owner_id TEXT PRIMARY KEY,
    team_id TEXT,
    name TEXT,
    agents_json TEXT,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS credit_balance (
    user_id TEXT PRIMARY KEY,
    available INTEGER,
    reserved INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    op TEXT,
    amount INTEGER,
    ref TEXT,
    created_at INTEGER,
    UNIQUE(user_id, op, ref)
  )`,
  `CREATE TABLE IF NOT EXISTS owned_cosmetic (
    user_id TEXT,
    cosmetic_id TEXT,
    acquired_at INTEGER,
    PRIMARY KEY(user_id, cosmetic_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ad_claim (
    user_id TEXT PRIMARY KEY,
    last_claimed_at INTEGER,
    count INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_nonce (
    user_id TEXT PRIMARY KEY,
    address TEXT,
    nonce TEXT,
    message TEXT,
    expires_at INTEGER,
    consumed INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_link (
    user_id TEXT PRIMARY KEY,
    address TEXT UNIQUE,
    chain_id INTEGER,
    verified_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS reward_claim (
    match_id TEXT,
    user_id TEXT,
    recipient TEXT,
    status TEXT,
    tx_hash TEXT,
    updated_at INTEGER,
    PRIMARY KEY(match_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_auth (
    username TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT,
    created_at INTEGER
  )`,
]

const STARTER_REF = 'starter'
const NONCE_TTL_MS = 5 * 60_000
const MONAD_TESTNET_CHAIN_ID = 10143
const WALLET_MESSAGE_TESTNET_LABEL = 'TESTNET - TANPA NILAI UANG'
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HEX_HASH = /^0x[0-9a-fA-F]{64}$/
const CLAIM_STATUSES: readonly RewardClaim['status'][] = [
  'eligible',
  'pending',
  'confirmed',
  'already_claimed',
  'ineligible',
]

type CreditOp = 'credit' | 'reserve' | 'settle' | 'refund'
type Move = { available: number; reserved: number }

interface ProfileRow extends Record<string, string | number | null> {
  display_name: string
  is_guest: number
  starter_granted: number
}
interface TeamRow extends Record<string, string | number | null> {
  team_id: string
  name: string
  agents_json: string
  updated_at: number
}
interface BalanceRow extends Record<string, string | number | null> {
  available: number
  reserved: number
}
interface AdClaimRow extends Record<string, string | number | null> {
  last_claimed_at: number
  count: number
}
interface WalletRow extends Record<string, string | number | null> {
  address: string
  chain_id: number
  verified_at: number
}
interface RewardRow extends Record<string, string | number | null> {
  recipient: string
  status: string
  tx_hash: string | null
}

export function asAddress(value: string): `0x${string}` {
  if (!HEX_ADDRESS.test(value)) throw new Error('Alamat wallet tidak valid')
  return value as `0x${string}`
}

export function isClaimStatus(value: string): value is RewardClaim['status'] {
  return CLAIM_STATUSES.includes(value as RewardClaim['status'])
}

export function asHash(value: string): `0x${string}` {
  if (!HEX_HASH.test(value)) throw new Error('Hash transaksi tidak valid')
  return value as `0x${string}`
}

function applyMovement(balance: Move, op: CreditOp, amount: number): Move | null {
  switch (op) {
    case 'credit': {
      const available = balance.available + amount
      return available < 0 ? null : { available, reserved: balance.reserved }
    }
    case 'reserve':
      if (amount <= 0 || balance.available < amount) return null
      return { available: balance.available - amount, reserved: balance.reserved + amount }
    case 'settle':
      if (amount <= 0 || balance.reserved < amount) return null
      return { available: balance.available, reserved: balance.reserved - amount }
    case 'refund':
      if (amount <= 0 || balance.reserved < amount) return null
      return { available: balance.available + amount, reserved: balance.reserved - amount }
    default: {
      const unreachable: never = op
      return unreachable
    }
  }
}

function refusalReason(op: CreditOp): string {
  return op === 'reserve' || op === 'credit' ? 'Saldo kredit tidak cukup' : 'Dana yang direservasi tidak cukup'
}

function assertAmount(amount: number, allowNegative: boolean): void {
  if (!Number.isInteger(amount) || amount === 0 || (!allowNegative && amount < 0)) {
    throw new Error('Jumlah kredit harus bilangan bulat tidak nol')
  }
}

function assertRef(ref: string): void {
  if (typeof ref !== 'string' || ref.trim().length === 0) throw new Error('Ref transaksi kredit wajib diisi')
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function walletMessage(address: string, nonce: string, expiresAtMs: number): string {
  return [
    'BOAI - Tautkan Wallet',
    `Alamat: ${address}`,
    `Nonce: ${nonce}`,
    `Chain ID: ${MONAD_TESTNET_CHAIN_ID}`,
    WALLET_MESSAGE_TESTNET_LABEL,
    `Kedaluwarsa: ${new Date(expiresAtMs).toISOString()}`,
  ].join('\n')
}

export class LedgerService {
  constructor(private readonly sql: SqlStore, private readonly now: () => number) {
    this.migrate()
  }

  private migrate(): void {
    for (const statement of SCHEMA) run(this.sql, statement)
  }

  private iso(ms: number): string {
    return new Date(ms).toISOString()
  }

  private teamIdFor(userId: string): string {
    return `team-${userId}`
  }

  private readBalance(userId: string): CreditBalance {
    const row = one<BalanceRow>(this.sql, 'SELECT available, reserved FROM credit_balance WHERE user_id = ?', userId)
    return { available: row?.available ?? 0, reserved: row?.reserved ?? 0, unit: 'BOAI_CREDIT' }
  }

  private ensureBalanceRow(userId: string): void {
    run(
      this.sql,
      'INSERT INTO credit_balance (user_id, available, reserved) VALUES (?, 0, 0) ON CONFLICT(user_id) DO NOTHING',
      userId,
    )
  }

  private applyCreditOp(userId: string, op: CreditOp, amount: number, ref: string): CreditOpResponse {
    const applied = one<{ id: string }>(
      this.sql,
      'SELECT id FROM credit_ledger WHERE user_id = ? AND op = ? AND ref = ?',
      userId,
      op,
      ref,
    )
    if (applied) return { ok: true, balance: this.readBalance(userId), reason: null }

    this.ensureBalanceRow(userId)
    const balance = this.readBalance(userId)
    const next = applyMovement(balance, op, amount)
    if (!next) return { ok: false, balance, reason: refusalReason(op) }

    run(
      this.sql,
      'UPDATE credit_balance SET available = ?, reserved = ? WHERE user_id = ?',
      next.available,
      next.reserved,
      userId,
    )
    run(
      this.sql,
      'INSERT INTO credit_ledger (id, user_id, op, amount, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      crypto.randomUUID(),
      userId,
      op,
      amount,
      ref,
      this.now(),
    )
    return { ok: true, balance: { ...next, unit: 'BOAI_CREDIT' }, reason: null }
  }

  registerUser(
    username: string,
    passwordHash: string,
    salt: string,
    newUserId: string,
  ): { ok: boolean; reason?: string; user?: { username: string; userId: string } } {
    return this.sql.transaction(() => {
      const existing = one<{ user_id: string }>(
        this.sql,
        'SELECT user_id FROM user_auth WHERE LOWER(username) = LOWER(?)',
        username,
      )
      if (existing) {
        return { ok: false, reason: 'USERNAME_EXISTS' }
      }
      run(
        this.sql,
        'INSERT INTO user_auth (username, user_id, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
        username,
        newUserId,
        passwordHash,
        salt,
        this.now(),
      )
      return { ok: true, user: { username, userId: newUserId } }
    })
  }

  getUserAuth(username: string): {
    found: boolean
    user?: { username: string; userId: string; passwordHash: string; salt: string }
  } {
    const row = one<{ username: string; user_id: string; password_hash: string; salt: string }>(
      this.sql,
      'SELECT username, user_id, password_hash, salt FROM user_auth WHERE LOWER(username) = LOWER(?)',
      username,
    )
    if (!row) return { found: false }
    return {
      found: true,
      user: {
        username: row.username,
        userId: row.user_id,
        passwordHash: row.password_hash,
        salt: row.salt,
      },
    }
  }

  syncProfile(userId: string, input: LedgerSyncRequest): AuthenticatedProfile {
    return this.sql.transaction(() => {
      run(
        this.sql,
        'INSERT INTO profile (user_id, display_name, is_guest, created_at, starter_granted) VALUES (?, ?, ?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, is_guest = excluded.is_guest',
        userId,
        input.displayName,
        input.isGuest ? 1 : 0,
        this.now(),
      )
      const profile = one<ProfileRow>(
        this.sql,
        'SELECT display_name, is_guest, starter_granted FROM profile WHERE user_id = ?',
        userId,
      )
      if (!profile) throw new Error('Profil tidak dapat dibuat')
      if (profile.starter_granted === 0) {
        this.credit(userId, { amount: LEDGER.starterCredits, ref: STARTER_REF })
        run(this.sql, 'UPDATE profile SET starter_granted = 1 WHERE user_id = ?', userId)
      }
      const team = one<{ team_id: string }>(this.sql, 'SELECT team_id FROM team WHERE owner_id = ?', userId)
      return {
        userId,
        displayName: profile.display_name,
        isGuest: profile.is_guest === 1,
        teamId: team?.team_id ?? null,
      }
    })
  }

  private readTeam(userId: string): Team | null {
    const row = one<TeamRow>(
      this.sql,
      'SELECT team_id, name, agents_json, updated_at FROM team WHERE owner_id = ?',
      userId,
    )
    if (!row) return null
    return {
      id: row.team_id,
      ownerId: userId,
      name: row.name,
      agents: JSON.parse(row.agents_json) as Team['agents'],
      updatedAt: this.iso(row.updated_at),
    }
  }

  private persistTeam(userId: string, id: string, name: string, agents: Team['agents']): Team {
    const updatedAt = this.now()
    run(
      this.sql,
      'INSERT INTO team (owner_id, team_id, name, agents_json, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET team_id = excluded.team_id, name = excluded.name, agents_json = excluded.agents_json, updated_at = excluded.updated_at',
      userId,
      id,
      name,
      JSON.stringify(agents),
      updatedAt,
    )
    return { id, ownerId: userId, name, agents, updatedAt: this.iso(updatedAt) }
  }

  getTeam(userId: string): Team {
    const existing = this.readTeam(userId)
    if (existing) return existing
    const teamId = this.teamIdFor(userId)
    const seed = defaultTeam(teamId, userId)
    return this.sql.transaction(() => this.persistTeam(userId, seed.id, seed.name, seed.agents))
  }

  saveTeam(userId: string, input: LedgerTeamRequest): Team {
    return this.sql.transaction(() =>
      this.persistTeam(userId, this.teamIdFor(userId), input.name, input.agents),
    )
  }

  getBalance(userId: string): CreditBalance {
    return this.readBalance(userId)
  }

  reserve(userId: string, req: CreditOpRequest): CreditOpResponse {
    assertAmount(req.amount, false)
    assertRef(req.ref)
    return this.sql.transaction(() => this.applyCreditOp(userId, 'reserve', req.amount, req.ref))
  }

  settle(userId: string, req: CreditOpRequest): CreditOpResponse {
    assertAmount(req.amount, false)
    assertRef(req.ref)
    return this.sql.transaction(() => this.applyCreditOp(userId, 'settle', req.amount, req.ref))
  }

  refund(userId: string, req: CreditOpRequest): CreditOpResponse {
    assertAmount(req.amount, false)
    assertRef(req.ref)
    return this.sql.transaction(() => this.applyCreditOp(userId, 'refund', req.amount, req.ref))
  }

  credit(userId: string, req: CreditOpRequest): CreditOpResponse {
    // A negative amount debits available, which is the path purchaseCosmetic charges through.
    assertAmount(req.amount, true)
    assertRef(req.ref)
    return this.sql.transaction(() => this.applyCreditOp(userId, 'credit', req.amount, req.ref))
  }

  listOwned(userId: string): string[] {
    return all<{ cosmetic_id: string }>(
      this.sql,
      'SELECT cosmetic_id FROM owned_cosmetic WHERE user_id = ? ORDER BY acquired_at, cosmetic_id',
      userId,
    ).map(row => row.cosmetic_id)
  }

  purchaseCosmetic(userId: string, cosmeticId: string): PurchaseResponse {
    const cosmetic = SEED.cosmetics.find(item => item.id === cosmeticId)
    if (!cosmetic) throw new Error('Item kosmetik tidak dikenali')
    return this.sql.transaction(() => {
      const owned = this.listOwned(userId)
      if (owned.includes(cosmetic.id)) {
        return { ok: true, ownedCosmeticIds: owned, balance: this.readBalance(userId), reason: null }
      }
      if (cosmetic.priceCredits > 0) {
        const charged = this.credit(userId, { amount: -cosmetic.priceCredits, ref: `cosmetic:${cosmetic.id}` })
        if (!charged.ok) {
          return { ok: false, ownedCosmeticIds: owned, balance: charged.balance, reason: charged.reason }
        }
      }
      run(
        this.sql,
        'INSERT INTO owned_cosmetic (user_id, cosmetic_id, acquired_at) VALUES (?, ?, ?) ON CONFLICT(user_id, cosmetic_id) DO NOTHING',
        userId,
        cosmetic.id,
        this.now(),
      )
      return { ok: true, ownedCosmeticIds: this.listOwned(userId), balance: this.readBalance(userId), reason: null }
    })
  }

  claimAdReward(userId: string): AdRewardResponse {
    return this.sql.transaction(() => {
      const nowMs = this.now()
      const claim = one<AdClaimRow>(
        this.sql,
        'SELECT last_claimed_at, count FROM ad_claim WHERE user_id = ?',
        userId,
      )
      if (claim && nowMs - claim.last_claimed_at < LEDGER.adCooldownMs) {
        return {
          balance: this.readBalance(userId),
          nextEligibleAt: this.iso(claim.last_claimed_at + LEDGER.adCooldownMs),
        }
      }
      this.credit(userId, { amount: LEDGER.adRewardCredits, ref: `ad:${nowMs}` })
      run(
        this.sql,
        'INSERT INTO ad_claim (user_id, last_claimed_at, count) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET last_claimed_at = excluded.last_claimed_at, count = ad_claim.count + 1',
        userId,
        nowMs,
      )
      return { balance: this.readBalance(userId), nextEligibleAt: this.iso(nowMs + LEDGER.adCooldownMs) }
    })
  }

  issueNonce(userId: string, address: `0x${string}`): NonceResponse {
    const normalized = asAddress(address).toLowerCase()
    const nowMs = this.now()
    const nonce = randomNonce()
    const expiresAtMs = nowMs + NONCE_TTL_MS
    const message = walletMessage(normalized, nonce, expiresAtMs)
    run(
      this.sql,
      'INSERT INTO wallet_nonce (user_id, address, nonce, message, expires_at, consumed) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, nonce = excluded.nonce, message = excluded.message, expires_at = excluded.expires_at, consumed = 0',
      userId,
      normalized,
      nonce,
      message,
      expiresAtMs,
    )
    return { nonce, message, expiresAt: this.iso(expiresAtMs) }
  }

  currentNonce(userId: string, address: string, nowMs: number): NonceResponse | null {
    const row = one<{ address: string; nonce: string; message: string; expires_at: number; consumed: number }>(
      this.sql,
      'SELECT address, nonce, message, expires_at, consumed FROM wallet_nonce WHERE user_id = ?',
      userId,
    )
    if (!row) return null
    if (row.consumed !== 0) return null
    if (row.expires_at <= nowMs) return null
    if (row.address.toLowerCase() !== address.toLowerCase()) return null
    return { nonce: row.nonce, message: row.message, expiresAt: this.iso(row.expires_at) }
  }

  consumeNonce(userId: string, address: string, nonce: string, nowMs: number): boolean {
    return this.sql.transaction(() => {
      const rows = all<{ user_id: string }>(
        this.sql,
        'UPDATE wallet_nonce SET consumed = 1 WHERE user_id = ? AND nonce = ? AND lower(address) = lower(?) AND consumed = 0 AND expires_at > ? RETURNING user_id',
        userId,
        nonce,
        address,
        nowMs,
      )
      return rows.length === 1
    })
  }

  linkWallet(userId: string, address: `0x${string}`, verifiedAtMs: number): WalletLink {
    const normalized = asAddress(address).toLowerCase()
    try {
      this.sql.transaction(() => {
        run(
          this.sql,
          'INSERT INTO wallet_link (user_id, address, chain_id, verified_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, chain_id = excluded.chain_id, verified_at = excluded.verified_at',
          userId,
          normalized,
          MONAD_TESTNET_CHAIN_ID,
          verifiedAtMs,
        )
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: wallet_link.address')) {
        throw new Error('Alamat wallet sudah terhubung ke akun lain', { cause: error })
      }
      throw error
    }
    return {
      address: normalized as `0x${string}`,
      chainId: MONAD_TESTNET_CHAIN_ID,
      verifiedAt: this.iso(verifiedAtMs),
    }
  }

  getWallet(userId: string): WalletLink | null {
    const row = one<WalletRow>(this.sql, 'SELECT address, chain_id, verified_at FROM wallet_link WHERE user_id = ?', userId)
    if (!row) return null
    return { address: asAddress(row.address), chainId: row.chain_id, verifiedAt: this.iso(row.verified_at) }
  }

  getRewardClaim(userId: string, matchId: string): RewardClaim | null {
    const row = one<RewardRow>(
      this.sql,
      'SELECT recipient, status, tx_hash FROM reward_claim WHERE match_id = ? AND user_id = ?',
      matchId,
      userId,
    )
    if (!row) return null
    if (!isClaimStatus(row.status)) throw new Error(`Status klaim tidak dikenali: ${row.status}`)
    return {
      matchId,
      recipient: asAddress(row.recipient),
      txHash: row.tx_hash === null ? null : asHash(row.tx_hash),
      status: row.status,
    }
  }

  upsertRewardClaim(userId: string, claim: RewardClaim, nowMs: number): RewardClaim {
    return this.sql.transaction(() => {
      run(
        this.sql,
        'INSERT INTO reward_claim (match_id, user_id, recipient, status, tx_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(match_id, user_id) DO UPDATE SET recipient = excluded.recipient, status = excluded.status, tx_hash = excluded.tx_hash, updated_at = excluded.updated_at',
        claim.matchId,
        userId,
        claim.recipient,
        claim.status,
        claim.txHash,
        nowMs,
      )
      return claim
    })
  }
}
