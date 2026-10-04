// Browser-safe engine entry. Server-only code lives in server.ts.
import type {
  GateResult,
  GateSignals,
  ScreenState,
  StuckResult,
  StuckSignals,
  VisionRequest,
  VisionResponse,
} from "../shared/contracts";

const QUIET_MS = 1500;
const TARGET_WIDTH = 768;
const JPEG_QUALITY = 0.7;
const SAMPLE_STRIDE = 8;
const CHANNEL_DELTA = 28;
const MIN_CHANGED_SAMPLES = 10;
const ACTIVE_SAMPLE_MS = 750;
const IDLE_SAMPLE_MS = 1000;

/** Open only after 1.5s quiet on keyboard/mouse, speech, and screen changes. */
export function gate(signals: GateSignals): GateResult {
  if (signals.isSpeaking) return { open: false, reason: "someone is speaking" };
  if (signals.msSinceSpeech < QUIET_MS) return { open: false, reason: "recent speech" };
  if (signals.msSinceInput < QUIET_MS) return { open: false, reason: "recent input" };
  if (signals.msSinceScreenChange < QUIET_MS) return { open: false, reason: "recent screen change" };
  return { open: true, reason: "quiet for 1500ms" };
}

// ---------- Stuck detection (pure) ----------
const STUCK_IDLE_MS = 20_000;       // idle with a record open
const STUCK_FLIPS = 2;              // same field flipped back and forth in 30s
const STUCK_HOVER_MS = 4_000;       // hovering an action button
const STUCK_HESITATIONS = 2;        // "um", "wait", "I don't know" in the last 20s
const SECONDARY_WEIGHT = 0.2;       // weaker signals add a little on top of the strongest one

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const humanize = (key: string) => {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
};

/** Each signal as a fraction of its threshold, 0..1, with the hint it would produce. */
function stuckParts(s: StuckSignals): { score: number; hint: string }[] {
  const idleS = Math.round(s.msIdleWithRecordOpen / 1000);
  const hover = s.msHoveringAction;
  return [
    { score: clamp01(s.msIdleWithRecordOpen / STUCK_IDLE_MS), hint: `You've been on this one for ${idleS} seconds` },
    {
      score: clamp01(s.backAndForthCount / STUCK_FLIPS),
      hint: `You've changed the same field back and forth${s.backAndForthCount > 1 ? ` ${s.backAndForthCount} times` : ""}`,
    },
    { score: hover ? clamp01(hover.ms / STUCK_HOVER_MS) : 0, hint: hover ? `Hovering over ${humanize(hover.action)}` : "" },
    { score: clamp01(s.hesitationWords / STUCK_HESITATIONS), hint: "You sound unsure" },
  ];
}

/**
 * 0..1: how stuck the new hire looks. The strongest signal counts fully; the others add a little,
 * so two half-signals (10s idle plus one flip) read higher than either alone. 1 means stuck.
 */
export function stuckScore(s: StuckSignals): number {
  const scores = stuckParts(s).map((p) => p.score);
  const max = Math.max(...scores);
  const rest = scores.reduce((a, b) => a + b, 0) - max;
  return clamp01(max + SECONDARY_WEIGHT * rest);
}

/**
 * Stuck when any signal crosses its threshold (idle >= 20s with a record open, the same field flipped
 * twice, hovering an action >= 4s, two hesitation words) or the combined score reaches 1.
 * The hint names the strongest signal, e.g. "Hovering over Refund".
 */
export function detectStuck(s: StuckSignals): StuckResult {
  const parts = stuckParts(s);
  const strongest = parts.reduce((best, p) => (p.score > best.score ? p : best), parts[0]);
  const stuck = strongest.score >= 1 || stuckScore(s) >= 1;
  return { stuck, hint: stuck ? strongest.hint : "" };
}

/**
 * Capture the user's screen, sample every 750ms while active / 1s idle, and POST frames
 * that actually changed to /api/vision. The client keeps the last screen_state
 * and sends it back as previous_state.
 */
export interface CaptureHandle {
  stop(): void;
  /** Off the record: keep the share open but stop sampling and sending frames. */
  pause(): void;
  resume(): void;
  /** One frame now (JPEG base64, no data-url prefix), e.g. for app discovery. */
  grab(): string | null;
}

