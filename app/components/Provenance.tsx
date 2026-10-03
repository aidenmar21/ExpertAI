"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Rule, ScreenMoment, WorkMap } from "@understudy/shared";
import { auditUrl, provenanceFor } from "@/lib/audit";
import { useFrame } from "@/lib/frames";
import { btn, eyebrow, link } from "@/components/ui/styles";

const SOURCE_LABEL: Record<Rule["source"], string> = {
  live_question: "Live question during the session",
  debrief: "Debrief after the session",
  teach_back: "Teach-back correction",
  policy: "Written company policy",
  baseline: "Industry standard",
};

export const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Modal dialog on the native <dialog> element: showModal() makes the page behind inert (focus stays inside),
 * Escape closes, and focus returns to whatever opened it.
 */
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onDialogClose = () => {
      onClose();
      returnTo.current?.focus?.();
      returnTo.current = null;
    };
    d.addEventListener("close", onDialogClose);
    return () => d.removeEventListener("close", onDialogClose);
  }, [onClose]);

  // Keep Tab inside the dialog even in browsers where showModal does not trap it.
  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !ref.current) return;
    const focusable = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-[2px]`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-card text-ink">{title}</h2>
            <button type="button" onClick={() => ref.current?.close()} className={`${btn.tertiary} ${btn.compact} -mr-2 -mt-1`}>
              Close
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Screen-moment thumbnail, 96x60. The real frame from IndexedDB when the moment has a frameId (click to
 * enlarge), otherwise a placeholder labelled with the time.
 */
export function MomentThumb({ moment, label }: { moment: ScreenMoment; label?: string }) {
  const url = useFrame(moment.frameId);
  const [open, setOpen] = useState(false);
  const caption = `${label ?? "Screen moment"} · ${formatT(moment.t)}${moment.record ? ` · ${moment.record}` : ""}`;

  if (!url) {
    return (
      <div aria-hidden className="flex h-[60px] w-24 shrink-0 items-end justify-end rounded-sm border border-line bg-surface-subtle p-1.5">
        <span className="rounded-xs bg-surface px-1 text-note tabular-nums text-ink-tertiary">{formatT(moment.t)}</span>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge ${caption}`}
        className="relative h-[60px] w-24 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-subtle transition-[border-color] duration-150 ease-ui hover:border-ink-tertiary focus-visible:outline-2 focus-visible:outline-focus"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL from IndexedDB */}
        <img src={url} alt="" className="size-full object-cover object-top" />
        <span className="absolute bottom-1 right-1 rounded-xs bg-surface/90 px-1 text-note tabular-nums text-ink-secondary">{formatT(moment.t)}</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={caption} wide>
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL from IndexedDB */}
        <img src={url} alt={`Screen at ${formatT(moment.t)}`} className="w-full rounded-md border border-line" style={{ imageRendering: "auto" }} />
        <p className="mt-2 text-meta text-ink-secondary">Thumbnail kept only in this browser.</p>
      </Dialog>
    </>
  );
}

/** "Why do we believe this?": where a company rule came from, with a link into the audit log. */
export default function Provenance({ rule, map }: { rule: Rule; map: WorkMap }) {
  const [open, setOpen] = useState(false);
  const p = open ? provenanceFor(rule, map) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${link} text-meta font-medium`}>
        Why do we believe this?
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Why do we believe this?">
        {p && (
          <div className="space-y-4 text-body">
            <p className="font-medium text-ink">{rule.text}</p>
            <Row label="Source">{SOURCE_LABEL[p.source]}</Row>
            <Row label={p.source === "policy" ? "Written text" : p.source === "baseline" ? "Standard wording" : `${map.expert || "Expert"}'s words`}>
              <blockquote className="border-l-2 border-action pl-3 italic text-link">&ldquo;{rule.reason_quote}&rdquo;</blockquote>
            </Row>
            <Row label="Screen moment">
              <div className="flex items-center gap-3">
                <MomentThumb moment={rule.screen_moment} />
                <p className="text-meta tabular-nums text-ink-secondary">
                  {formatT(rule.screen_moment.t)}
                  {rule.screen_moment.record ? ` · ${rule.screen_moment.record}` : ""}
                </p>
              </div>
            </Row>
            <Row label="Transcript">
              <span className="tabular-nums">{p.transcript_t != null ? `Line at ${formatT(p.transcript_t)}` : "No transcript line linked"}</span>
            </Row>
            <Row label="Confirmed">
              {rule.confirmed
                ? `${p.confirmed_by ?? "Confirmed"}${p.confirmed_at ? ` · ${new Date(p.confirmed_at).toLocaleString()}` : ""}`
                : "Not confirmed yet"}
            </Row>
            {p.event_ids.length > 0 && (
              <Row label="Events">
                <span className="break-all font-mono text-meta text-ink-secondary">{p.event_ids.join(", ")}</span>
              </Row>
            )}
            <div className="border-t border-line pt-4">
              <Link href={auditUrl(p.session_id)} className={`${link} text-meta font-medium`}>
                Open in audit log
              </Link>
              <span className="ml-2 font-mono text-note text-ink-tertiary">{p.session_id}</span>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={eyebrow}>{label}</p>
      <div className="mt-1 text-ink">{children}</div>
    </div>
  );
}
