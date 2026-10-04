import "server-only";
import type { WorkMap } from "@understudy/shared";
import { loadServerMap, saveServerMap } from "@/lib/serverMaps";
import { canonical } from "./audit";
import { supabaseConfigured } from "./config";
import { jobRow } from "./jobs";
import { dbError, RepositoryError, requireRole } from "./server";

/** Who may change a Work Map. new_hire never; anonymous never. */
const EDITORS = ["owner", "manager", "expert"] as const;

/** The job's latest Work Map. File mode: data/workmaps/<job>.json, version always 0. */
export async function getMap(jobId: string): Promise<{ map: WorkMap | null; version: number }> {
  if (!supabaseConfigured()) return { map: loadServerMap(jobId), version: 0 };
  const { db, orgId, id } = await jobRow(jobId);
  const { data, error } = await db.from("work_maps").select("map,version").eq("org_id", orgId).eq("job_id", id).maybeSingle();
  dbError(error);
  return { map: (data?.map as WorkMap) ?? null, version: data?.version ?? 0 };
}

// jsonb does not keep key order: compare with sorted keys.
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Save with an optimistic version check (compare-and-swap in save_work_map). Returns the new version.
 * expectedVersion "latest" = last write wins (callers without a version, e.g. the coverage interview).
 * A save whose map equals the stored one is a no-op returning the current version, so two paths saving the
 * same change (coverage save_map and the client's sync) never report a false conflict.
 */
export async function saveMap(jobId: string, map: WorkMap, expectedVersion: number | "latest"): Promise<number> {
  if (!supabaseConfigured()) {
    saveServerMap(jobId, map);
    return 0;
  }
  const { user } = await requireRole([...EDITORS]);
  if (map.job_id !== jobId) throw new RepositoryError("invalid map/version", 400);
  const { db, orgId, id } = await jobRow(jobId);
  const current = await getMap(jobId);
  if (current.map && same(current.map, map)) return current.version;
  const expected = expectedVersion === "latest" ? current.version : expectedVersion;
  if (!Number.isInteger(expected) || expected < 0) throw new RepositoryError("invalid map/version", 400);
  const { data, error } = await db.rpc("save_work_map", { oid: orgId, jid: id, value: map, expected, uid: user.id });
  if (error?.code === "40001") throw new RepositoryError("version conflict: reload the latest map", 409);
  dbError(error);
  return data as number;
}
