import type { QuestionPick, ScreenEvent, TranscriptLine, WorkMap } from "@understudy/shared";
import { pickQuestion } from "@understudy/engine/server";
import { listJobIds, loadJob } from "@/lib/job";

interface QuestionRequest { job_id: string; recent: ScreenEvent[]; transcript: TranscriptLine[]; map: WorkMap; }

// Engine may take the transcript as an optional 4th argument; extra args are harmless until it does.
const pick = pickQuestion as (
  recent: ScreenEvent[], map: WorkMap, policy: string, transcript?: TranscriptLine[],
) => Promise<QuestionPick | null>;

export async function POST(request: Request) {
  let body: QuestionRequest;
  try {
    body = (await request.json()) as QuestionRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!listJobIds().includes(body?.job_id) || !Array.isArray(body.recent) || !body.map) {
    return Response.json({ error: "expected { job_id, recent, transcript, map }" }, { status: 400 });
  }
  try {
    const policy = loadJob(body.job_id).job.written_policy;
    const result: QuestionPick | null = await pick(body.recent, body.map, policy, body.transcript ?? []);
    return Response.json(result);
  } catch (err) {
    console.error("[api/question]", err);
    return Response.json(null); // stay silent on failure
  }
}
