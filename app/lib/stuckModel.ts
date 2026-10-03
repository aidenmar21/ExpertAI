"use client";

/**
 * Stuck detector: a small neural network (MLP) in the browser, trained with TensorFlow.js.
 *
 * v1 is bootstrapped from synthetic signals labelled by the engine's rule-based heuristic
 * (stuckScore), then retrained on the new hire's own "was this helpful?" votes. The network only
 * decides *when* to offer help; the rules, hints and the Work Map never come from it.
 *
 * Browser-only: TensorFlow.js is loaded with a dynamic import on first use, so this module must
 * not be imported by server components.
 */
import type { LayersModel } from "@tensorflow/tfjs";
import type { StuckSignals } from "@understudy/shared";
import { stuckScore } from "@understudy/engine";

type TF = typeof import("@tensorflow/tfjs");

export const STUCK_DETECTOR_COPY = "Stuck detector: a small neural network that learns from your feedback.";

export const MODEL_URL = "indexeddb://expertai-stuck";
export const META_KEY = "expertai:stuck-model-meta";
export const THRESHOLD_KEY = "expertai:stuck-threshold";
export const DEFAULT_THRESHOLD = 0.7;
export const DEFAULT_EPOCHS = 15;
export const SYNTHETIC_N = 2000;
export const REAL_WEIGHT = 5;
const MODEL_NAME = "stuck-mlp-v1";

/** The six inputs, as TutorWorkspace stores them in expertai:stuck-feedback:<jobId>. */
export interface StuckFeedbackSignals {
  idle_ms: number;        // idle with a record open
  back_and_forth: number; // same field flipped back and forth (count)
  hover_ms: number;       // hovering an action button
  hesitation: number;     // hesitation words in the last 20s
  since_help_ms: number;  // since the tutor last helped
  fields_touched: number; // fields changed on this record
}
export interface StuckFeedback { t: number; signals: StuckFeedbackSignals; label: boolean }
export interface StuckExample { signals: StuckFeedbackSignals; label: boolean }

export interface StuckModelMeta {
  trained_at: string;
  synthetic_n: number;
  real_n: number;
  epochs: number;
  train_ms: number;
  threshold: number;
}

export interface TrainResult { ms: number; loss: number; acc: number }
export interface TrainOptions { epochs?: number; onEpoch?: (epoch: number, loss: number, acc: number) => void }

// ---------- TensorFlow.js (lazy) ----------
let tfLib: TF | null = null;
let tfLoading: Promise<TF> | null = null;

/** Load TF.js once (dynamic import keeps it out of the initial bundle) on the CPU backend: the model is tiny. */
export async function loadTf(): Promise<TF> {
  if (tfLib) return tfLib;
  if (!tfLoading) {
    tfLoading = import("@tensorflow/tfjs").then(async (mod) => {
      const tf = (mod.default ?? mod) as TF;
      try {
        await tf.setBackend("cpu");
      } catch {
        /* keep whatever backend is available */
      }
      await tf.ready();
      tfLib = tf;
      return tf;
    });
  }
  return tfLoading;
}

function tfNow(): TF {
  if (!tfLib) throw new Error("TensorFlow.js not loaded yet: call loadTf() or createModel() first");
  return tfLib;
}

// ---------- Features ----------
const SCALES = [60_000, 5, 10_000, 5, 300, 10] as const;
export const FEATURE_NAMES = ["idle_ms", "back_and_forth", "hover_ms", "hesitation", "since_help_s", "fields_touched"] as const;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Six inputs divided by sensible scales and clipped to [0, 2]. */
export function featurize(s: StuckFeedbackSignals): number[] {
  const raw = [num(s.idle_ms), num(s.back_and_forth), num(s.hover_ms), num(s.hesitation), num(s.since_help_ms) / 1000, num(s.fields_touched)];
  return raw.map((v, i) => clip(v / SCALES[i], 0, 2));
}

/** Feedback signals -> the engine's StuckSignals (for the heuristic label and the fallback score). */
export function toStuckSignals(s: StuckFeedbackSignals): StuckSignals {
  const hover = num(s.hover_ms);
  return {
    msIdleWithRecordOpen: num(s.idle_ms),
    backAndForthCount: num(s.back_and_forth),
    msHoveringAction: hover > 0 ? { action: "action", ms: hover } : undefined,
    hesitationWords: num(s.hesitation),
  };
}

/** The rule-based score (0..1) for the same six inputs; what v1 learns from, and the fallback before the model is ready. */
export function heuristicProbability(s: StuckFeedbackSignals): number {
  return stuckScore(toStuckSignals(s));
}

