import { knowledgeIndex } from "@understudy/brain/server";

/** GET: the pre-loaded knowledge index (roles + software) from knowledge/index.json. Nothing company-specific. */
export async function GET() {
  const { roles, software } = knowledgeIndex();
  return Response.json({ roles, software });
}
