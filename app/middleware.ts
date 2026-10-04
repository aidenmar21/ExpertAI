import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "./lib/db/config";
export async function middleware(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.next();
  const path = request.nextUrl.pathname;
  // Cookie auth mutations must be same-origin. Public read-only API requests still require auth.
  const origin = request.headers.get("origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "cross-origin write denied" }, { status: 403 });
  let response = NextResponse.next({ request });
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (values) => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    } },
  });
  const { data: { user } } = await auth.auth.getUser();
  const publicPath = ["/login", "/auth/callback", "/auth/invite", "/auth/config"].includes(path);
  const finish = (next: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
    next.headers.set("cache-control", "private, no-store");
    return next;
  };
  if (!user && !publicPath) return finish(path.startsWith("/api/") ? NextResponse.json({ error: "sign in required" }, { status: 401 }) : NextResponse.redirect(new URL("/login", request.url)));
  // Reuse existing UI through an async tenant loader without editing designer-owned pages.
  if (user && ["/", "/jobs", "/workmap", "/demo"].includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/workspace";
    url.searchParams.set("view", path);
    return finish(NextResponse.rewrite(url, { request: { headers: request.headers } }));
  }
  return finish(response);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
