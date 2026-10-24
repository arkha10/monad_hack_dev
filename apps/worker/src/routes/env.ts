export interface Env {
  MATCHMAKER: DurableObjectNamespace
  MATCHES: DurableObjectNamespace
  LEDGER: DurableObjectNamespace
  WEB_ORIGIN: string
  SUPABASE_URL?: string
  SUPABASE_JWT_ISSUER?: string
  SUPABASE_JWT_AUDIENCE?: string
  BOAI_DEV_ANON_ID?: string
  CHAIN_INTERNAL_SECRET?: string
  MONAD_RPC_URL?: string
  MONAD_CHAIN_ID?: string
  BOAI_CONTRACT_ADDRESS?: string
}

export interface AuthenticatedRequestContext {
  authenticatedUserId: string | null
  isInternal: boolean
}
