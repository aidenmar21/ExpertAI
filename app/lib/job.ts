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

// ---------- Jobs dashboard + "New job" wizard (per-job data stays JSON in shared/jobs) ----------
import { knowledgeIndex, roleById, softwareById } from "@understudy/brain/server";

export interface CreateJobInput {
  name: string;
  role_id?: string | null;
  software_ids?: string[];
  written_policy?: string;
  escalate_to?: string;
  category?: string;
  business_date?: string;
}

/** What the dashboard shows per job: names resolved from knowledge/index.json via role_id / software_ids. */
export interface JobSummary {
  id: string;
  name: string;
  category: string;
  business_date: string;
  escalate_to: string;
  role: { id: string; name: string } | null;
  software: { id: string; name: string }[];
  record_type: string;
  screen_fields: number;
  has_written_policy: boolean;
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function jobSummary(id: string): JobSummary {
  return summarizeJob(loadJob(id));
}

export function summarizeJob(p: JobProfile): JobSummary {
  const role = roleById(p.job.role_id);
  const ids = p.job.software_ids ?? role?.software ?? [];
  return {
    id: p.job.id,
    name: p.job.name,
    category: p.job.category,
    business_date: p.job.business_date,
    escalate_to: p.job.escalate_to,
    role: role ? { id: role.id, name: role.name } : null,
    software: ids.map((s) => softwareById(s)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ id: s.id, name: s.name })),
    record_type: p.screen.record_type,
    screen_fields: p.screen.fields.length,
    has_written_policy: p.job.written_policy.trim().length > 0,
  };
}

export const listJobSummaries = (): JobSummary[] => listJobIds().map(jobSummary);

/**
 * Create shared/jobs/<id>.json from the wizard's choices. The screen starts empty: app discovery fills
 * fields and actions on the first screen share. Throws "exists" if the id is taken, "invalid" if unusable.
 */
export function createJob(input: CreateJobInput): JobProfile {
  const name = (input.name ?? "").trim();
  const id = slugify(name);
  if (!name || !id) throw new Error("invalid");
  if (listJobIds().includes(id) || fs.existsSync(path.join(JOBS_DIR, `${id}.json`))) throw new Error("exists");

  const profile = makeJobProfile(input);
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  fs.writeFileSync(path.join(JOBS_DIR, `${id}.json`), JSON.stringify(profile, null, 2) + "\n");
  return profile;
}

/** Pure profile factory shared by file and database repositories. */
export function makeJobProfile(input: CreateJobInput): JobProfile {
  const name = (input.name ?? "").trim();
  const id = slugify(name);
  if (!name || !id) throw new Error("invalid");
  const index = knowledgeIndex();
  const role = roleById(input.role_id ?? undefined);
  const known = new Set(index.software.map((s) => s.id));
  const software_ids = (input.software_ids ?? role?.software ?? []).filter((s) => known.has(s));

  const profile: JobProfile = {
    _readme: `Job profile for ${name}. Created by the New job wizard; the screen map is filled by app discovery on the first screen share. hidden_rules is the answer key (scoring only).`,
    job: {
      id,
      name,
      category: (input.category ?? role?.category ?? "General").trim() || "General",
      business_date: /^\d{4}-\d{2}-\d{2}$/.test(input.business_date ?? "") ? (input.business_date as string) : todayISO(),
      written_policy: (input.written_policy ?? "").trim(),
      escalate_to: (input.escalate_to ?? role?.escalate_to ?? "Manager").trim() || "Manager",
      ...(role ? { role_id: role.id } : {}),
      software_ids,
    },
    screen: { record_type: role?.record_type ?? "record", fields: [], actions: [] },
    records: { expert: [], new_hire: [] },
    hidden_rules: [],
  };
  return profile;
}
