import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "./lib/db/config";

/**
 * Auth gate (Next 16 "proxy", formerly middleware). Without Supabase env vars it does nothing: the demo runs as before.
 * With Supabase:
 *   public pages: "/" (demo org when signed out), /login, /auth/*
 *   /api/check and /api/audit: open, scoped to the demo org when there is no session cookie (the extension calls
 *     them cross-origin without cookies). Known gap: replace with an org API key header (supabase/README.md).
 *   every other page redirects to /login; every other /api route returns 401 without a session.
 * Pages and routes still re-check membership and role server-side (lib/db/server.ts); this is only the first gate.
 */
const PUBLIC_PAGES = new Set(["/", "/login"]);
const OPEN_APIS = new Set(["/api/check", "/api/audit"]);

export async function proxy(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.next();
  const path = request.nextUrl.pathname;
  const open = OPEN_APIS.has(path);
  if (request.method === "OPTIONS") return NextResponse.next(); // CORS preflight (next.config.ts headers)

  // Cookie-authenticated writes must be same-origin (CSRF). The two open extension APIs are exempt.
  const origin = request.headers.get("origin");
  if (!open && !["GET", "HEAD"].includes(request.method) && origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "cross-origin write denied" }, { status: 403 });
  }

  // Refresh the Supabase session cookie on every request (the @supabase/ssr pattern).
  let response = NextResponse.next({ request });
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await auth.auth.getUser();
  const signedIn = !!data.user;
  const isPublic = PUBLIC_PAGES.has(path) || path.startsWith("/auth/") || open;
  if (signedIn || isPublic) return response;

  const deny = path.startsWith("/api/")
    ? NextResponse.json({ error: "sign in required" }, { status: 401 })
    : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`, request.url));
  response.cookies.getAll().forEach((c) => deny.cookies.set(c));
  deny.headers.set("cache-control", "private, no-store");
  return deny;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
