import type { JobProfile } from "@understudy/shared";
import { listJobIds, saveScreen } from "@/lib/db/jobs";
import { errorResponse } from "@/lib/db/server";
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let screen: JobProfile["screen"];
  try { screen = await request.json(); }
  catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
  if (!screen || !Array.isArray(screen.fields) || !Array.isArray(screen.actions)) return Response.json({ error: "expected { record_type, fields, actions }" }, { status: 400 });
  try {
    if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
    const job = await saveScreen(id, screen);
    return Response.json({ ok: true, fields: job.screen.fields.length, actions: job.screen.actions.length });
  } catch (error) { return errorResponse(error); }
}
