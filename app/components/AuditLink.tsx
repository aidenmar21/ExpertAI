"use client";

import Link from "next/link";
import { auditUrl } from "@/lib/audit";

/**
 * Quiet footer link to the audit log for the current browser session.
 * Place it at the bottom of a page or panel: <AuditLink />
 */
export default function AuditLink({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex items-center justify-end px-4 py-3 ${className}`}>
      <Link
        href={auditUrl()}
        className="text-xs text-slate-400 underline-offset-4 transition hover:text-sky-600 hover:underline dark:text-slate-500 dark:hover:text-sky-300"
      >
        Audit log
      </Link>
    </footer>
  );
}
