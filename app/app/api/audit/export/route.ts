import { auditToCsv, auditToJsonl, readAudit, safeSessionId } from "@understudy/brain/server";

/** GET ?session=<id>&format=jsonl|csv -> file download of that session's audit log. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session");
  if (!session) return Response.json({ error: "expected ?session=<id>" }, { status: 400 });
  const id = safeSessionId(session);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "jsonl";
  const entries = readAudit(id);
  const body = format === "csv" ? auditToCsv(entries) : auditToJsonl(entries);
  return new Response(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${id}.${format}"`,
      "cache-control": "no-store",
    },
  });
}
