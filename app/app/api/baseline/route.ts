import { seedWorkMap } from "@/lib/db/brain";
import { listJobIds } from "@/lib/db/jobs";

/** GET ?job=<id>&expert=<name>: a fresh Work Map seeded with the role's baseline rules (industry standard, unconfirmed). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("job") ?? "";
  if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  return Response.json(await seedWorkMap(id, url.searchParams.get("expert") || "Expert"));
}
