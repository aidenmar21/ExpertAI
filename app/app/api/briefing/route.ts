import { appendAudit } from "@/lib/db/audit";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { briefingFor, knowledgeForJob, sessionFromHeaders } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/db/jobs";

const KB_FILE = path.join(process.cwd(), "..", "data", "kb.json");

interface KbState { [jobId: string]: { hash: string; doc_id: string; name: string } }

/** GET ?job=<id>: the role briefing (≤1500 words) and what it was built from. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("job") ?? "";
  if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  const job = (await loadJob(id));
  const { role, software } = knowledgeForJob(job);
  return Response.json({ briefing: briefingFor(job), role, software, words: briefingFor(job).split(/\s+/).length });
}

/**
 * POST { job_id }: same as GET, and (unless EXPERTAI_KB_SYNC=0) uploads the briefing to the ElevenLabs
 * knowledge base once per content hash and attaches it to both agents, so the agents also have it as a document.
 */
export async function POST(request: Request) {
  let body: { job_id?: string };
  try {
    body = (await request.json()) as { job_id?: string };
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  const job = (await loadJob(id));
  const briefing = briefingFor(job);
  const { role, software } = knowledgeForJob(job);
  let kb: { doc_id: string; synced: boolean; error?: string } | null = null;
  if (briefing && process.env.EXPERTAI_KB_SYNC !== "0" && process.env.ELEVENLABS_API_KEY) {
    kb = await syncKnowledgeBase(id, `ExpertAI briefing: ${job.job.name}`, briefing).catch((e: Error) => ({ doc_id: "", synced: false, error: e.message }));
  }
  try {
    await appendAudit(sessionFromHeaders(request.headers), {
      actor: "system",
      type: "session_start",
      payload: { job_id: id, job_name: job.job.name, briefing_words: briefing ? briefing.split(/\s+/).length : 0, kb_synced: kb?.synced ?? false, role_id: job.job.role_id ?? null },
    });
  } catch (err) {
    console.error("[api/briefing] audit", err);
  }
  return Response.json({ briefing, role, software, kb });
}

async function syncKnowledgeBase(jobId: string, name: string, text: string) {
  const key = process.env.ELEVENLABS_API_KEY!;
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const state = readState();
  if (state[jobId]?.hash === hash) return { doc_id: state[jobId].doc_id, synced: false };

  const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/text", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ name: `${name} (${hash})`, text }),
  });
  if (!res.ok) throw new Error(`knowledge-base ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const doc = (await res.json()) as { id: string; name: string };

  const agents = [process.env.ELEVENLABS_INTERVIEWER_AGENT_ID, process.env.ELEVENLABS_TUTOR_AGENT_ID].filter(Boolean) as string[];
  for (const agentId of agents) {
    const cur = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": key } });
    if (!cur.ok) continue;
    const cfg = (await cur.json()) as { conversation_config?: { agent?: { prompt?: { knowledge_base?: { id: string; name: string; type: string; usage_mode?: string }[] } } } };
    const existing = (cfg.conversation_config?.agent?.prompt?.knowledge_base ?? []).filter(
      (d) => d.id !== state[jobId]?.doc_id && !d.name.startsWith(name), // replace this job's old briefing
    );
    const knowledge_base = [...existing, { type: "text", name: doc.name, id: doc.id, usage_mode: "auto" }];
    await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ conversation_config: { agent: { prompt: { knowledge_base } } } }),
    });
  }
  state[jobId] = { hash, doc_id: doc.id, name: doc.name };
  writeState(state);
  return { doc_id: doc.id, synced: true };
}

function readState(): KbState {
  try {
    return JSON.parse(fs.readFileSync(KB_FILE, "utf8")) as KbState;
  } catch {
    return {};
  }
}
function writeState(s: KbState) {
  fs.mkdirSync(path.dirname(KB_FILE), { recursive: true });
  fs.writeFileSync(KB_FILE, JSON.stringify(s, null, 2));
}
