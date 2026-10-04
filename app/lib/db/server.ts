import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_ORG_ID, supabaseConfigured } from "./config";

/** Service-role client: bypasses RLS, so every repository call scopes by the tenant's org_id itself. */
export const serviceClient = () => {
  if (!supabaseConfigured()) throw new Error("Supabase is disabled");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

/** Cookie-bound client for the signed-in user (anon/publishable key). */
export async function authClient() {
  if (!supabaseConfigured()) throw new Error("Supabase is disabled");
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* Server components cannot set cookies; the proxy refreshes them. */
        }
      },
    },
  });
}

export type Role = "owner" | "manager" | "expert" | "new_hire";
export interface TenantUser { id: string; email?: string }

export interface Tenant {
  db: ReturnType<typeof serviceClient>;
  orgId: string;
  role: Role;
  /** null = anonymous caller scoped to the demo org (the public "/" page and the extension's /api/check, /api/audit). */
  user: TenantUser | null;
}

export class RepositoryError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/**
 * The caller's org for this request. Signed in: their membership (the expertai-org cookie only selects among
 * orgs they belong to; it is never authorization). Not signed in: the demo org with the least role (new_hire).
 * The proxy decides which routes an anonymous caller can reach at all.
 */
export const tenant = cache(async (): Promise<Tenant> => {
  const db = serviceClient();
  const auth = await authClient();
  const { data } = await auth.auth.getUser();
  const user = data.user;
  if (!user) return { db, orgId: DEMO_ORG_ID, role: "new_hire", user: null };
  const selected = (await cookies()).get("expertai-org")?.value;
  let query = db.from("memberships").select("org_id,role").eq("user_id", user.id).order("org_id");
  if (selected) query = query.eq("org_id", selected);
  const { data: membership, error } = await query.limit(1).maybeSingle();
  if (error || !membership) throw new RepositoryError("organization membership required", 403);
  return { db, orgId: membership.org_id as string, role: membership.role as Role, user: { id: user.id, email: user.email } };
});

/** A signed-in member with one of these roles. Anonymous callers never pass. */
export async function requireRole(roles: Role[]): Promise<Tenant & { user: TenantUser }> {
  const ctx = await tenant();
  if (!ctx.user) throw new RepositoryError("sign in required", 401);
  if (!roles.includes(ctx.role)) throw new RepositoryError("permission denied", 403);
  return { ...ctx, user: ctx.user };
}

export function dbError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  console.error("[db]", error.code, error.message);
  throw new RepositoryError(error.code === "23505" ? "exists" : "database operation failed", error.code === "23505" ? 409 : 500);
}

export function errorResponse(error: unknown) {
  if (!(error instanceof RepositoryError)) console.error("[db]", error);
  return Response.json(
    { error: error instanceof RepositoryError ? error.message : "operation failed" },
    { status: error instanceof RepositoryError ? error.status : 500 },
  );
}
