import type { CreateJobInput } from "@/lib/job";
import { createJob, listJobSummaries } from "@/lib/db/jobs";

/** GET: every job in shared/jobs with its role and software names resolved from the knowledge index. */
export async function GET() {
  return Response.json({ jobs: await listJobSummaries() });
}

/** POST { name, role_id?, software_ids?, written_policy?, escalate_to?, category?, business_date? }: create shared/jobs/<id>.json. */
export async function POST(request: Request) {
  let body: CreateJobInput;
  try {
    body = (await request.json()) as CreateJobInput;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "expected { name, role_id?, software_ids?, written_policy? }" }, { status: 400 });
  }
  try {
    const profile = await createJob({
      name: body.name,
      role_id: typeof body.role_id === "string" ? body.role_id : null,
      software_ids: Array.isArray(body.software_ids) ? body.software_ids.filter((s): s is string => typeof s === "string") : undefined,
      written_policy: typeof body.written_policy === "string" ? body.written_policy : "",
      escalate_to: typeof body.escalate_to === "string" ? body.escalate_to : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      business_date: typeof body.business_date === "string" ? body.business_date : undefined,
    });
    return Response.json({ id: profile.job.id, job: profile.job, screen: profile.screen }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg === "exists") return Response.json({ error: "a job with that name already exists" }, { status: 409 });
    if (msg === "invalid") return Response.json({ error: "name must contain letters or numbers" }, { status: 400 });
    console.error("[api/jobs]", err);
    return Response.json({ error: "could not create the job" }, { status: 500 });
  }
}
