import { NextResponse } from "next/server";
import { authClient } from "@/lib/db/server";
import { supabaseConfigured } from "@/lib/db/config";
export async function POST(request: Request) {
  if (supabaseConfigured()) await (await authClient()).auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete("expertai-org");
  response.headers.set("clear-site-data", '"storage"');
  return response;
}
