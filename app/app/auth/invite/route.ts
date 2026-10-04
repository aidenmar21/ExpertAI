import { NextResponse } from "next/server";
import { authClient, errorResponse } from "@/lib/db/server";
import { supabaseConfigured } from "@/lib/db/config";
import { acceptInvite, createInvite } from "@/lib/db/invites";
export async function POST(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "auth disabled" }, { status: 404 });
  try {
    const body = await request.json();
    const token = await createInvite(String(body.email ?? "").trim(), String(body.role ?? "expert"));
    const link = new URL("/auth/invite", request.url);
    link.searchParams.set("token", token);
    return Response.json({ url: link.toString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!supabaseConfigured()) return NextResponse.redirect(new URL("/", url));
  const token = url.searchParams.get("token") ?? "";
  const { data: { user } } = await (await authClient()).auth.getUser();
  if (!user) {
    const login = new URL("/login", url);
    login.searchParams.set("invite", token);
    return NextResponse.redirect(login);
  }
  try {
    const orgId = await acceptInvite(token, user);
    const response = NextResponse.redirect(new URL("/jobs", url));
    response.cookies.set("expertai-org", orgId, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/" });
    return response;
  } catch (error) { return errorResponse(error); }
}
