import { appendAudit, logModelCall } from "@/lib/db/audit";
import type { VisionRequest, VisionResponse } from "@understudy/shared";
import { analyzeFrame } from "@understudy/engine/server";
import { sessionFromHeaders } from "@understudy/brain/server";

export async function POST(request: Request) {
  let body: VisionRequest;
  try {
    body = (await request.json()) as VisionRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body?.frame_jpeg_base64 !== "string" || typeof body.t !== "number") {
    return Response.json({ error: "expected { frame_jpeg_base64, previous_state, t }" }, { status: 400 });
  }
  const session = sessionFromHeaders(request.headers);
  const started = Date.now();
  try {
    const result: VisionResponse = await analyzeFrame(body);
    // Not awaited: the audit write (a database round trip when Supabase is on) must never slow a frame.
    void audit(session, Date.now() - started, result);
    return Response.json(result);
  } catch (err) {
    // A failed frame should never break capture: report no events.
    console.error("[api/vision]", err);
    const empty: VisionResponse = {
      screen_state: body.previous_state ?? { view: "unknown", record: {}, visible_warnings: [] },
      events: [],
    };
    return Response.json(empty);
  }
}

// Audit: one model_call per frame and one screen_event per detected event. Never the frame, never detail text.
async function audit(session: string, latency_ms: number, result: VisionResponse) {
  try {
    await logModelCall(session, { model: process.env.VISION_MODEL, prompt_version: "vision-v1", latency_ms, redacted: true, purpose: "vision" });
    for (const e of result.events) {
      await appendAudit(session, {
        actor: "expert",
        type: "screen_event",
        payload: { event_id: e.id, t: e.t, type: e.type, field: e.field ?? null, from: e.from ?? null, to: e.to ?? null, record: e.record ?? null, confidence: e.confidence },
      });
    }
  } catch (err) {
    console.error("[api/vision] audit", err);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
