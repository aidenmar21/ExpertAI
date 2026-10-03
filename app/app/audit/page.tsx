import { Suspense } from "react";
import Link from "next/link";
import AuditView from "@/components/AuditView";

export const metadata = { title: "Audit log · ExpertAI" };

export default function AuditPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <Link
          href="/"
          className="text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
        >
          &larr; Back to ExpertAI
        </Link>
      </div>
      <Suspense fallback={<p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>}>
        <AuditView />
      </Suspense>
    </>
  );
}
