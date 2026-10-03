import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { JobProfile, Value } from "@understudy/shared";

export type JobRecord = Record<string, Value>;

/** What the browser gets: never hidden_rules, traps, or expected answers. */
export interface ClientJob {
  job: JobProfile["job"];
  screen: JobProfile["screen"];
  records: { expert: JobRecord[]; new_hire: JobRecord[] };
}

const JOBS_DIR = path.join(process.cwd(), "..", "shared", "jobs");

export function listJobIds(): string[] {
  return fs
    .readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".seed.json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function loadJob(id: string): JobProfile {
  const file = path.join(JOBS_DIR, `${path.basename(id)}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as JobProfile;
}

export function toClientJob(profile: JobProfile): ClientJob {
  return { job: profile.job, screen: profile.screen, records: recordsFor(profile) };
}

/**
 * Prefer profile.records ({expert, new_hire}). Until a job file has it, fall back to
 * any array named *_cases, copying only keys that are screen fields.
 */
function recordsFor(profile: JobProfile): ClientJob["records"] {
  const keys = profile.screen.fields.map((f) => f.key);
  const pick = (row: Record<string, unknown>): JobRecord => {
    const rec: JobRecord = {};
    for (const k of keys) {
      const v = row[k];
      rec[k] = typeof v === "string" || typeof v === "number" ? v : null;
    }
    const status = profile.screen.fields.find((f) => f.type === "status");
    if (status && rec[status.key] == null) rec[status.key] = status.options?.[0] ?? null;
    return rec;
  };

  const given = profile.records as { expert?: unknown[]; new_hire?: unknown[] } | undefined;
  if (given && (Array.isArray(given.expert) || Array.isArray(given.new_hire))) {
    return {
      expert: (given.expert ?? []).map((r) => pick(r as Record<string, unknown>)),
      new_hire: (given.new_hire ?? []).map((r) => pick(r as Record<string, unknown>)),
    };
  }

  const caseArrays = Object.entries(profile).filter(
    ([k, v]) => k.endsWith("_cases") && Array.isArray(v),
  ) as [string, Record<string, unknown>[]][];
  const expert = caseArrays.find(([k]) => k.startsWith("expert"))?.[1] ?? [];
  const newHire = caseArrays.find(([k]) => k.startsWith("new_hire"))?.[1] ?? [];
  return { expert: expert.map(pick), new_hire: newHire.map(pick) };
}
