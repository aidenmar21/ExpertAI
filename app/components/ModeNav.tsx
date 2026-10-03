import Link from "next/link";
import AuditLink from "@/components/AuditLink";

/**
 * Top bar: brand (links to the jobs dashboard), the three-mode segmented control, and the quiet Audit link.
 * Sticky translucent chrome (spec 7.4) with an opaque fallback; the content below stays opaque.
 */
export default function ModeNav({ jobId, mode }: { jobId: string; mode: "expert" | "tutor" | "workmap" }) {
  const items = [
    { key: "expert", label: "Expert", href: `/?job=${jobId}` },
    { key: "tutor", label: "New hire", href: `/?job=${jobId}&mode=tutor` },
    { key: "workmap", label: "Work Map", href: `/workmap?job=${jobId}` },
  ] as const;
  return (
    <header className="ui-chrome sticky top-0 z-[100]" data-material="true">
      {/* narrow: brand + Audit on row one, the segmented control full-width below; sm+: one row */}
      <nav
        aria-label="Primary"
        className="mx-auto grid min-h-16 w-full max-w-[90rem] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-2 sm:grid-cols-[1fr_auto_1fr] sm:px-6 sm:py-0 md:px-8"
      >
        <Link
          href="/jobs"
          title="All jobs"
          className="justify-self-start rounded-sm text-card text-ink no-underline hover:text-link"
        >
          ExpertAI
        </Link>

        <div
          role="tablist"
          aria-label="Mode"
          className="col-span-2 flex min-h-10 items-center gap-0.5 rounded-md bg-surface-subtle p-[3px] text-label sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-center"
        >
          {items.map((i) => {
            const on = mode === i.key;
            return (
              <Link
                key={i.key}
                href={i.href}
                role="tab"
                aria-selected={on}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-sm px-3 no-underline transition-[background-color,color] duration-150 ease-ui sm:flex-none sm:min-w-24 sm:px-3.5 ${
                  on ? "bg-surface text-ink shadow-card" : "text-ink-secondary hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {i.label}
              </Link>
            );
          })}
        </div>

        <AuditLink className="col-start-2 row-start-1 -mr-2 justify-self-end sm:col-start-3" />
      </nav>
    </header>
  );
}