// ---------- Synthetic data ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand: () => number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Realistic signals labelled by the heuristic (stuckScore >= 0.6), with 8% of labels flipped and
 * gaussian jitter on the inputs so the network does not just memorise the thresholds.
 */
export function syntheticExamples(n = SYNTHETIC_N, seed = 42): StuckExample[] {
  const rand = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const out: StuckExample[] = [];
  for (let i = 0; i < n; i++) {
    const signals: StuckFeedbackSignals = {
      idle_ms: rand() < 0.65 ? rand() * 10_000 : rand() * 60_000,
      back_and_forth: pick(rand, [60, 25, 9, 4, 2]),
      hover_ms: rand() < 0.75 ? 0 : rand() * 10_000,
      hesitation: pick(rand, [65, 20, 9, 4, 2]),
      since_help_ms: rand() * 600_000,
      fields_touched: Math.floor(rand() * 13),
    };
    let label = heuristicProbability(signals) >= 0.6;
    if (rand() < 0.08) label = !label;
    const jittered: StuckFeedbackSignals = {
      idle_ms: Math.max(0, signals.idle_ms + gauss() * 1500),
      back_and_forth: Math.max(0, signals.back_and_forth + gauss() * 0.25),
      hover_ms: signals.hover_ms > 0 ? Math.max(0, signals.hover_ms + gauss() * 400) : 0,
      hesitation: Math.max(0, signals.hesitation + gauss() * 0.25),
      since_help_ms: Math.max(0, signals.since_help_ms + gauss() * 5000),
      fields_touched: Math.max(0, signals.fields_touched + gauss() * 0.5),
    };
    out.push({ signals: jittered, label });
  }
  return out;
}

// ---------- Model ----------
/** 6 -> 16 (relu) -> 8 (relu) -> 1 (sigmoid). */
export async function createModel(): Promise<LayersModel> {
  const tf = await loadTf();
  const model = tf.sequential({ name: MODEL_NAME });
  model.add(tf.layers.dense({ inputShape: [6], units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  return model;
}

/** Adam + binary cross-entropy, batch 64. ~15 epochs on 2,000 examples trains in a few seconds. Returns wall time in ms. */
export async function train(model: LayersModel, examples: StuckExample[], opts: TrainOptions = {}): Promise<TrainResult> {
  const tf = await loadTf();
  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  if (examples.length === 0) return { ms: 0, loss: NaN, acc: NaN };
  model.compile({ optimizer: tf.train.adam(0.01), loss: "binaryCrossentropy", metrics: ["accuracy"] });
  const { xs, ys } = tf.tidy(() => ({
    xs: tf.tensor2d(examples.map((e) => featurize(e.signals)), [examples.length, 6]),
    ys: tf.tensor2d(examples.map((e) => (e.label ? 1 : 0)), [examples.length, 1]),
  }));
  const t0 = now();
  let loss = NaN;
  let acc = NaN;
  try {
    await model.fit(xs, ys, {
      epochs,
      batchSize: 64,
      shuffle: true,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          loss = Number(logs?.loss ?? NaN);
          acc = Number(logs?.acc ?? NaN);
          opts.onEpoch?.(epoch + 1, loss, acc);
        },
      },
    });
  } finally {
    xs.dispose();
    ys.dispose();
  }
  return { ms: Math.round(now() - t0), loss, acc };
}

/** Stuck probability 0..1 for one set of signals. Synchronous (dataSync inside tidy): cheap enough to call every second. */
export function predict(model: LayersModel, signals: StuckFeedbackSignals): number {
  const tf = tfNow();
  const p = tf.tidy(() => {
    const x = tf.tensor2d([featurize(signals)], [1, 6]);
    const y = model.predict(x);
    const t = Array.isArray(y) ? y[0] : y;
    return t.dataSync()[0];
  });
  return clip(Number.isFinite(p) ? p : 0, 0, 1);
}

/** Batch accuracy against labels (for tests and the retrain summary). */
export function evaluate(model: LayersModel, examples: StuckExample[], threshold = 0.5): number {
  if (examples.length === 0) return NaN;
  const tf = tfNow();
  const probs = tf.tidy(() => {
    const x = tf.tensor2d(examples.map((e) => featurize(e.signals)), [examples.length, 6]);
    const y = model.predict(x);
    const t = Array.isArray(y) ? y[0] : y;
    return Array.from(t.dataSync());
  });
  let correct = 0;
  probs.forEach((p, i) => {
    if (p >= threshold === examples[i].label) correct++;
  });
  return correct / examples.length;
}

// ---------- Persistence ----------
export async function saveModel(model: LayersModel): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    await model.save(MODEL_URL);
    return true;
  } catch {
    return false;
  }
}

