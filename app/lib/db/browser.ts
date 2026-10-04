"use client";
import { createBrowserClient } from "@supabase/ssr";

let enabled: Promise<boolean> | undefined;

/**
 * Should the browser sync Work Maps with the server? Only when Supabase is configured AND the user is signed in.
 * Without the public env vars this resolves false with no request (the demo stays localStorage-only).
 * The server probe (/auth/config) also checks the service key, which is never bundled here.
 */
export function persistenceEnabled(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return Promise.resolve(false);
  return (enabled ??= fetch("/auth/config", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((c: { enabled?: boolean; signed_in?: boolean }) => !!c.enabled && !!c.signed_in)
    .catch(() => false));
}

/** Browser Supabase client (publishable/anon key, RLS applies). For future direct reads; not used by the demo paths. */
export function browserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
