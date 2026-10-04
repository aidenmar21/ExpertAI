import { supabaseConfigured } from "@/lib/db/config";
import { tenant } from "@/lib/db/server";
export async function GET() {
  if (!supabaseConfigured()) return Response.json({ enabled: false }, { headers: { "cache-control": "no-store" } });
  const { orgId, user } = await tenant();
  return Response.json({ enabled: true, scope: `${orgId}:${user.id}` }, { headers: { "cache-control": "no-store" } });
}
