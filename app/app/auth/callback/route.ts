import { NextResponse } from "next/server";
import { authClient, dbError, serviceClient } from "@/lib/db/server";
import { supabaseConfigured } from "@/lib/db/config";
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
      const { data, error: bootstrapError } = await serviceClient().rpc("bootstrap_org", { uid: user.id });
      dbError(bootstrapError);
      orgId = data;
    }
    const response = NextResponse.redirect(new URL("/jobs", url));
    response.cookies.set("expertai-org", orgId, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/" });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch { return NextResponse.redirect(new URL("/login?error=callback", url)); }
}
