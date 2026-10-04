/**
 * Supabase is on only when all three keys are set AND EXPERTAI_USE_SUPABASE=1. The explicit switch means adding keys
 * (or a half-migrated project) can never change how the demo runs; flip it once the migrations are applied.
 * Never import service credentials into a browser module.
 */
export function supabaseConfigured(): boolean {
  return process.env.EXPERTAI_USE_SUPABASE === "1"
    && !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** The seeded demo org (supabase/seed.sql). Anonymous callers (public "/", the extension) are scoped to it. */
export const DEMO_ORG_ID = process.env.EXPERTAI_DEMO_ORG_ID || "00000000-0000-4000-8000-000000000001";
