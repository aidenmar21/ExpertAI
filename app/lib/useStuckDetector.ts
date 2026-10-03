"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LayersModel } from "@tensorflow/tfjs";
import {
  DEFAULT_THRESHOLD,
  META_KEY,
  THRESHOLD_KEY,
  createModel,
  heuristicProbability,
  loadModel,
  predict,
  readMeta,
  readStuckFeedback,
  readThreshold,
  retrainWithFeedback,
  trainV1,
  writeThreshold,
  type StuckFeedbackSignals,
  type StuckModelMeta,
} from "@/lib/stuckModel";

const FEEDBACK_POLL_MS = 5000;

export interface StuckDetector {
  /** The network is loaded (or trained) and `probability` comes from it; before that it falls back to the rule score. */
  ready: boolean;
  /** Stuck probability 0..1. Synchronous and cheap: fine to call once per second. */
  probability: (signals: StuckFeedbackSignals) => number;
  threshold: number;
  setThreshold: (t: number) => void;
  meta: StuckModelMeta | null;
  /** Retrain on 2,000 synthetic examples plus this job's feedback (weighted x5). Resolves with the new meta. */
  retrain: () => Promise<StuckModelMeta>;
  /** How many "was this helpful?" votes are stored for this job. */
  feedbackCount: number;
  /** True while v1 or a retrain is running in the background. */
  training: boolean;
}

// ---------- localStorage-backed stores (SSR-safe via useSyncExternalStore) ----------
const subs = new Set<() => void>();
const notify = () => subs.forEach((s) => s());
function subscribe(fn: () => void) {
  subs.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === META_KEY || e.key === THRESHOLD_KEY || e.key.startsWith("expertai:stuck-feedback:")) fn();
  };
  window.addEventListener("storage", onStorage);
  // Feedback is appended by TutorWorkspace in the same tab (no storage event), so poll cheaply.
  const id = setInterval(fn, FEEDBACK_POLL_MS);
  return () => {
    subs.delete(fn);
    window.removeEventListener("storage", onStorage);
    clearInterval(id);
  };
}

// Snapshots must be referentially stable: cache the parsed meta by its raw string.
let metaRaw: string | null | undefined;
let metaCached: StuckModelMeta | null = null;
function metaSnapshot(): StuckModelMeta | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(META_KEY);
  } catch {
    raw = null;
  }
  if (raw !== metaRaw) {
    metaRaw = raw;
    metaCached = readMeta();
  }
  return metaCached;
}
const noMeta = () => null;
const thresholdSnapshot = () => readThreshold();
const defaultThreshold = () => DEFAULT_THRESHOLD;
const noFeedback = () => 0;

// ---------- One model per tab, shared by every hook instance ----------
let shared: Promise<LayersModel> | null = null;
let sharedModel: LayersModel | null = null;

function ensureModel(): Promise<LayersModel> {
  if (!shared) {
    shared = (async () => {
      const saved = await loadModel();
      if (saved) {
        sharedModel = saved;
        return saved;
      }
      const model = await createModel();
      await trainV1(model);
      sharedModel = model;
      notify();
      return model;
    })().catch((err) => {
      shared = null; // allow a retry on the next mount
      throw err;
    });
  }
  return shared;
}

/**
 * The stuck detector for tutor mode: lazily loads the saved network from IndexedDB, or trains v1 in the
 * background on first use (the UI never blocks; `probability` uses the rule score until `ready`).
 */
export function useStuckDetector(jobId: string): StuckDetector {
  const [ready, setReady] = useState(() => sharedModel !== null);
  const [training, setTraining] = useState(() => sharedModel === null);
  const modelRef = useRef<LayersModel | null>(sharedModel);

  const meta = useSyncExternalStore(subscribe, metaSnapshot, noMeta);
  const threshold = useSyncExternalStore(subscribe, thresholdSnapshot, defaultThreshold);
  const feedbackSnapshot = useCallback(() => readStuckFeedback(jobId).length, [jobId]);
  const feedbackCount = useSyncExternalStore(subscribe, feedbackSnapshot, noFeedback);

  // Load or train the model once, off the render path.
  useEffect(() => {
    let cancelled = false;
    ensureModel()
      .then((model) => {
        if (cancelled) return;
        modelRef.current = model;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      })
      .finally(() => {
        if (!cancelled) setTraining(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const probability = useCallback((signals: StuckFeedbackSignals): number => {
    const model = modelRef.current;
    if (!model) return heuristicProbability(signals);
    try {
      return predict(model, signals);
    } catch {
      return heuristicProbability(signals);
    }
  }, []);

  const setThreshold = useCallback((t: number) => {
    writeThreshold(Math.min(0.95, Math.max(0.05, t)));
    notify();
  }, []);

  const retrain = useCallback(async (): Promise<StuckModelMeta> => {
    setTraining(true);
    try {
      const model = modelRef.current ?? (await ensureModel());
      modelRef.current = model;
      const feedback = readStuckFeedback(jobId);
      const next = await retrainWithFeedback(model, feedback, { threshold: readThreshold() });
      notify();
      setReady(true);
      return next;
    } finally {
      setTraining(false);
    }
  }, [jobId]);

  return { ready, probability, threshold, setThreshold, meta, retrain, feedbackCount, training };
}
