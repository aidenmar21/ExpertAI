"use client";
import { createBrowserClient } from "@supabase/ssr";
/** Server capability probe also checks the private key, which must never be bundled here. */
let enabled: Promise<boolean> | undefined;
export function persistenceEnabled(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return Promise.resolve(false);
  return enabled ??= fetch("/auth/config", { cache: "no-store" }).then((r) => r.ok ? r.json() : { enabled: false }).then((c) => !!c.enabled).catch(() => false);
}
export function browserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
