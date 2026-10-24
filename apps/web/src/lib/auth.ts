import { createClient, type Session } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;

export async function guestLogin(): Promise<Session | null> {
  if (!supabase) {
    const response = await fetch("/api/v1/identity/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
    });
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? "Sesi guest gagal dibuat");
    }
    return null;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function googleLogin(): Promise<void> {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
    return;
  }
  const response = await fetch('/api/v1/identity/signout', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Sesi guest gagal diakhiri');
}
