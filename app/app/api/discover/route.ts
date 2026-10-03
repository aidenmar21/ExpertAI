import type { JobProfile } from "@understudy/shared";
import { discoverScreen } from "@understudy/engine/server";
import { knowledgeForJob, softwareVocabulary } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/job";

export interface DiscoveredField { key: string; label: string; type: string; options?: string[]; known: boolean; }

/**
 * POST { job_id, frame_jpeg_base64 }: learn the app's layout from one frame and mark which labels
 * the job's software knowledge already describes.
 */
export async function POST(request: Request) {
  let body: { job_id?: string; frame_jpeg_base64?: string };
  try {
    body = (await request.json()) as { job_id?: string; frame_jpeg_base64?: string };
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!listJobIds().includes(id) || typeof body.frame_jpeg_base64 !== "string") {
    return Response.json({ error: "expected { job_id, frame_jpeg_base64 }" }, { status: 400 });
  }
  const job = loadJob(id);
  const screen: JobProfile["screen"] = await discoverScreen(body.frame_jpeg_base64);
  const { software } = knowledgeForJob(job);
  const vocab = softwareVocabulary(software.map((s) => s.id));
  const known = (label: string) => {
    const l = label.toLowerCase();
    return vocab.some((v) => v === l || l.includes(v) || v.includes(l));
  };
  const fields: DiscoveredField[] = screen.fields.map((f) => ({ ...f, known: known(f.label) }));
  const actions = screen.actions.map((a) => ({ ...a, known: known(a.label) }));
  return Response.json({ record_type: screen.record_type, fields, actions, software: software.map((s) => s.name) });
}
