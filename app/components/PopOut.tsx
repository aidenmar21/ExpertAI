"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isPipSupported, openPipWindow, PIP_SUPPORT_NOTE } from "@/lib/pip";

const noSubscribe = () => () => {};
const serverUnknown = (): boolean | null => null;

const btn =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50";

/**
 * Wraps a panel so it can float over any app in a Document Picture-in-Picture window (Chrome only).
 * The same React element tree is portalled into the PiP document, so the panel's state (screen share,
 * voice session, Work Map) survives the move. When the window closes, the children render inline again.
 * Without the API the children render exactly as before, with no extra markup.
 */
export default function PopOut({ children, width = 380, height = 640 }: { children: ReactNode; width?: number; height?: number }) {
  // null on the server: the button is in the server HTML and hidden on the client when the API is missing.
  const supported = useSyncExternalStore(noSubscribe, isPipSupported, serverUnknown);
  const [pip, setPip] = useState<Window | null>(null);

  const open = useCallback(async () => {
    try {
      const w = await openPipWindow({ width, height });
      if (!w) return;
      w.addEventListener("pagehide", () => setPip(null), { once: true });
      setPip(w);
    } catch {
      setPip(null);
    }
  }, [width, height]);

  // Leaving the page (or unmounting the panel) closes the floating window.
  useEffect(() => {
    if (!pip) return;
    return () => {
      if (!pip.closed) pip.close();
    };
  }, [pip]);

  if (supported === false) return <>{children}</>;

  if (pip && !pip.closed) {
    return (
      <>
        <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">ExpertAI is floating over your app</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Switch to the app you work in; the apprentice stays on top. Close the floating window to bring it back here.
          </p>
          <button type="button" onClick={() => pip.close()} className={`${btn} mt-4`}>
            Back to tab
          </button>
        </div>
        {createPortal(
          <div className="pip-root flex h-full flex-col gap-2 p-3">
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => pip.close()} className={btn} title="Return the panel to the ExpertAI tab">
                Back to tab
              </button>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
          </div>,
          pip.document.body,
        )}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-end">
        <button type="button" onClick={open} className={btn} title={PIP_SUPPORT_NOTE}>
          Float over my app
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
