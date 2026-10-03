import { seedWorkMap } from "@understudy/brain/server";
import { listJobIds } from "@/lib/job";

/** GET ?job=<id>&expert=<name>: a fresh Work Map seeded with the role's baseline rules (industry standard, unconfirmed). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("job") ?? "";
  if (!listJobIds().includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  return Response.json(seedWorkMap(id, url.searchParams.get("expert") || "Expert"));
}
