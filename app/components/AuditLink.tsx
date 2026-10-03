"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { auditUrl } from "@/lib/audit";

const noSubscribe = () => () => {};
// The session id lives in sessionStorage, so the server renders the plain route and the client swaps in
// the session URL after hydration (no attribute mismatch).
const serverHref = () => "/audit";
const clientHref = () => auditUrl();

/**
 * Quiet text link to the audit log for the current browser session.
 * Used at the far right of the top nav; also fine at the bottom of a page or panel: <AuditLink />
 */
export default function AuditLink({ className = "" }: { className?: string }) {
  const href = useSyncExternalStore(noSubscribe, clientHref, serverHref);
  return (
    <div className={`flex items-center justify-end ${className}`}>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center rounded-sm px-2 text-meta text-ink-secondary no-underline underline-offset-[0.15em] transition-colors duration-150 ease-ui hover:text-link hover:underline pointer-fine:min-h-9"
      >
        Audit
      </Link>
    </div>
  );
}
