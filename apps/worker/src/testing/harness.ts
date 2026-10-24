import { devSessionCookie, issueDevSession } from '../auth/session'
import { HttpError } from '../routes/http'
import type { Env } from '../routes/env'

export type DoHandler = (path: string, body: unknown, url: URL) => unknown

export interface FakeEnvHandlers {
  ledger?: DoHandler
  match?: DoHandler
  matchmaker?: DoHandler
}

interface DoRequestPayload {
  path: string
  body: unknown
  url: URL
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message, retryable: error.retryable } },
      { status: error.status },
    )
  }
  const message = error instanceof Error ? error.message : 'fake DO failure'
  return Response.json({ error: { code: 'FAKE_DO_ERROR', message, retryable: false } }, { status: 500 })
}

async function readPayload(request: Request): Promise<DoRequestPayload> {
  const text = await request.text()
  const url = new URL(request.url)
  return { path: url.pathname, url, body: text.length > 0 ? (JSON.parse(text) as unknown) : undefined }
}

function fakeNamespace(handler: DoHandler | undefined, label: string): DurableObjectNamespace {
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (request: Request): Promise<Response> => {
        if (!handler) return errorResponse(new HttpError('FAKE_DO_MISSING', `${label} tidak disiapkan di test`, 500))
        try {
          const { path, body, url } = await readPayload(request)
          const result = await handler(path, body, url)
          if (result === undefined) return errorResponse(new HttpError('FAKE_DO_UNHANDLED', `${label} tidak menangani ${path}`, 404))
          return Response.json(result)
        } catch (error) {
          return errorResponse(error)
        }
      },
    }),
  }
  return namespace as unknown as DurableObjectNamespace
}

export function createFakeEnv(handlers: FakeEnvHandlers = {}): Env {
  return {
    MATCHMAKER: fakeNamespace(handlers.matchmaker, 'MATCHMAKER'),
    MATCHES: fakeNamespace(handlers.match, 'MATCHES'),
    LEDGER: fakeNamespace(handlers.ledger, 'LEDGER'),
    WEB_ORIGIN: 'http://localhost:5173',
  }
}

export async function guestCookie(env: Env, userId: string): Promise<string> {
  return devSessionCookie(await issueDevSession(env, userId))
}
