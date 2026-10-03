import { Suspense } from "react";
import Link from "next/link";
import AuditView from "@/components/AuditView";
import { PageChrome } from "@/components/JobsDashboard";

export const metadata = { title: "Audit log · ExpertAI" };

export default function AuditPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageChrome>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-sm px-2 text-meta text-ink-secondary no-underline hover:text-link hover:underline pointer-fine:min-h-9"
        >
          Back to ExpertAI
        </Link>
      </PageChrome>
      <Suspense fallback={<p className="px-6 py-12 text-center text-body text-ink-secondary" role="status">Loading audit log…</p>}>
        <AuditView />
      </Suspense>
    </div>
  );
}
