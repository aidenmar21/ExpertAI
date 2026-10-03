// Push shared/prompts/*.md to the two ElevenLabs agents. Run from the repo root: node scripts/sync-agents.mjs
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("app/.env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const prompt = (f) => fs.readFileSync(`shared/prompts/${f}`, "utf8").replace(/^# .*\n+/, "");
const agents = [["interviewer.md", env.ELEVENLABS_INTERVIEWER_AGENT_ID], ["tutor.md", env.ELEVENLABS_TUTOR_AGENT_ID]];
for (const [file, id] of agents) {
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`, {
    method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ conversation_config: { agent: { prompt: { prompt: prompt(file) } } } }),
  });
  console.log(file, "->", id, r.status, r.ok ? "" : (await r.text()).slice(0, 200));
}
