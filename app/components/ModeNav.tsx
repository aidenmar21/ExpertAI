import Link from "next/link";

const linkBase = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
const active = "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50";
const idle = "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

/** Top bar: switch between recording the expert, coaching a new hire, and the Work Map. */
export default function ModeNav({ jobId, mode }: { jobId: string; mode: "expert" | "tutor" | "workmap" }) {
  const items = [
    { key: "expert", label: "Expert", href: `/?job=${jobId}` },
    { key: "tutor", label: "New hire", href: `/?job=${jobId}&mode=tutor` },
    { key: "workmap", label: "Work Map", href: `/workmap?job=${jobId}` },
  ] as const;
  return (
    <nav className="flex items-center justify-between px-6 pt-5 pb-4">
      <Link href="/" className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        Understudy
      </Link>
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
        {items.map((i) => (
          <Link key={i.key} href={i.href} className={`${linkBase} ${mode === i.key ? active : idle}`}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
