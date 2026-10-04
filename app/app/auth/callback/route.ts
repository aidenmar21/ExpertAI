import { NextResponse } from "next/server";
import { authClient, dbError, serviceClient } from "@/lib/db/server";
import { DEMO_ORG_ID, supabaseConfigured } from "@/lib/db/config";
import { acceptInvite } from "@/lib/db/invites";
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!supabaseConfigured()) return NextResponse.redirect(new URL("/", url));
  try {
    const auth = await authClient();
    const code = url.searchParams.get("code");
    if (!code) throw new Error("missing code");
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (error) throw new Error("invalid code");
    const { data: { user } } = await auth.auth.getUser();
    if (!user) throw new Error("missing user");
    const invite = url.searchParams.get("invite");
    let orgId: string;
    if (invite) orgId = await acceptInvite(invite, user);
    else {
      const db = serviceClient();
      const { data, error: bootstrapError } = await db.rpc("bootstrap_org", { uid: user.id });
      dbError(bootstrapError);
      orgId = data as string;
      // A brand-new org starts with copies of the demo jobs so every page has something to open.
      const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("org_id", orgId);
      if (!count && orgId !== DEMO_ORG_ID) {
        const { data: demo } = await db.from("jobs").select("slug,profile,role_id,software_ids").eq("org_id", DEMO_ORG_ID);
        if (demo?.length) await db.from("jobs").upsert(demo.map((j) => ({ ...j, org_id: orgId })), { onConflict: "org_id,slug", ignoreDuplicates: true });
      }
    }
    const next = url.searchParams.get("next") ?? "";
    const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/jobs";
    const response = NextResponse.redirect(new URL(dest, url));
    response.cookies.set("expertai-org", orgId, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/" });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch { return NextResponse.redirect(new URL("/login?error=callback", url)); }
}
