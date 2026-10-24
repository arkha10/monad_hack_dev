import type { QueueJoinRequest } from './doProtocol'
import type { Env } from './env'
import { HttpError } from './http'

export type StubFetch = (request: Request) => Promise<Response>

interface DoErrorBody {
  error?: { code?: string; message?: string; retryable?: boolean } | string
  code?: string
  message?: string
}

export interface WinnerResponse {
  userId: string | null
}

export type PairTakeResponse = {
  matchId: string
  red: QueueJoinRequest
  blue: QueueJoinRequest
} | null

function parseErrorBody(text: string): DoErrorBody {
  if (text.length === 0) return {}
  try {
    return JSON.parse(text) as DoErrorBody
  } catch {
    return {}
  }
}

function toHttpError(status: number, text: string): HttpError {
  const parsed = parseErrorBody(text)
  const nested = typeof parsed.error === 'object' ? parsed.error : undefined
  const code = nested?.code ?? parsed.code ?? 'DO_ERROR'
  const message =
    nested?.message ?? (typeof parsed.error === 'string' ? parsed.error : undefined) ?? parsed.message ?? `Durable Object menolak permintaan (${status})`
  return new HttpError(code, message, status, nested?.retryable ?? false)
}

async function callStub<T>(
  namespace: DurableObjectNamespace,
  name: string,
  path: string,
  body: unknown,
  fetchImpl?: StubFetch,
): Promise<T> {
  const stub = namespace.get(namespace.idFromName(name))
  const request = new Request(`https://do.internal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const response = await (fetchImpl ?? ((input: Request) => stub.fetch(input)))(request)
  const text = await response.text()
  if (!response.ok) throw toHttpError(response.status, text)
  if (text.length === 0) return undefined as T
  return JSON.parse(text) as T
}

/** The ledger DO reads userId from the body on every path, including its read-only ones. */
export function ledgerFetch<T = unknown>(
  env: Env,
  userId: string,
  path: string,
  body: Record<string, unknown> = {},
  fetchImpl?: StubFetch,
): Promise<T> {
  return callStub<T>(env.LEDGER, userId, path, { userId, ...body }, fetchImpl)
}

/** The match DO addresses itself as /:matchId/:route, so the id must lead the path. */
export function matchFetch<T = unknown>(
  env: Env,
  matchId: string,
  path: string,
  body?: unknown,
  fetchImpl?: StubFetch,
): Promise<T> {
  return callStub<T>(env.MATCHES, matchId, `/${encodeURIComponent(matchId)}${path}`, body, fetchImpl)
}

export function matchmakerFetch<T = unknown>(env: Env, path: string, body?: unknown, fetchImpl?: StubFetch): Promise<T> {
  return callStub<T>(env.MATCHMAKER, 'global', path, body, fetchImpl)
}

/** The matchmaker reads its query params on GET, so a GET call carries no body. */
export function matchmakerGet<T = unknown>(env: Env, path: string, fetchImpl?: StubFetch): Promise<T> {
  return callStub<T>(env.MATCHMAKER, 'global', path, undefined, fetchImpl)
}
