import Link from "next/link";
import { headers } from "next/headers";
import { supabaseConfigured } from "@/lib/db/config";
import { authClient } from "@/lib/db/server";
import { redirect } from "next/navigation";

async function signIn(form: FormData) {
  "use server";
  if (!supabaseConfigured()) redirect("/");
  const email = String(form.get("email") ?? "").trim();
  const invite = String(form.get("invite") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/login?error=invalid-email");
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) redirect("/login?error=missing-origin");
  const callback = new URL("/auth/callback", origin);
  if (invite) callback.searchParams.set("invite", invite);
  const { error } = await (await authClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
  if (error) redirect("/login?error=link-failed");
  redirect("/login?sent=1");
}
export default async function Login({ searchParams }: { searchParams: Promise<{ invite?: string; sent?: string; error?: string }> }) {
  const query = await searchParams;
  if (!supabaseConfigured()) return <main className="mx-auto max-w-md p-8"><h1>Demo mode</h1><p>Sign-in is disabled until Supabase is configured.</p><Link href="/">Continue to demo</Link></main>;
  return <main className="mx-auto max-w-md space-y-5 p-8">
    <h1 className="text-2xl font-semibold">Sign in to ExpertAI</h1>
    <p>We’ll email you a secure sign-in link.</p>
    {query.sent && <p role="status">Check your email for the link. Open it in this browser.</p>}
    {query.error && <p role="alert">Sign-in could not complete. Request a fresh link and try again.</p>}
    <form action={signIn} className="space-y-4">
      <input type="hidden" name="invite" value={query.invite ?? ""} />
      <label className="block">Email<input className="mt-2 block w-full rounded border p-3" type="email" name="email" required autoComplete="email" /></label>
      <button className="rounded border px-4 py-3" type="submit">Email me a sign-in link</button>
    </form>
  </main>;
}
