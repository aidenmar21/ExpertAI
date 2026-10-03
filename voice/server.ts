// Server-only voice code. Never import from the browser: it reads ELEVENLABS_API_KEY.
import type { AgentMode } from "./format";

export type { AgentMode };

export function agentIdFor(mode: AgentMode): string {
  const id = mode === "tutor" ? process.env.ELEVENLABS_TUTOR_AGENT_ID : process.env.ELEVENLABS_INTERVIEWER_AGENT_ID;
  if (!id) throw new Error(`missing ELEVENLABS_${mode === "tutor" ? "TUTOR" : "INTERVIEWER"}_AGENT_ID`);
  return id;
}

/** WebRTC conversation token for the interviewer or tutor agent. */
export async function getConversationToken(mode: AgentMode): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("missing ELEVENLABS_API_KEY");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentIdFor(mode))}`,
    { headers: { "xi-api-key": key }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`ElevenLabs token ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("ElevenLabs token response had no token");
  return body.token;
}

/**
 * Ready-made handler for GET /api/voice/token?mode=interviewer|tutor -> { token }.
 * In app/app/api/voice/token/route.ts:  export { voiceTokenRoute as GET } from "@understudy/voice/server";
 */
export async function voiceTokenRoute(req: Request): Promise<Response> {
  const mode = new URL(req.url).searchParams.get("mode") === "tutor" ? "tutor" : "interviewer";
  try {
    return Response.json({ token: await getConversationToken(mode) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
