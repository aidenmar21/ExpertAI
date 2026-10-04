import { buildWorkMap, seedWorkMap } from "@/lib/db/brain";
import type { ScreenEvent, TranscriptLine } from "@understudy/shared";
import { confirmWorkMap } from "@understudy/brain/server";
import { listJobIds } from "@/lib/db/jobs";
import { saveMap } from "@/lib/db/workMaps";
import { requireRole, errorResponse } from "@/lib/db/server";
import { supabaseConfigured } from "@/lib/db/config";

/**
 * POST { job_id } -> a confirmed Work Map built from a scripted expert session (demo fallback).
 * Lets the new-hire part of the demo run even if the live expert session hiccups.
 * Runs the real pipeline (buildWorkMap calls the LLM, then confirmWorkMap), only the input is scripted.
 */

const SEEDED_EXPERT = "Aarav (seeded)";

const ev = (id: string, t: number, record: string | undefined, field: string, from: string | null, to: string, type: ScreenEvent["type"] = "field_changed"): ScreenEvent =>
  ({ id, t, type, record, field, from, to, confidence: 0.95, detail: `${field} ${from ?? "empty"} -> ${to}` });

const L = (t: number, speaker: TranscriptLine["speaker"], text: string): TranscriptLine => ({ t, speaker, text });

/** Scripted sessions per job. Only the returns desk has one (the deep demo job). */
const SCRIPTS: Record<string, { events: ScreenEvent[]; transcript: TranscriptLine[] }> = {
  "returns-desk": {
    events: [
      ev("demo-x2", 20_000, "R-88102", "status", "Open", "Denied", "status_changed"), // X2 opened access code
      ev("demo-x3", 60_000, undefined, "refund_method", null, "Store credit"), // X3 no receipt
      ev("demo-x4", 100_000, "R-88104", "refund_method", "Cash", "Original card"), // X4 customer asked for cash
    ],
    transcript: [
      L(23_000, "agent", "Why did you deny that one?"),
      L(25_000, "expert", "Opened access codes are never refundable."),
      L(63_000, "agent", "Why store credit there?"),
      L(65_000, "expert", "No receipt means store credit only."),
      L(70_000, "agent", "Is there a point where you'd stop and ask someone instead?"),
      L(72_000, "expert", "If it's over a hundred dollars I call the shift manager."),
      L(103_000, "agent", "Why the card and not cash?"),
      L(105_000, "expert", "Card payments go back to the card, never cash."),
      L(400_000, "agent", "Here's what I learned: opened access codes are never refundable, no receipt means store credit only, over a hundred dollars you call the shift manager, and card payments go back to the card. Is that right?"),
      L(404_000, "expert", "Yes, that's right."),
    ],
  },
};

export async function POST(request: Request) {
  let body: { job_id?: string };
  try {
    body = (await request.json()) as { job_id?: string };
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const jobId = body?.job_id ?? "";
  if (!(await listJobIds()).includes(jobId)) return Response.json({ error: "unknown job" }, { status: 404 });
  const script = SCRIPTS[jobId];
  if (!script) return Response.json({ error: `no scripted session for ${jobId}` }, { status: 400 });
  try {
    if (supabaseConfigured()) await requireRole(["owner", "manager", "expert"]);
    const built = await buildWorkMap({
      job_id: jobId,
      expert: SEEDED_EXPERT,
      events: script.events,
      transcript: script.transcript,
      previous: await seedWorkMap(jobId, SEEDED_EXPERT),
    });
    const map = confirmWorkMap(built);
    await saveMap(jobId, map, "latest"); // the extension checks against this copy (versioned in Postgres)
    return Response.json(map);
  } catch (err) {
    if (supabaseConfigured()) return errorResponse(err);
    console.error("[api/demo]", err);
    return Response.json({ error: "seeding the Work Map failed" }, { status: 500 });
  }
}