export async function loadModel(): Promise<LayersModel | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const tf = await loadTf();
    return await tf.loadLayersModel(MODEL_URL);
  } catch {
    return null; // nothing saved yet (or storage unavailable)
  }
}

export function readMeta(): StuckModelMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<StuckModelMeta>;
    if (typeof m !== "object" || m === null || typeof m.trained_at !== "string") return null;
    return {
      trained_at: m.trained_at,
      synthetic_n: num(m.synthetic_n),
      real_n: num(m.real_n),
      epochs: num(m.epochs),
      train_ms: num(m.train_ms),
      threshold: typeof m.threshold === "number" ? m.threshold : DEFAULT_THRESHOLD,
    };
  } catch {
    return null;
  }
}

export function writeMeta(meta: StuckModelMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

export function readThreshold(): number {
  try {
    const v = Number(localStorage.getItem(THRESHOLD_KEY));
    return Number.isFinite(v) && v > 0 && v < 1 ? v : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

export function writeThreshold(t: number): void {
  try {
    localStorage.setItem(THRESHOLD_KEY, String(clip(t, 0.05, 0.95)));
  } catch {
    /* storage unavailable */
  }
}

/** The votes TutorWorkspace appended for this job (append-only array in localStorage). */
export function readStuckFeedback(jobId: string): StuckFeedback[] {
  try {
    const raw = localStorage.getItem(`expertai:stuck-feedback:${jobId}`);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (f): f is StuckFeedback =>
        typeof f === "object" && f !== null && typeof (f as StuckFeedback).label === "boolean" && typeof (f as StuckFeedback).signals === "object",
    );
  } catch {
    return [];
  }
}

// ---------- Training recipes ----------
/** v1: synthetic only. Saves the model and its meta. */
export async function trainV1(model: LayersModel, opts: TrainOptions & { threshold?: number } = {}): Promise<StuckModelMeta> {
  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  const r = await train(model, syntheticExamples(SYNTHETIC_N), { epochs, onEpoch: opts.onEpoch });
  const meta: StuckModelMeta = {
    trained_at: new Date().toISOString(),
    synthetic_n: SYNTHETIC_N,
    real_n: 0,
    epochs,
    train_ms: r.ms,
    threshold: opts.threshold ?? readThreshold(),
  };
  await saveModel(model);
  writeMeta(meta);
  return meta;
}

/** Retrain on 2,000 synthetic examples plus the real feedback weighted x5 (duplicated). Saves model + meta, returns the meta. */
export async function retrainWithFeedback(
  model: LayersModel,
  feedback: StuckFeedback[],
  opts: TrainOptions & { threshold?: number } = {},
): Promise<StuckModelMeta> {
  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  const real: StuckExample[] = feedback.map((f) => ({ signals: f.signals, label: f.label }));
  const weighted: StuckExample[] = [];
  for (let i = 0; i < REAL_WEIGHT; i++) weighted.push(...real);
  const examples = [...syntheticExamples(SYNTHETIC_N, 42 + feedback.length), ...weighted];
  const r = await train(model, examples, { epochs, onEpoch: opts.onEpoch });
  const meta: StuckModelMeta = {
    trained_at: new Date().toISOString(),
    synthetic_n: SYNTHETIC_N,
    real_n: real.length,
    epochs,
    train_ms: r.ms,
    threshold: opts.threshold ?? readThreshold(),
  };
  await saveModel(model);
  writeMeta(meta);
  return meta;
}

// ---------- Copy + audit ----------
const fmt = (n: number) => n.toLocaleString("en-US");

/** Honest one-liner about what the network was trained on. Never implies the rules or Work Map come from it. */
export function describeMeta(meta: StuckModelMeta | null | undefined): string {
  if (!meta) return "stuck detector not trained yet";
  if (meta.real_n > 0) return `stuck detector retrained on ${fmt(meta.real_n)} real example${meta.real_n === 1 ? "" : "s"}`;
  return `trained on ${fmt(meta.synthetic_n)} synthetic examples`;
}

/** Payload for logAudit("stuck", ...) and logAudit("stuck_feedback", ...): numbers only, no text or frames. */
export function stuckAuditPayload(signals: StuckFeedbackSignals, probability: number, label?: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: MODEL_NAME,
    probability: Math.round(clip(num(probability), 0, 1) * 1000) / 1000,
    signals: {
      idle_ms: Math.round(num(signals.idle_ms)),
      back_and_forth: Math.round(num(signals.back_and_forth)),
      hover_ms: Math.round(num(signals.hover_ms)),
      hesitation: Math.round(num(signals.hesitation)),
      since_help_ms: Math.round(num(signals.since_help_ms)),
      fields_touched: Math.round(num(signals.fields_touched)),
    },
  };
  if (typeof label === "boolean") payload.label = label;
  return payload;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
