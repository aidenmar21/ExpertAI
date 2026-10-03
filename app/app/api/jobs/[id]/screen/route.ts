import fs from "node:fs";
import path from "node:path";
import type { JobProfile } from "@understudy/shared";
import { listJobIds } from "@/lib/job";

/** POST: save a reviewed screen map into the job's JSON (per-job data stays JSON). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!listJobIds().includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  let screen: JobProfile["screen"];
  try {
    screen = (await request.json()) as JobProfile["screen"];
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!screen || !Array.isArray(screen.fields) || !Array.isArray(screen.actions)) {
    return Response.json({ error: "expected { record_type, fields, actions }" }, { status: 400 });
  }
  const file = path.join(process.cwd(), "..", "shared", "jobs", `${path.basename(id)}.json`);
  const job = JSON.parse(fs.readFileSync(file, "utf8")) as JobProfile;
  job.screen = {
    record_type: String(screen.record_type || job.screen.record_type || "record"),
    fields: screen.fields.map((f) => ({ key: String(f.key), label: String(f.label), type: f.type, ...(f.options ? { options: f.options } : {}), ...(f.pii ? { pii: true } : {}), ...(f.readonly ? { readonly: true } : {}) })),
    actions: screen.actions.map((a) => ({ key: String(a.key), label: String(a.label), sets: a.sets ?? {} })),
  };
  job.screen_discovered_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(job, null, 2) + "\n");
  return Response.json({ ok: true, fields: job.screen.fields.length, actions: job.screen.actions.length });
}
