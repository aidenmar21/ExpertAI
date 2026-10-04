"use client";

import type { ReactNode } from "react";
import { card } from "@/components/ui/styles";

/**
 * The bar above the simulated app that holds the teach / guide controls. Lives outside the app frame so it
 * never covers the app's own fields, title, or buttons.
 */
export function GuideBar({ title, status, children }: { title: string; status: ReactNode; children: ReactNode }) {
  return (
    <div data-guide-ignore className={`${card} relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5`}>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-label font-semibold text-ink">{title}</p>
        <div aria-live="polite" className="mt-0.5 text-meta text-ink-secondary">
          {status}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

const pillBtn =
  "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-[background-color,box-shadow,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

/** Toolbar buttons. One strong action per bar; the rest are quiet. */
export const barBtn = {
  quiet: `${pillBtn} border border-line-control bg-surface text-ink hover:bg-surface-hover`,
  quietOn: `${pillBtn} border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900`,
  record: `${pillBtn} border border-red-300 bg-surface text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950`,
  recording: `${pillBtn} bg-red-600 text-white shadow-[0_0_18px_2px_rgba(239,68,68,0.45)] hover:bg-red-700`,
  showcase: `${pillBtn} bg-indigo-600 text-white hover:bg-indigo-700`,
};

/** The big glowing blue Guide me button (new hire). */
export function GuideMeButton({ running, disabled, onClick }: { running: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="A mouse shows you each step of this case and waits while you do it. You can also ask the tutor: guide me."
      className="group relative inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-6 text-base font-bold text-white shadow-[0_0_22px_6px_rgba(56,189,248,0.55)] ring-2 ring-white/70 transition-[box-shadow,transform] duration-200 hover:scale-[1.03] hover:shadow-[0_0_30px_10px_rgba(56,189,248,0.7)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:pointer-events-none disabled:opacity-50 dark:ring-sky-200/40 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {!running && !disabled && (
        <span aria-hidden className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-sky-400/35 motion-reduce:hidden" />
      )}
      <span aria-hidden className="relative text-lg leading-none">
        {running ? "■" : "🧭"}
      </span>
      <span className="relative">{running ? "Stop guide" : "Guide me"}</span>
    </button>
  );
}
