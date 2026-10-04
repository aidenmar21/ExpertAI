import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseConfigured } from "./config";

export const serviceClient = () => {
  if (!supabaseConfigured()) throw new Error("Supabase is disabled");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};
export async function authClient() {
  if (!supabaseConfigured()) throw new Error("Supabase is disabled");
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (values) => {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server components cannot set cookies; middleware refreshes them. */ }
    } },
  });
}
export type Role = "owner" | "manager" | "expert" | "new_hire";
export class RepositoryError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
/** Request scoped only. The org cookie is a selector, never authorization. */
export const tenant = cache(async () => {
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new RepositoryError("sign in required", 401);
  const db = serviceClient();
  const selected = (await cookies()).get("expertai-org")?.value;
  let query = db.from("memberships").select("org_id,role").eq("user_id", user.id).order("org_id");
  if (selected) query = query.eq("org_id", selected);
  const { data, error: membershipError } = await query.limit(1).maybeSingle();
  if (membershipError || !data) throw new RepositoryError("organization membership required", 403);
  return { db, orgId: data.org_id as string, role: data.role as Role, user };
});
export async function requireRole(roles: Role[]) {
  const ctx = await tenant();
  if (!roles.includes(ctx.role)) throw new RepositoryError("permission denied", 403);
  return ctx;
}
export function dbError(error: { code?: string } | null) {
  if (error) throw new RepositoryError(error.code === "23505" ? "exists" : "database operation failed", error.code === "23505" ? 409 : 500);
}
export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof RepositoryError ? error.message : "operation failed" }, { status: error instanceof RepositoryError ? error.status : 500 });
}
