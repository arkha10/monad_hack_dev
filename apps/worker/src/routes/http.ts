import type { ApiEnvelope, ApiError } from '@boai/shared/types'
import type { Env } from './env'

export class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400, readonly retryable = false) {
    super(message)
    this.name = 'HttpError'
  }
}

export function corsHeaders(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.WEB_ORIGIN || '*',
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

export function jsonResponse(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  })
}

export function ok<T>(data: T, env: Env, status = 200): Response {
  const envelope: ApiEnvelope<T> = { data, requestId: crypto.randomUUID() }
  return jsonResponse(envelope, status, env)
}

export function fail(env: Env, code: string, message: string, status = 400, retryable = false): Response {
  const body: ApiError = { error: { code, message, retryable } }
  return jsonResponse(body, status, env)
}

export function errorResponse(env: Env, error: unknown): Response {
  if (error instanceof HttpError) return fail(env, error.code, error.message, error.status, error.retryable)
  const message = error instanceof Error ? error.message : 'Kesalahan tidak terduga'
  return fail(env, 'INTERNAL_ERROR', message, 500, true)
}

export function preflight(env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(env) })
}

export async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text()
  if (text.trim().length === 0) throw new HttpError('INVALID_BODY', 'Body permintaan kosong', 400)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError('INVALID_BODY', 'Body permintaan bukan JSON yang valid', 400)
  }
}

export function requireString(value: unknown, field: string, maxLength = 512): string {
  if (typeof value !== 'string') throw new HttpError('INVALID_FIELD', `Field ${field} wajib berupa teks`, 400)
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new HttpError('INVALID_FIELD', `Field ${field} tidak boleh kosong`, 400)
  if (trimmed.length > maxLength) throw new HttpError('INVALID_FIELD', `Field ${field} melebihi ${maxLength} karakter`, 400)
  return trimmed
}

export function requireInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new HttpError('INVALID_FIELD', `Field ${field} wajib berupa bilangan bulat`, 400)
  if (value < min || value > max) throw new HttpError('INVALID_FIELD', `Field ${field} harus di antara ${min} dan ${max}`, 400)
  return value
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError('INVALID_FIELD', `Field ${field} harus salah satu dari ${allowed.join(', ')}`, 400)
  }
  return value as T
}

export function parseMatchId(raw: string | undefined): string {
  if (!raw) throw new HttpError('INVALID_MATCH_ID', 'matchId wajib disertakan', 400)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw)) throw new HttpError('INVALID_MATCH_ID', 'matchId tidak valid', 400)
  return raw
}
