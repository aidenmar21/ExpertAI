import type { QuestionPick, ScreenEvent, ScreenState, TranscriptLine, WorkMap } from "@understudy/shared";
import { pickQuestion } from "@understudy/engine/server";
import { baselineRulesFor, roleById } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/job";

interface QuestionRequest {
  job_id: string;
  recent: ScreenEvent[];
  transcript: TranscriptLine[];
  map: WorkMap;
  screen?: ScreenState | null;   // latest screen state from capture
  asked_guardrail?: boolean;     // has a guardrail question been asked this session
}

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
    const job = loadJob(body.job_id);
    const result: QuestionPick | null = await pickQuestion(body.recent, body.map, job.job.written_policy, body.transcript ?? [], {
      baseline: baselineRulesFor(job.job.role_id),
      screen: body.screen ?? null,
      job,
      askedGuardrail: body.asked_guardrail ?? false,
      roleName: roleById(job.job.role_id)?.name,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[api/question]", err);
    return Response.json(null); // stay silent on failure
  }
}
