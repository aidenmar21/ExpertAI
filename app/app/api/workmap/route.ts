import type { ScreenEvent, TranscriptLine } from "@understudy/shared";
import { buildWorkMap, confirmWorkMap, type WorkMapWithRecords } from "@understudy/brain/server";
import { listJobIds } from "@/lib/job";

interface WorkMapRequest {
  job_id: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  previous?: WorkMapWithRecords;
  confirm?: boolean; // expert said yes to the teach-back
}

// Callers send the FULL event + transcript history every time (brain rebuilds from scratch).
export async function POST(request: Request) {
  let body: WorkMapRequest;
  try {
    body = (await request.json()) as WorkMapRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!listJobIds().includes(body?.job_id) || !Array.isArray(body.events) || !Array.isArray(body.transcript)) {
    return Response.json({ error: "expected { job_id, expert, events, transcript, previous?, confirm? }" }, { status: 400 });
  }
  try {
    const { confirm, ...input } = body;
    const map = await buildWorkMap({ ...input, expert: input.expert || "Expert" });
    return Response.json(confirm ? confirmWorkMap(map) : map);
  } catch (err) {
    console.error("[api/workmap]", err);
    return Response.json({ error: "work map build failed" }, { status: 500 });
  }
}
