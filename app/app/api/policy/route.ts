import type { Rule } from "@understudy/shared";
import { parsePolicy } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/job";

/** POST { job_id, text }: written company knowledge -> proposed rules (source "policy", unconfirmed). */
export async function POST(request: Request) {
  let body: { job_id?: string; text?: string };
  try {
    body = (await request.json()) as { job_id?: string; text?: string };
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!listJobIds().includes(id) || typeof body.text !== "string") {
    return Response.json({ error: "expected { job_id, text }" }, { status: 400 });
  }
  try {
    const rules: Rule[] = await parsePolicy(body.text, loadJob(id));
    return Response.json({ rules: rules.map((r) => ({ ...r, source: "policy", confirmed: false })) });
  } catch (err) {
    console.error("[api/policy]", err);
    return Response.json({ error: "could not parse the policy text" }, { status: 500 });
  }
}
