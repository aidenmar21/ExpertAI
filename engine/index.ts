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

/** Open only after 1.5s quiet on keyboard/mouse, speech, and screen changes. */
export function gate(signals: GateSignals): GateResult {
  if (signals.isSpeaking) return { open: false, reason: "someone is speaking" };
  if (signals.msSinceSpeech < QUIET_MS) return { open: false, reason: "recent speech" };
  if (signals.msSinceInput < QUIET_MS) return { open: false, reason: "recent input" };
  if (signals.msSinceScreenChange < QUIET_MS) return { open: false, reason: "recent screen change" };
  return { open: true, reason: "quiet for 1500ms" };
}

/** Step 1 stub. Stuck detection lands with the tutor. */
export function detectStuck(_signals: StuckSignals): StuckResult {
  return { stuck: false, hint: "" };
}

/**
 * Capture the user's screen, sample about every 1.5s at ~768px, and POST frames
 * that actually changed to /api/vision. The client keeps the last screen_state
 * and sends it back as previous_state.
 */
export async function startCapture(opts: {
  onResult: (r: VisionResponse) => void;
  endpoint?: string;
  intervalMs?: number;
}): Promise<{ stop(): void }> {
  const endpoint = opts.endpoint || "/api/vision";
  const intervalMs = opts.intervalMs && opts.intervalMs > 0 ? opts.intervalMs : 1500;

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 2 },
    audio: false,
  });
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
  let inFlight = false;
  let lastSample: Uint8Array | null = null;
  let previousState: ScreenState | null = null;
  const startedAt = performance.now();

  async function tick(): Promise<void> {
    if (stopped || inFlight || video.readyState < 2 || video.videoWidth === 0) return;
    const width = Math.min(TARGET_WIDTH, video.videoWidth);
    const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const sample = sampleFrame(pixels, width, height);
    if (lastSample && !frameChanged(lastSample, sample)) return;

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const comma = dataUrl.indexOf(",");
    const frame = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const body: VisionRequest = {
      frame_jpeg_base64: frame,
      previous_state: previousState,
      t: Math.round(performance.now() - startedAt),
    };

    inFlight = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const json = (await res.json()) as VisionResponse;
      if (!json?.screen_state || !Array.isArray(json.events)) return;
      lastSample = sample;
      previousState = json.screen_state;
      opts.onResult(json);
    } catch {
      // Leave lastSample unchanged so the next tick retries this frame.
    } finally {
      inFlight = false;
    }
  }

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();

  function stop(): void {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }

  stream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", stop);
  });

  return { stop };
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
