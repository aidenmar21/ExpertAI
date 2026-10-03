import type { QuestionPick, ScreenEvent, WorkMap } from "@understudy/shared";
import { appendAudit, scoreSession, sessionFromHeaders } from "@understudy/brain/server";
import { listJobIds } from "@/lib/job";

interface ScoreRequest {
  job_id: string;
  map: WorkMap;
  ground_truth?: { t: number; field: string; from: unknown; to: unknown; record: string | null }[];
  events?: ScreenEvent[];
  questions?: QuestionPick[];
}

/**
 * Scores this browser's session against the job's answer key (hidden_rules with probes,
 * new-hire expectations). The answer key stays on the server; only numbers and ids go back.
 */
export async function POST(request: Request) {
  let body: ScoreRequest;
  try {
    body = (await request.json()) as ScoreRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!listJobIds().includes(body?.job_id) || !body.map) {
    return Response.json({ error: "expected { job_id, map, ... }" }, { status: 400 });
  }
  try {
    const result = scoreSession({
      job_id: body.job_id,
      map: body.map,
      groundTruth: (body.ground_truth ?? []).map((g) => ({
        t: g.t, field: g.field, record: g.record ?? undefined,
        from: g.from as never, to: g.to as never,
      })),
      events: body.events ?? [],
      questions: body.questions ?? [],
    });
    try {
      appendAudit(sessionFromHeaders(request.headers), { actor: "system", type: "scoreboard", payload: { job_id: body.job_id, ...result.scoreboard } });
    } catch (err) {
      console.error("[api/score] audit", err);
    }
    return Response.json(result);
  } catch (err) {
    console.error("[api/score]", err);
    return Response.json({ error: "score failed" }, { status: 500 });
  }
}
