import "server-only";
import type { WorkMap } from "@understudy/shared";
import { loadServerMap, saveServerMap } from "@/lib/serverMaps";
import { supabaseConfigured } from "./config";
import { jobRow } from "./jobs";
import { dbError, RepositoryError, requireRole } from "./server";
export async function getMap(jobId: string): Promise<{ map: WorkMap | null; version: number }> {
  if (!supabaseConfigured()) return { map: loadServerMap(jobId), version: 0 };
  const { db, orgId, id } = await jobRow(jobId);
  const { data, error } = await db.from("work_maps").select("map,version").eq("org_id", orgId).eq("job_id", id).maybeSingle();
  dbError(error);
  return { map: (data?.map as WorkMap) ?? null, version: data?.version ?? 0 };
}
export async function saveMap(jobId: string, map: WorkMap, expectedVersion: number) {
  if (!supabaseConfigured()) { saveServerMap(jobId, map); return 0; }
  await requireRole(["owner", "manager", "expert"]);
  if (map.job_id !== jobId || !Number.isInteger(expectedVersion) || expectedVersion < 0) throw new RepositoryError("invalid map/version", 400);
  const { db, orgId, id, user } = await jobRow(jobId);
  const { data, error } = await db.rpc("save_work_map", { oid: orgId, jid: id, value: map, expected: expectedVersion, uid: user.id });
  if (error?.code === "40001") throw new RepositoryError("version conflict: reload the latest map", 409);
  dbError(error);
  return data as number;
}
