"use client";

import { useEffect, useRef } from "react";
import type { AgentContextMessage, JobAction, JobField } from "@understudy/shared";
import { keyLabel } from "@/components/KeyCast";
import { keyTrace, recording, teachMode, type TraceEntry } from "@/lib/keytrace";

type Send = (m: AgentContextMessage) => unknown;

const where = (target: string | undefined, label: (k: string) => string) => {
  if (!target) return null;
  const [kind, key] = [target.slice(0, target.indexOf(":")), target.slice(target.indexOf(":") + 1)];
  return kind === "action" ? `the ${label(key)} button` : label(key);
};

/**
 * Expert mode: tells the voice agent, as silent [INPUT] context, everything the expert does in the app while
 * teaching: each click (and where the mouse came from), what they typed into which field key by key, and which
 * button closed the case. One line per click or finished field, so the agent can follow the walkthrough.
 */
export function useInputNarration(send: Send, fields: JobField[], actions: JobAction[]) {
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const label = (k: string) => fields.find((f) => f.key === k)?.label ?? actions.find((a) => a.key === k)?.label ?? k;
    let seen = keyTrace.all().length;
    let keys: Record<string, string[]> = {};
    const say = (text: string) => sendRef.current({ kind: "user_input", text });

    const handle = (e: TraceEntry) => {
      switch (e.kind) {
        case "open":
          keys = {};
          say(`Opened ${e.record}.`);
          break;
        case "click": {
          if (e.target?.startsWith("action:")) break; // the action line says it
          const to = where(e.target, label) ?? "an empty spot";
          const from = where(e.from, label);
          say(`Moved the mouse ${from && from !== to ? `from ${from} ` : ""}to ${to} and clicked.`);
          break;
        }
        case "key":
          if (e.field) keys[e.field] = [...(keys[e.field] ?? []), e.key ?? ""];
          break;
        case "change": {
          if (!e.field) break;
          const typed = (keys[e.field] ?? []).filter((k) => k !== "Tab");
          const value = e.value == null || e.value === "" ? "nothing (cleared it)" : `"${e.value}"`;
          say(
            typed.length
              ? `Typed ${value} into ${label(e.field)} (keys: ${typed.map(keyLabel).join(" ")}).`
              : `Set ${label(e.field)} to ${value}.`,
          );
          keys[e.field] = [];
          break;
        }
        case "action":
          say(`Clicked the ${label(e.action ?? "")} button on ${e.record}. That closes this case.`);
          break;
      }
    };

    const off = keyTrace.subscribe(() => {
      const all = keyTrace.all();
      if (all.length < seen) seen = 0; // trace was cleared
      const fresh = all.slice(seen);
      seen = all.length;
      if (!teachMode.get() && recording.get() === null) return;
      fresh.forEach(handle);
    });
    // Record task: tell the agent a lesson is being recorded, and what was saved.
    let rec = recording.get() !== null;
    const offRec = recording.subscribe(() => {
      const now = recording.get() !== null;
      if (now === rec) return;
      rec = now;
      if (now) say("Recording started: the expert is doing this task step by step to teach the new hire. Follow every step closely.");
      // After the app has saved any half-done case.
      else setTimeout(() => say(`Recording stopped. Saved ${recording.saved()} task${recording.saved() === 1 ? "" : "s"} for the new hire guide.`), 150);
    });
    return () => {
      off();
      offRec();
    };
  }, [fields, actions]);
}
