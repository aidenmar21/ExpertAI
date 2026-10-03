"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isPipSupported, openPipWindow, PIP_SUPPORT_NOTE } from "@/lib/pip";
import { btn, emptyBox } from "@/components/ui/styles";

const noSubscribe = () => () => {};
const serverUnknown = (): boolean | null => null;

const floatBtn = `${btn.secondary} ${btn.compact}`;

/**
 * Wraps a panel so it can float over any app in a Document Picture-in-Picture window (Chrome only).
 * The same React element tree is portalled into the PiP document, so the panel's state (screen share,
 * voice session, Work Map) survives the move. When the window closes, the children render inline again.
 * Without the API the children render as before, with a one-line "unavailable" note above them.
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

  if (supported === false) {
    return (
      <div className="flex h-full flex-col gap-2">
        <p className="flex min-h-9 items-center justify-end text-meta text-ink-tertiary" title={PIP_SUPPORT_NOTE}>
          Floating window unavailable in this browser
        </p>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  if (pip && !pip.closed) {
    return (
      <>
        <div className={`${emptyBox} flex h-full min-h-[24rem] flex-col items-center justify-center bg-surface-subtle/60`}>
          <p className="text-sub text-ink">ExpertAI is floating over your app</p>
          <p className="mt-2 max-w-xs text-body text-ink-secondary">
            Switch to the app you work in; the apprentice stays on top. Close the floating window to bring it back here.
          </p>
          <button type="button" onClick={() => pip.close()} className={`${floatBtn} mt-5`}>
            Bring panel back
          </button>
        </div>
        {createPortal(
          <div className="pip-root flex h-full flex-col gap-2 p-3">
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => pip.close()} className={floatBtn} title="Return the panel to the ExpertAI tab">
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
        <button type="button" onClick={open} className={floatBtn} title={PIP_SUPPORT_NOTE}>
          Float over my app
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
