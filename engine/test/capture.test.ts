import assert from "node:assert/strict";
import { test } from "node:test";
import { startCapture } from "../index";
import type { VisionRequest, VisionResponse } from "../../shared/contracts";

// Deterministic browser boundary: exercise the real capture loop, including
// deferred network responses and input arriving while a request is in flight.
async function harness() {
  const keys = ["window", "document", "navigator", "performance", "fetch", "setTimeout", "clearTimeout"] as const;
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const install = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let now = 0;
  let color = 0;
  let nextId = 1;
  let stoppedTracks = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const listeners = new Map<string, () => void>();
  const requests: { body: VisionRequest; signal: AbortSignal; resolve: (r: Response) => void }[] = [];
  const results: VisionResponse[] = [];
  const video = { videoWidth: 80, videoHeight: 80, readyState: 2, play: async () => {}, pause() {}, srcObject: null };
  const context = { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(video.videoWidth * video.videoHeight * 4).fill(color) }) };
  const canvas = { width: 80, height: 80, getContext: () => context, toDataURL: () => `data:image/jpeg;base64,frame-${color}` };
  const track = { stop: () => { stoppedTracks++; }, addEventListener() {} };
  install("window", { addEventListener: (name: string, f: () => void) => listeners.set(name, f), removeEventListener: (name: string) => listeners.delete(name) });
  install("document", { createElement: (name: string) => name === "video" ? video : canvas });
  install("navigator", { mediaDevices: { getDisplayMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) } });
  install("performance", { now: () => now });
  install("setTimeout", (callback: () => void, delay: number) => { const id = nextId++; timers.set(id, { at: now + delay, callback }); return id; });
  install("clearTimeout", (id: number) => timers.delete(id));
  install("fetch", (_url: string, init: RequestInit) => new Promise<Response>((resolve) => {
    requests.push({ body: JSON.parse(String(init.body)), signal: init.signal as AbortSignal, resolve });
  }));
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const advance = async (ms: number) => {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    now = end;
    await flush();
  };
  const handle = await startCapture({ onResult: (r) => results.push(r) });
  const respond = async (index: number, ok = true) => {
    requests[index].resolve(ok ? Response.json({ screen_state: { view: "record_detail", record: { n: index }, visible_warnings: [] }, events: [] }) : new Response(null, { status: 503 }));
    await flush();
  };
  return { handle, requests, results, listeners, video, advance, respond,
    change: () => { color = color === 0 ? 255 : 0; },
    input: () => listeners.get("keydown")?.(),
    nextDelay: () => Math.min(...[...timers.values()].map((t) => t.at - now)),
    stoppedTracks: () => stoppedTracks,
    close: () => {
      handle.stop();
      for (const key of keys) {
        const descriptor = descriptors.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test("identical analyzed frames are skipped; active sampling becomes idle and input brings it forward", async () => {
  const h = await harness();
  try {
    await h.respond(0);
    await h.advance(5250);
    assert.equal(h.requests.length, 1);
    assert.equal(h.nextDelay(), 1000);
    await h.advance(100);
    h.input();
    assert.equal(h.nextDelay(), 650);
    h.change();
    await h.advance(649);
    assert.equal(h.requests.length, 1);
    await h.advance(1);
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.requests[1].body.previous_state?.record, { n: 0 });
  } finally { h.close(); }
});

test("changes during analysis drain immediately and input never overlaps requests", async () => {
  const h = await harness();
  try {
    h.change();
    await h.advance(1000);
    h.input();
    await h.advance(0);
    assert.equal(h.requests.length, 1);
    await h.respond(0);
    await h.advance(0);
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].body.frame_jpeg_base64, "frame-255");
    await h.respond(1);
    await h.advance(1000);
    assert.equal(h.requests.length, 2);
  } finally { h.close(); }
});

test("pause/stop abort requests, suppress late callbacks, and resume starts a fresh generation", async () => {
  const h = await harness();
  try {
    h.handle.pause();
    assert.equal(h.requests[0].signal.aborted, true);
    h.handle.resume();
    await h.advance(0);
    assert.equal(h.requests.length, 2);
    await h.respond(0);
    assert.equal(h.results.length, 0);
    await h.respond(1);
    assert.equal(h.results.length, 1);
    h.change();
    await h.advance(0);
    assert.equal(h.requests.length, 3);
    h.handle.stop();
    await h.respond(2);
    assert.equal(h.results.length, 1);
    assert.equal(h.requests[2].signal.aborted, true);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.stoppedTracks(), 1);
    h.handle.resume();
    await h.advance(10000);
    assert.equal(h.requests.length, 3);
  } finally { h.close(); }
});

test("failed transport retries unchanged pixels; resized surfaces are analyzed", async () => {
  const h = await harness();
  try {
    await h.respond(0, false);
    await h.advance(1000);
    assert.equal(h.requests.length, 2);
    await h.respond(1);
    await h.advance(0);
    h.video.videoWidth = 79; // same sampled column count, different surface geometry
    await h.advance(1000);
    assert.equal(h.requests.length, 3);
  } finally { h.close(); }
});
