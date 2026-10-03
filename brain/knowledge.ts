// Pre-loaded knowledge (server only): what ExpertAI already knows about a role and its software
// before meeting the expert. Reads knowledge/ from the repo root. Nothing here is company-specific.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { JobProfile, Rule } from "../shared/contracts";

export interface KnowledgeRole {
  id: string; name: string; category: string; summary: string;
  software: string[]; record_type: string; escalate_to: string;
}
export interface KnowledgeSoftware { id: string; name: string; kind: string; used_by: string[]; }
export interface KnowledgeIndex { roles: KnowledgeRole[]; software: KnowledgeSoftware[]; }

const DIRS = [join(process.cwd(), "knowledge"), join(process.cwd(), "..", "knowledge")];
const dir = () => DIRS.find((d) => existsSync(join(d, "index.json"))) ?? DIRS[0];
const read = (rel: string): string | null => {
  const p = join(dir(), rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

export function knowledgeIndex(): KnowledgeIndex {
  const raw = read("index.json");
  return raw ? (JSON.parse(raw) as KnowledgeIndex) : { roles: [], software: [] };
}
export const roleById = (id?: string) => knowledgeIndex().roles.find((r) => r.id === id) ?? null;
export const softwareById = (id: string) => knowledgeIndex().software.find((s) => s.id === id) ?? null;
export const roleDoc = (id: string) => read(`roles/${safe(id)}.md`);
export const softwareDoc = (id: string) => read(`software/${safe(id)}.md`);

/** Baseline rules for a role, in the Rule format (source "baseline", confirmed false). */
export function baselineRulesFor(roleId?: string): Rule[] {
  if (!roleId) return [];
  const raw = read("baseline-rules.json");
  if (!raw) return [];
  const all = JSON.parse(raw) as { roles: Record<string, Rule[]> };
  return (all.roles[roleId] ?? []).map((r) => ({ ...r, source: "baseline" as const, confirmed: false }));
}

/** Everything the agents should know for a job: role + software, from the job profile's ids. */
export function knowledgeForJob(job: JobProfile): { role: KnowledgeRole | null; software: KnowledgeSoftware[] } {
  const role = roleById(job.job.role_id);
  const ids = job.job.software_ids ?? role?.software ?? [];
  const software = ids.map(softwareById).filter((s): s is KnowledgeSoftware => !!s);
  return { role, software };
}

// ---------- Role briefing: role file + software files condensed to at most `maxWords` ----------

const ROLE_SECTIONS = [
  ["## 4.", "Standard workflow"],
  ["## 6.", "Standard guardrails"],
  ["## 5.", "Common judgment calls"],
  ["## 7.", "Mistakes new hires make"],
  ["## 1.", "Purpose"],
] as const;

/** Section body by numbered heading prefix ("## 4."). */
function section(md: string, prefix: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.startsWith(prefix));
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return rest.slice(0, end < 0 ? rest.length : end).join("\n").trim();
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
function clip(s: string, max: number): string {
  const w = s.split(/\s+/);
  return w.length <= max ? s : w.slice(0, max).join(" ") + " …";
}

/**
 * A briefing the interviewer and tutor read before the session, at most maxWords (default 1500).
 * Priority order: workflow, guardrails, judgment calls, mistakes, purpose, then each tool's screen vocabulary.
 */
export function briefingFor(job: JobProfile, maxWords = 1500): string {
  const { role, software } = knowledgeForJob(job);
  if (!role) return "";
  const md = roleDoc(role.id) ?? "";
  const budgets = [0.3, 0.25, 0.2, 0.1, 0.05].map((f) => Math.floor(maxWords * f));
  const parts: string[] = [`ROLE BRIEFING: ${role.name}. ${role.summary}`, `Usual escalation: ${role.escalate_to}.`];
  ROLE_SECTIONS.forEach(([prefix, title], i) => {
    const body = section(md, prefix);
    if (body) parts.push(`${title}:\n${clip(body, budgets[i])}`);
  });
  const perTool = Math.floor((maxWords * 0.1) / Math.max(1, software.length));
  for (const s of software) {
    const body = section(softwareDoc(s.id) ?? "", "## 3.");
    if (body) parts.push(`${s.name}, what you see on screen:\n${clip(body, perTool)}`);
  }
  let out = parts.join("\n\n");
  if (words(out) > maxWords) out = clip(out, maxWords);
  return out;
}

/** Field labels and status values a software file says appear on screen (for matching discovered fields). */
export function softwareVocabulary(ids: string[]): string[] {
  const vocab = new Set<string>();
  for (const id of ids) {
    const body = section(softwareDoc(id) ?? "", "## 3.");
    for (const m of body.matchAll(/\*\*([^*]+)\*\*|`([^`]+)`|^- ([^:(]+)/gm)) {
      const term = (m[1] ?? m[2] ?? m[3] ?? "").trim();
      if (term && term.length < 40) vocab.add(term.toLowerCase());
    }
  }
  return [...vocab];
}

const safe = (id: string) => id.replace(/[^a-z0-9-]/gi, "");
