import { beforeEach, describe, expect, it } from 'vitest'
import { LedgerDurableObject } from '../src/ledger/ledgerDo'
import { LedgerService } from '../src/ledger/ledgerService'
import type { Env } from '../src/routes/env'
import type { SqlValue } from '../src/storage/sql'
import { MemorySqlStore } from '../src/testing/memorySql'

const USER = '00000000-0000-4000-8000-000000000101'
const OTHER_USER = '00000000-0000-4000-8000-000000000102'
const ADDRESS: `0x${string}` = '0x00000000000000000000000000000000000000aa'
const OTHER_ADDRESS: `0x${string}` = '0x00000000000000000000000000000000000000bb'

let clock = 1_700_000_000_000
let sql: MemorySqlStore
let ledger: LedgerService

function advance(ms: number): void {
  clock += ms
}

function sync(userId: string) {
  return ledger.syncProfile(userId, { displayName: 'Pemain', isGuest: true })
}

function callDo(path: string, body: unknown): Promise<Response> {
  const state = {
    storage: {
      sql: {
        exec: (query: string, ...bindings: SqlValue[]) => sql.exec(query, ...bindings),
      },
      transactionSync: (closure: () => unknown) => sql.transaction(closure),
    },
  } as unknown as DurableObjectState
  const durableObject = new LedgerDurableObject(state, {} as Env)
  return durableObject.fetch(
    new Request(`https://ledger.internal${path}`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

beforeEach(() => {
  clock = 1_700_000_000_000
  sql = new MemorySqlStore()
  ledger = new LedgerService(sql, () => clock)
})

describe('starter credits', () => {
  it('grants the starter credits exactly once across three syncs', () => {
    sync(USER)
    sync(USER)
    const profile = sync(USER)

    expect(profile).toEqual({
      userId: USER,
      displayName: 'Pemain',
      isGuest: true,
      teamId: null,
    })
    expect(ledger.getBalance(USER)).toEqual({ available: 100, reserved: 0, unit: 'BOAI_CREDIT' })
  })

  it('grants a separate starter balance to each user', () => {
    sync(USER)
    sync(OTHER_USER)

    expect(ledger.getBalance(OTHER_USER)).toEqual({ available: 100, reserved: 0, unit: 'BOAI_CREDIT' })
  })
})

describe('reserve', () => {
  it('moves funds once for a repeated ref', () => {
    sync(USER)
    const first = ledger.reserve(USER, { amount: 30, ref: 'queue:match-1' })
    const replay = ledger.reserve(USER, { amount: 30, ref: 'queue:match-1' })

    expect(first).toEqual({
      ok: true,
      balance: { available: 70, reserved: 30, unit: 'BOAI_CREDIT' },
      reason: null,
    })
    expect(replay).toEqual(first)
    expect(ledger.getBalance(USER)).toEqual({ available: 70, reserved: 30, unit: 'BOAI_CREDIT' })
  })

  it('refuses a different ref when available funds are short and leaves the balance untouched', () => {
    sync(USER)
    ledger.reserve(USER, { amount: 30, ref: 'queue:match-1' })

    const refused = ledger.reserve(USER, { amount: 80, ref: 'queue:match-2' })

    expect(refused).toEqual({
      ok: false,
      balance: { available: 70, reserved: 30, unit: 'BOAI_CREDIT' },
      reason: 'Saldo kredit tidak cukup',
    })
    expect(ledger.getBalance(USER)).toEqual({ available: 70, reserved: 30, unit: 'BOAI_CREDIT' })
  })

  it('applies two different refs when funds allow', () => {
    sync(USER)
    ledger.reserve(USER, { amount: 30, ref: 'queue:match-1' })
    const second = ledger.reserve(USER, { amount: 20, ref: 'queue:match-2' })

    expect(second).toEqual({
      ok: true,
      balance: { available: 50, reserved: 50, unit: 'BOAI_CREDIT' },
      reason: null,
    })
  })
})

describe('settle and refund', () => {
  it('cannot inflate the balance when refund follows settle under the same ref', () => {
    sync(USER)
    ledger.reserve(USER, { amount: 40, ref: 'stake:match-1' })

    const settled = ledger.settle(USER, { amount: 40, ref: 'stake:match-1' })
    const refunded = ledger.refund(USER, { amount: 40, ref: 'stake:match-1' })

    expect(settled).toEqual({
      ok: true,
      balance: { available: 60, reserved: 0, unit: 'BOAI_CREDIT' },
      reason: null,
    })
    expect(refunded).toEqual({
      ok: false,
      balance: { available: 60, reserved: 0, unit: 'BOAI_CREDIT' },
      reason: 'Dana yang direservasi tidak cukup',
    })
    expect(ledger.getBalance(USER)).toEqual({ available: 60, reserved: 0, unit: 'BOAI_CREDIT' })
  })

  it('returns reserved funds to available on refund', () => {
    sync(USER)
    ledger.reserve(USER, { amount: 40, ref: 'stake:match-2' })

    expect(ledger.refund(USER, { amount: 40, ref: 'stake:match-2' })).toEqual({
      ok: true,
      balance: { available: 100, reserved: 0, unit: 'BOAI_CREDIT' },
      reason: null,
    })
  })
})

describe('cosmetics', () => {
  it('keeps one inventory entry and one charge when the same item is purchased twice', () => {
    sync(USER)
    ledger.credit(USER, { amount: 50, ref: 'reward:match-1' })

    const first = ledger.purchaseCosmetic(USER, 'effect-spark-demo')
    const second = ledger.purchaseCosmetic(USER, 'effect-spark-demo')

    expect(first).toEqual({
      ok: true,
      ownedCosmeticIds: ['effect-spark-demo'],
      balance: { available: 150, reserved: 0, unit: 'BOAI_CREDIT' },
      reason: null,
    })
    expect(second).toEqual(first)
    expect(ledger.listOwned(USER)).toEqual(['effect-spark-demo'])
  })

  it('deducts a repeated purchase ref at most once', () => {
    sync(USER)

    const charged = ledger.credit(USER, { amount: -40, ref: 'cosmetic:skin-premium-demo' })
    const replayed = ledger.credit(USER, { amount: -40, ref: 'cosmetic:skin-premium-demo' })

    expect(charged).toEqual({
      ok: true,
      balance: { available: 60, reserved: 0, unit: 'BOAI_CREDIT' },
      reason: null,
    })
    expect(replayed).toEqual(charged)
  })

  it('refuses an unknown cosmetic id', () => {
    sync(USER)

    expect(() => ledger.purchaseCosmetic(USER, 'skin-does-not-exist')).toThrow('Item kosmetik tidak dikenali')
    expect(ledger.listOwned(USER)).toEqual([])
  })
})

describe('simulated ad reward', () => {
  it('grants once inside the cooldown and again after it elapses', () => {
    sync(USER)

    const first = ledger.claimAdReward(USER)
    const blocked = ledger.claimAdReward(USER)

    expect(first).toEqual({
      balance: { available: 115, reserved: 0, unit: 'BOAI_CREDIT' },
      nextEligibleAt: '2023-11-14T22:14:20.000Z',
    })
    expect(blocked).toEqual({
      balance: { available: 115, reserved: 0, unit: 'BOAI_CREDIT' },
      nextEligibleAt: '2023-11-14T22:14:20.000Z',
    })

    advance(60_000)
    const afterCooldown = ledger.claimAdReward(USER)

    expect(afterCooldown).toEqual({
      balance: { available: 130, reserved: 0, unit: 'BOAI_CREDIT' },
      nextEligibleAt: '2023-11-14T22:15:20.000Z',
    })
  })
})

describe('wallet nonce', () => {
  it('accepts a nonce once and rejects the replay', () => {
    const issued = ledger.issueNonce(USER, ADDRESS)

    expect(issued.nonce).toMatch(/^[0-9a-f]{64}$/)
    expect(issued.expiresAt).toBe('2023-11-14T22:18:20.000Z')
    expect(issued.message).toContain(ADDRESS)
    expect(issued.message).toContain(issued.nonce)
    expect(issued.message).toContain('Chain ID: 10143')
    expect(issued.message).toContain('TESTNET - TANPA NILAI UANG')

    expect(ledger.consumeNonce(USER, ADDRESS, issued.nonce, clock)).toBe(true)
    expect(ledger.consumeNonce(USER, ADDRESS, issued.nonce, clock)).toBe(false)
  })

  it('rejects an expired nonce', () => {
    const issued = ledger.issueNonce(USER, ADDRESS)
    advance(5 * 60_000 + 1)

    expect(ledger.consumeNonce(USER, ADDRESS, issued.nonce, clock)).toBe(false)
  })

  it('rejects a nonce presented with a different address', () => {
    const issued = ledger.issueNonce(USER, ADDRESS)

    expect(ledger.consumeNonce(USER, OTHER_ADDRESS, issued.nonce, clock)).toBe(false)
    expect(ledger.consumeNonce(USER, ADDRESS, issued.nonce, clock)).toBe(true)
  })
})

describe('wallet link', () => {
  it('rejects linking one address to a second user and keeps the first link', () => {
    const first = ledger.linkWallet(USER, ADDRESS, clock)

    expect(first).toEqual({
      address: ADDRESS,
      chainId: 10143,
      verifiedAt: '2023-11-14T22:13:20.000Z',
    })
    expect(() => ledger.linkWallet(OTHER_USER, ADDRESS, clock)).toThrow('Alamat wallet sudah terhubung ke akun lain')
    expect(ledger.getWallet(USER)).toEqual(first)
    expect(ledger.getWallet(OTHER_USER)).toBeNull()
  })
})

describe('team ownership', () => {
  it('saves a team for one owner without touching another owner', () => {
    sync(USER)
    sync(OTHER_USER)
    const template = ledger.getTeam(OTHER_USER)

    const saved = ledger.saveTeam(USER, { name: 'Tim Garuda', agents: template.agents })

    expect(saved.name).toBe('Tim Garuda')
    expect(saved.ownerId).toBe(USER)
    expect(saved.id).toBe(`team-${USER}`)
    expect(ledger.getTeam(USER).name).toBe('Tim Garuda')
    expect(ledger.getTeam(OTHER_USER).name).toBe('Tim BOAI')
    expect(ledger.getTeam(OTHER_USER).id).toBe(`team-${OTHER_USER}`)
  })

  it('creates and persists a default team with five agents', () => {
    const team = ledger.getTeam(USER)

    expect(team.id).toBe(`team-${USER}`)
    expect(team.ownerId).toBe(USER)
    expect(team.name).toBe('Tim BOAI')
    expect(team.agents).toHaveLength(5)
    expect(ledger.getTeam(USER)).toEqual(team)
    expect(sync(USER).teamId).toBe(`team-${USER}`)
  })
})

describe('reward claims', () => {
  it('round-trips a claim and overwrites it on re-upsert', () => {
    const claim = {
      matchId: 'match-boai-pvp-001',
      recipient: ADDRESS,
      txHash: null,
      status: 'eligible' as const,
    }

    expect(ledger.upsertRewardClaim(USER, claim, clock)).toEqual(claim)
    expect(ledger.getRewardClaim(USER, 'match-boai-pvp-001')).toEqual(claim)
    expect(ledger.getRewardClaim(OTHER_USER, 'match-boai-pvp-001')).toBeNull()

    const confirmed = { ...claim, status: 'confirmed' as const, txHash: `0x${'11'.repeat(32)}` as `0x${string}` }
    ledger.upsertRewardClaim(USER, confirmed, clock)

    expect(ledger.getRewardClaim(USER, 'match-boai-pvp-001')).toEqual(confirmed)
  })
})

describe('schema', () => {
  it('is idempotent across two service instances on the same store', () => {
    sync(USER)
    const second = new LedgerService(sql, () => clock)

    expect(second.getBalance(USER)).toEqual({ available: 100, reserved: 0, unit: 'BOAI_CREDIT' })
    expect(second.syncProfile(USER, { displayName: 'Pemain', isGuest: true }).userId).toBe(USER)
    expect(second.getBalance(USER)).toEqual({ available: 100, reserved: 0, unit: 'BOAI_CREDIT' })
  })

  it('rejects a duplicate ledger row for the same user, op and ref', () => {
    sync(USER)
    const insert = (id: string) =>
      sql.exec(
        'INSERT INTO credit_ledger (id, user_id, op, amount, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        USER,
        'reserve',
        10,
        'queue:match-1',
        clock,
      )

    insert('ledger-a')

    expect(() => insert('ledger-b')).toThrow('UNIQUE constraint failed: credit_ledger.user_id, credit_ledger.op, credit_ledger.ref')
  })
})

describe('durable object dispatch', () => {
  it('routes sync, balance, reserve and purchase to the service', async () => {
    const synced = await callDo('/sync', { userId: USER, displayName: 'Pemain', isGuest: true })
    expect(await synced.json()).toEqual({
      userId: USER,
      displayName: 'Pemain',
      isGuest: true,
      teamId: null,
    })

    const reserved = await callDo('/reserve', { userId: USER, amount: 25, ref: 'queue:match-9' })
    expect(await reserved.json()).toEqual({
      ok: true,
      balance: { available: 75, reserved: 25, unit: 'BOAI_CREDIT' },
      reason: null,
    })

    const balance = await callDo('/balance', { userId: USER })
    expect(await balance.json()).toEqual({ available: 75, reserved: 25, unit: 'BOAI_CREDIT' })

    const purchased = await callDo('/purchase', { userId: USER, cosmeticId: 'skin-default-blue' })
    expect(await purchased.json()).toEqual({
      ok: true,
      ownedCosmeticIds: ['skin-default-blue'],
      balance: { available: 75, reserved: 25, unit: 'BOAI_CREDIT' },
      reason: null,
    })

    const owned = await callDo('/owned', { userId: USER })
    expect(await owned.json()).toEqual(['skin-default-blue'])
  })

  it('answers an unknown path with a 400 error body', async () => {
    const response = await callDo('/does-not-exist', { userId: USER })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Rute tidak dikenali: /does-not-exist' })
  })

  it('answers a malformed body with a 400 error body instead of throwing', async () => {
    const response = await callDo('/reserve', { userId: USER, amount: '25', ref: 'queue:match-9' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Field amount wajib berupa bilangan bulat' })
  })

  it('answers a rejected wallet link with a 400 error body and keeps the first link', async () => {
    await callDo('/wallet/link', { userId: USER, address: ADDRESS, verifiedAtMs: clock })
    const rejected = await callDo('/wallet/link', { userId: OTHER_USER, address: ADDRESS, verifiedAtMs: clock })

    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toEqual({ error: 'Alamat wallet sudah terhubung ke akun lain' })

    const first = await callDo('/wallet/get', { userId: USER })
    expect(await first.json()).toEqual({
      address: ADDRESS,
      chainId: 10143,
      verifiedAt: '2023-11-14T22:13:20.000Z',
    })

    const second = await callDo('/wallet/get', { userId: OTHER_USER })
    expect(await second.json()).toBeNull()
  })

  it('issues a nonce and consumes it once through the DO', async () => {
    const issued = await callDo('/nonce/issue', { userId: USER, address: ADDRESS })
    const nonceResponse = (await issued.json()) as { nonce: string }

    const first = await callDo('/nonce/consume', {
      userId: USER,
      address: ADDRESS,
      nonce: nonceResponse.nonce,
      nowMs: clock,
    })
    expect(await first.json()).toBe(true)

    const replay = await callDo('/nonce/consume', {
      userId: USER,
      address: ADDRESS,
      nonce: nonceResponse.nonce,
      nowMs: clock,
    })
    expect(await replay.json()).toBe(false)
  })

  it('stores and reads back a team through the DO', async () => {
    const template = ledger.getTeam(OTHER_USER)
    const saved = await callDo('/team/save', { userId: USER, name: 'Tim Garuda', agents: template.agents })

    expect((await saved.json() as { name: string }).name).toBe('Tim Garuda')

    const read = await callDo('/team/get', { userId: USER })
    expect((await read.json() as { id: string }).id).toBe(`team-${USER}`)
  })

  it('registers and looks up user credentials via /auth/register and /auth/get', async () => {
    const regRes = await callDo('/auth/register', {
      userId: 'auth_registry',
      username: 'player_one',
      passwordHash: 'hash123',
      salt: 'salt123',
      newUserId: 'u-player-1',
    })
    expect(await regRes.json()).toEqual({
      ok: true,
      user: { username: 'player_one', userId: 'u-player-1' },
    })

    const dupRes = await callDo('/auth/register', {
      userId: 'auth_registry',
      username: 'PLAYER_ONE',
      passwordHash: 'hash999',
      salt: 'salt999',
      newUserId: 'u-player-2',
    })
    expect(await dupRes.json()).toEqual({
      ok: false,
      reason: 'USERNAME_EXISTS',
    })

    const getRes = await callDo('/auth/get', {
      userId: 'auth_registry',
      username: 'Player_One',
    })
    expect(await getRes.json()).toEqual({
      found: true,
      user: {
        username: 'player_one',
        userId: 'u-player-1',
        passwordHash: 'hash123',
        salt: 'salt123',
      },
    })

    const notFound = await callDo('/auth/get', {
      userId: 'auth_registry',
      username: 'nonexistent_user',
    })
    expect(await notFound.json()).toEqual({ found: false })
  })
})