export async function startCapture(opts: {
  onResult: (r: VisionResponse) => void;
  /** Every frame that was sent for analysis (JPEG base64), before the result comes back. */
  onFrame?: (jpegBase64: string) => void;
  endpoint?: string;
  intervalMs?: number;
}): Promise<CaptureHandle> {
  const endpoint = opts.endpoint || "/api/vision";
  const fixedInterval = opts.intervalMs && opts.intervalMs > 0 ? opts.intervalMs : null;

  const stream = await captureDisplay();
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (video.videoWidth === 0) {
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("capture canvas unavailable");
  }
  const ctx = context;

  let stopped = false;
  let inFlight: AbortController | null = null;
  let lastSample: Uint8Array | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSampleAt = -Infinity;
  let lastActivityAt = -Infinity;
  let previousState: ScreenState | null = null;
  const startedAt = performance.now();

  let paused = false;
  function drawFrame(): boolean {
    if (video.readyState < 2 || video.videoWidth === 0) return false;
    const width = Math.min(TARGET_WIDTH, video.videoWidth);
    const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    return true;
  }

  function interval(): number {
    return fixedInterval ?? (performance.now() - lastActivityAt < 5000 ? ACTIVE_SAMPLE_MS : IDLE_SAMPLE_MS);
  }

  function schedule(delay = interval()): void {
    clearTimeout(timer);
    if (!stopped && !paused) timer = setTimeout(() => { void tick(); }, delay);
  }

  // Input in the hosting page is observable. Changes in a shared external window
  // also keep sampling active for five seconds after the pixel diff sees them.
  function onInput(): void {
    if (stopped || paused) return;
    lastActivityAt = performance.now();
    schedule(Math.max(0, lastSampleAt + interval() - performance.now()));
  }
  const inputEvents = ["keydown", "pointerdown", "input", "wheel"] as const;
  for (const event of inputEvents) window.addEventListener(event, onInput, { passive: true });

  async function tick(): Promise<void> {
    if (stopped || paused) return;
    if (inFlight || !drawFrame()) { schedule(); return; }
    lastSampleAt = performance.now();
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const sample = sampleFrame(pixels, width, height);
    // Compare against the last analyzed frame, not the last timer tick. Include
    // dimensions: a resized surface can have the same number of sampled pixels.
    if (lastSample && width === lastWidth && height === lastHeight && !frameChanged(lastSample, sample)) {
      schedule();
      return;
    }
    lastActivityAt = performance.now();
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const comma = dataUrl.indexOf(",");
    const frame = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const body: VisionRequest = {
      frame_jpeg_base64: frame,
      previous_state: previousState,
      t: Math.round(performance.now() - startedAt),
    };

    const controller = new AbortController();
    const requestGeneration = generation;
    inFlight = controller;
    let completed = false;
    try {
      opts.onFrame?.(frame);
      if (requestGeneration !== generation) return;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as VisionResponse;
      if (stopped || paused || requestGeneration !== generation) return;
      if (!json?.screen_state || !Array.isArray(json.events)) return;
      lastSample = sample;
      lastWidth = width;
      lastHeight = height;
      previousState = json.screen_state;
      completed = true;
      opts.onResult(json);
    } catch {
      // Leave lastSample unchanged so the next tick retries transport failures.
    } finally {
      if (inFlight === controller) inFlight = null;
      // Drain any change that happened during analysis immediately, without an
      // extra sampling interval. Identical frames return to the normal cadence.
      if (requestGeneration === generation) schedule(completed ? 0 : interval());
    }
  }

  void tick();

  function cancelPending(): void {
    generation++;
    clearTimeout(timer);
    inFlight?.abort();
    inFlight = null;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    cancelPending();
    for (const event of inputEvents) window.removeEventListener(event, onInput);
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }

  function grab(): string | null {
    if (stopped || !drawFrame()) return null;
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  stream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", stop);
  });

  return {
    stop,
    grab,
    pause: () => { paused = true; cancelPending(); },
    resume: () => {
      if (stopped || !paused) return;
      paused = false;
      lastSample = null;
      schedule(0);
    },
  };
}

async function captureDisplay(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("This browser can't share the screen. Open the page in Chrome or Safari, then click Start watching.");
  }
  const attempts: DisplayMediaStreamOptions[] = [
    { video: { frameRate: 4 }, audio: false },
    { video: true },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
      last = err;
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        throw new Error("Screen share was cancelled. Click Start watching and choose a window or screen.");
      }
    }
  }
  if (last instanceof DOMException && last.name === "NotSupportedError") {
    throw new Error("This browser can't share the screen. Open the page in Chrome or Safari, then click Start watching.");
  }
  throw last instanceof Error ? last : new Error("Could not start screen capture");
}

function sampleFrame(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const cols = Math.ceil(width / SAMPLE_STRIDE);
  const rows = Math.ceil(height / SAMPLE_STRIDE);
  const out = new Uint8Array(cols * rows * 3);
  let o = 0;
  for (let y = 0; y < height; y += SAMPLE_STRIDE) {
    for (let x = 0; x < width; x += SAMPLE_STRIDE) {
      const i = (y * width + x) * 4;
      out[o++] = data[i];
      out[o++] = data[i + 1];
      out[o++] = data[i + 2];
    }
  }
  return out;
}

function frameChanged(prev: Uint8Array, next: Uint8Array): boolean {
  const n = Math.min(prev.length, next.length);
  let changed = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    if (
      Math.abs(prev[i] - next[i]) > CHANNEL_DELTA ||
      Math.abs(prev[i + 1] - next[i + 1]) > CHANNEL_DELTA ||
      Math.abs(prev[i + 2] - next[i + 2]) > CHANNEL_DELTA
    ) {
      changed++;
      if (changed >= MIN_CHANGED_SAMPLES) return true;
    }
  }
  return false;
}
