import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { JobProfile } from "@understudy/shared";
import * as files from "@/lib/job";
import { supabaseConfigured } from "./config";
import { dbError, requireRole, tenant, RepositoryError } from "./server";

export async function listJobs(): Promise<JobProfile[]> {
  if (!supabaseConfigured()) return files.listJobIds().map(files.loadJob);
  const { db, orgId } = await tenant();
  const { data, error } = await db.from("jobs").select("profile").eq("org_id", orgId).order("slug");
  dbError(error);
  return (data ?? []).map((r) => r.profile as JobProfile);
}
export async function listJobIds(): Promise<string[]> {
  if (!supabaseConfigured()) return files.listJobIds();
  const { db, orgId } = await tenant();
  const { data, error } = await db.from("jobs").select("slug").eq("org_id", orgId).order("slug");
  dbError(error);
  return (data ?? []).map((r) => r.slug as string);
}
export async function listJobSummaries() {
  if (!supabaseConfigured()) return files.listJobSummaries();
  return (await listJobs()).map(files.summarizeJob);
}
export async function jobRow(slug: string) {
  const ctx = await tenant();
  const { data, error } = await ctx.db.from("jobs").select("id,profile").eq("org_id", ctx.orgId).eq("slug", slug).maybeSingle();
  dbError(error);
  if (!data) throw new RepositoryError("unknown job", 404);
  return { ...ctx, id: data.id as string, profile: data.profile as JobProfile };
}
export async function loadJob(id: string): Promise<JobProfile> {
  if (!supabaseConfigured()) return files.loadJob(id);
  return (await jobRow(id)).profile;
}
export async function createJob(input: files.CreateJobInput) {
  if (!supabaseConfigured()) return files.createJob(input);
  const { db, orgId } = await requireRole(["owner", "manager"]);
  const profile = files.makeJobProfile(input);
  const { error } = await db.from("jobs").insert({ org_id: orgId, slug: profile.job.id, profile, role_id: profile.job.role_id, software_ids: profile.job.software_ids ?? [] });
  dbError(error);
  return profile;
}
export async function saveScreen(id: string, screen: JobProfile["screen"]) {
  if (supabaseConfigured()) await requireRole(["owner", "manager"]);
  const job = await loadJob(id);
  job.screen = {
    record_type: String(screen.record_type || job.screen.record_type || "record"),
    fields: screen.fields.map((f) => ({ key: String(f.key), label: String(f.label), type: f.type, ...(f.options ? { options: f.options } : {}), ...(f.pii ? { pii: true } : {}), ...(f.readonly ? { readonly: true } : {}) })),
    actions: screen.actions.map((a) => ({ key: String(a.key), label: String(a.label), sets: a.sets ?? {} })),
  };
  job.screen_discovered_at = new Date().toISOString();
  if (!supabaseConfigured()) fs.writeFileSync(path.join(process.cwd(), "..", "shared", "jobs", `${path.basename(id)}.json`), JSON.stringify(job, null, 2) + "\n");
  else {
    const { db, orgId } = await tenant();
    const { error } = await db.from("jobs").update({ profile: job }).eq("org_id", orgId).eq("slug", id);
    dbError(error);
  }
  return job;
}
