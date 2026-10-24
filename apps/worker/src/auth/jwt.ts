import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { Env } from '../routes/env'

export interface VerifiedIdentity {
  userId: string
  isGuest: boolean
  displayName: string | null
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function resolveIssuer(env: Env): string | null {
  if (env.SUPABASE_JWT_ISSUER) return env.SUPABASE_JWT_ISSUER.replace(/\/$/, '')
  if (env.SUPABASE_URL) return `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`
  return null
}

function jwksFor(issuer: string) {
  const cached = jwksCache.get(issuer)
  if (cached) return cached
  const created = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  jwksCache.set(issuer, created)
  return created
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

function claimString(payload: JWTPayload, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function verifyRequestIdentity(request: Request, env: Env): Promise<VerifiedIdentity | null> {
  const token = bearerToken(request)
  if (!token) return null
  const issuer = resolveIssuer(env)
  if (!issuer) throw new Error('SUPABASE_NOT_CONFIGURED')

  const audience = env.SUPABASE_JWT_AUDIENCE ?? 'authenticated'
  const { payload } = await jwtVerify(token, jwksFor(issuer), { issuer, audience })

  const userId = claimString(payload, 'sub')
  if (!userId) throw new Error('JWT_MISSING_SUB')

  const metadata = payload.user_metadata
  const displayName =
    metadata && typeof metadata === 'object' && typeof (metadata as Record<string, unknown>).full_name === 'string'
      ? ((metadata as Record<string, unknown>).full_name as string)
      : claimString(payload, 'email')

  const role = claimString(payload, 'role')
  const isAnonymous = payload.is_anonymous === true
  return { userId, isGuest: isAnonymous || role === 'anon', displayName }
}

export function identityFromSupabase(identity: VerifiedIdentity) {
  return { userId: identity.userId, isGuest: identity.isGuest, displayName: identity.displayName ?? 'Pemain BOAI' }
}
