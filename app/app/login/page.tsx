import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/db/config";
import { authClient } from "@/lib/db/server";

export const metadata = { title: "Sign in · ExpertAI" };

/** Only same-site relative paths: never redirect to another origin. */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "");

async function signIn(form: FormData) {
  "use server";
  if (!supabaseConfigured()) redirect("/");
  const email = String(form.get("email") ?? "").trim();
  const invite = String(form.get("invite") ?? "");
  const next = safeNext(form.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/login?error=invalid-email");
  const h = await headers();
  const origin = h.get("origin") ?? (h.get("host") ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}` : null);
  if (!origin) redirect("/login?error=missing-origin");
  const callback = new URL("/auth/callback", origin);
  if (invite) callback.searchParams.set("invite", invite);
  if (next) callback.searchParams.set("next", next);
  const { error } = await (await authClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
  if (error) redirect("/login?error=link-failed");
  redirect("/login?sent=1");
}

const card = "mx-auto mt-24 w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  if (!supabaseConfigured()) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className={card}>
          <h1 className="text-2xl font-semibold">Demo mode</h1>
          <p className="text-slate-600 dark:text-slate-400">Sign-in is off until Supabase is configured. Everything is saved on this machine.</p>
          <Link href="/" className="inline-block rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500">Continue to the demo</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className={card}>
        <h1 className="text-2xl font-semibold">Sign in to ExpertAI</h1>
        <p className="text-slate-600 dark:text-slate-400">We will email you a secure sign-in link.</p>
        {one(q.sent) && <p role="status" className="rounded-xl bg-teal-50 p-3 text-teal-800 dark:bg-teal-950 dark:text-teal-200">Check your email for the link. Open it in this browser.</p>}
        {one(q.error) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">Sign-in could not complete. Request a fresh link and try again.</p>}
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="invite" value={one(q.invite) ?? ""} />
          <input type="hidden" name="next" value={safeNext(one(q.next))} />
          <label className="block text-sm font-medium">
            Email
            <input className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base dark:border-slate-700 dark:bg-slate-950" type="email" name="email" required autoComplete="email" />
          </label>
          <button className="w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500" type="submit">Email me a sign-in link</button>
        </form>
      </div>
    </main>
  );
}
