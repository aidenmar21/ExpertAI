import type { VisionRequest, VisionResponse } from "@understudy/shared";
import { analyzeFrame } from "@understudy/engine/server";

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
  try {
    const result: VisionResponse = await analyzeFrame(body);
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

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
