import { supabaseConfigured } from "@/lib/db/config";
import { errorResponse, tenant } from "@/lib/db/server";

/** Browser probe: should the client sync Work Maps with the server? Never exposes keys. */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  if (!supabaseConfigured()) return Response.json({ enabled: false }, { headers });
  try {
    const { orgId, user } = await tenant();
    return Response.json({ enabled: true, signed_in: !!user, scope: `${orgId}:${user?.id ?? "anonymous"}` }, { headers });
  } catch (err) {
    return errorResponse(err);
  }
}
