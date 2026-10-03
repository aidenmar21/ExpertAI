"use client";

/**
 * Document Picture-in-Picture helpers (Chrome 116+ only; Safari and Firefox do not ship the API).
 * The PiP window is a real always-on-top document, so the same React tree can be portalled into it
 * and float over whatever app the expert is working in.
 */

export interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>;
  readonly window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export const PIP_SUPPORT_NOTE = "Floats ExpertAI in a small always-on-top window over your own app. Chrome (and Edge) only.";

export const isPipSupported = (): boolean => typeof window !== "undefined" && "documentPictureInPicture" in window;

/** Copy every <style> and <link rel=stylesheet> so Tailwind (and any CSSOM-only rules) apply in the PiP document. */
export function copyStyles(from: Document, to: Document) {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      if (sheet.href) {
        const link = to.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        if (sheet.media.mediaText) link.media = sheet.media.mediaText;
        to.head.appendChild(link);
      } else {
        const style = to.createElement("style");
        style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        to.head.appendChild(style);
      }
    } catch {
      // Cross-origin sheet: clone the owner node and let the browser fetch it.
      const node = sheet.ownerNode;
      if (node instanceof HTMLElement) to.head.appendChild(node.cloneNode(true));
    }
  }
}

/** Open the floating window and prepare its document (styles, color scheme, body class). */
export async function openPipWindow(opts: { width: number; height: number }): Promise<Window | null> {
  const api = window.documentPictureInPicture;
  if (!api) return null;
  const pip = await api.requestWindow({ width: opts.width, height: opts.height });
  const doc = pip.document;
  copyStyles(document, doc);
  const scheme = getComputedStyle(document.documentElement).colorScheme || "light dark";
  doc.documentElement.style.colorScheme = scheme;
  doc.documentElement.className = document.documentElement.className;
  doc.documentElement.lang = document.documentElement.lang || "en";
  doc.title = `${document.title} (floating)`;
  doc.body.className = `${document.body.className} pip-body`.trim();
  return pip;
}
