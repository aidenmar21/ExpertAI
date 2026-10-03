"use client";

import { useEffect, useState } from "react";

/**
 * Screen thumbnails for screen moments. Small JPEGs (about 240px wide) kept only in this browser's IndexedDB:
 * db "expertai-frames", store "frames", key frameId. Never sent to the server, never stored off the record.
 */
const DB = "expertai-frames";
const STORE = "frames";
const THUMB_WIDTH = 240;
const KEEP_PER_JOB = 300;

export interface FrameThumb {
  frameId: string;
  jobId: string;
  t: number;
  createdAt: number;
  /** data:image/jpeg;base64,... */
  dataUrl: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "frameId" });
        store.createIndex("jobId", "jobId", { unique: false });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Downscale a base64 JPEG frame to a ~240px-wide JPEG data URL via an offscreen canvas. */
export async function makeThumbnail(jpegBase64: string, width = THUMB_WIDTH): Promise<string> {
  const src = jpegBase64.startsWith("data:") ? jpegBase64 : `data:image/jpeg;base64,${jpegBase64}`;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const w = Math.min(width, img.naturalWidth || width);
  const h = Math.max(1, Math.round((img.naturalHeight || w) * (w / (img.naturalWidth || w))));
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    return await blobToDataUrl(blob);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.7);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Store a thumbnail, then trim the job to its newest 300. Best effort: never throws. */
export async function putFrame(jobId: string, frameId: string, jpegBase64: string, t: number): Promise<boolean> {
  try {
    const dataUrl = await makeThumbnail(jpegBase64);
    const db = await openDb();
    const thumb: FrameThumb = { frameId, jobId, t, createdAt: Date.now(), dataUrl };
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(thumb));
    cache.set(frameId, dataUrl);
    await trim(jobId);
    return true;
  } catch {
    return false;
  }
}

/** The thumbnail's data URL, or null. */
export async function getFrame(frameId: string): Promise<string | null> {
  if (cache.has(frameId)) return cache.get(frameId) ?? null;
  try {
    const db = await openDb();
    const row = (await done(db.transaction(STORE, "readonly").objectStore(STORE).get(frameId))) as FrameThumb | undefined;
    const url = row?.dataUrl ?? null;
    if (url) cache.set(frameId, url);
    return url;
  } catch {
    return null;
  }
}

/** Every thumbnail for a job, oldest first. */
export async function listForJob(jobId: string): Promise<FrameThumb[]> {
  try {
    const db = await openDb();
    const rows = (await done(db.transaction(STORE, "readonly").objectStore(STORE).index("jobId").getAll(jobId))) as FrameThumb[];
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function trim(jobId: string): Promise<void> {
  const rows = await listForJob(jobId);
  const extra = rows.length - KEEP_PER_JOB;
  if (extra <= 0) return;
  const db = await openDb();
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  for (const r of rows.slice(0, extra)) {
    store.delete(r.frameId);
    cache.delete(r.frameId);
  }
}

const cache = new Map<string, string>();

/** React hook: the thumbnail data URL for a frameId (null while loading or when missing). */
export function useFrame(frameId: string | undefined): string | null {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!frameId) return;
    let cancelled = false;
    void getFrame(frameId).then((url) => {
      if (!cancelled) setState({ id: frameId, url });
    });
    return () => {
      cancelled = true;
    };
  }, [frameId]);
  if (!frameId) return null;
  if (cache.has(frameId)) return cache.get(frameId) ?? null;
  return state?.id === frameId ? state.url : null;
}
