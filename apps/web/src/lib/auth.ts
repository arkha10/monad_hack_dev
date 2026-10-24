import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const supabase = url && key ? createClient(url, key) : null

export async function guestLogin(): Promise<Session | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}

export async function googleLogin(): Promise<void> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut()
}
