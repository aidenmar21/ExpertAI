import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { WorkMap } from "@understudy/shared";

/** Server copy of each job's latest Work Map, so clients without browser storage (the extension) can be checked. */
const DIR = path.join(process.cwd(), "..", "data", "workmaps");
const file = (jobId: string) => path.join(DIR, `${path.basename(jobId)}.json`);

export function saveServerMap(jobId: string, map: WorkMap) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file(jobId), JSON.stringify(map));
  } catch (err) {
    console.error("[serverMaps] save", err);
  }
}

export function loadServerMap(jobId: string): WorkMap | null {
  try {
    return JSON.parse(fs.readFileSync(file(jobId), "utf8")) as WorkMap;
  } catch {
    return null;
  }
}
