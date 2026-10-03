"use client";

import { useSyncExternalStore } from "react";

/**
 * Feature flags for anything that could break the demo path. Defaults are on;
 * flip one off in the browser with: localStorage.setItem("expertai:flags", '{"offRecord":false}')
 */
const DEFAULTS = {
  offRecord: true,   // off-the-record button + timeline gap
  scoreboard: true,  // scoreboard panel on the Work Map page
  stuck: true,       // stuck detection loop in tutor mode
};

export type FlagName = keyof typeof DEFAULTS;

export function flag(name: FlagName): boolean {
  try {
    const raw = localStorage.getItem("expertai:flags");
    const o = raw ? (JSON.parse(raw) as Partial<Record<FlagName, boolean>>) : {};
    return o[name] ?? DEFAULTS[name];
  } catch {
    return DEFAULTS[name];
  }
}

const noSubscribe = () => () => {};
/** SSR-safe: renders the default on the server, the stored value in the browser. */
export function useFlag(name: FlagName): boolean {
  return useSyncExternalStore(noSubscribe, () => flag(name), () => DEFAULTS[name]);
}
