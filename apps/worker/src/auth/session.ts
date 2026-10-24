import type { Env } from '../routes/env'
import { HttpError } from '../routes/http'
import { verifyRequestIdentity, type VerifiedIdentity } from './jwt'

const SESSION_COOKIE = 'boai_session'

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function hmacKey(env: Env): Promise<CryptoKey> {
  const secret = env.CHAIN_INTERNAL_SECRET ?? 'boai-local-dev-secret-not-for-production'
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

export async function issueDevSession(env: Env, userId: string): Promise<string> {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ sub: userId, iat: Date.now() })))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(payload))
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`
}

async function readDevSession(env: Env, request: Request): Promise<VerifiedIdentity | null> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return null
  const [payload, signature] = raw.split('.')
  if (!payload || !signature) return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env),
    decodeBase64Url(signature),
    new TextEncoder().encode(payload),
  )
  if (!valid) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { sub?: string }
    if (!parsed.sub) return null
    return { userId: parsed.sub, isGuest: true, displayName: 'Pemain Tamu' }
  } catch {
    return null
  }
}

export interface ResolvedIdentity extends VerifiedIdentity {
  sessionToken: string | null
}

export async function resolveIdentity(request: Request, env: Env): Promise<ResolvedIdentity | null> {
  try {
    const verified = await verifyRequestIdentity(request, env)
    if (verified) return { ...verified, sessionToken: null }
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPABASE_NOT_CONFIGURED') {
      const dev = await readDevSession(env, request)
      return dev ? { ...dev, sessionToken: null } : null
    }
    throw new HttpError('UNAUTHORIZED', 'Token sesi tidak valid atau kedaluwarsa', 401)
  }
  const dev = await readDevSession(env, request)
  return dev ? { ...dev, sessionToken: null } : null
}

export async function requireIdentity(request: Request, env: Env): Promise<ResolvedIdentity> {
  const identity = await resolveIdentity(request, env)
  if (!identity) throw new HttpError('UNAUTHORIZED', 'Sesi tidak ditemukan. Masuk sebagai tamu atau Google.', 401)
  return identity
}

export function devSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}
