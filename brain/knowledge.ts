// Pre-loaded knowledge (server only): what ExpertAI already knows about a role and its software
// before meeting the expert. Reads knowledge/ from the repo root. Nothing here is company-specific.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { JobProfile, Rule, Value } from "../shared/contracts";

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

// ---------- Proactive guidance: the next usual step for a record, from the role file ----------

export interface NextStep { step: string; judgment?: string; guardrail?: string; }

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "it", "is", "are", "was", "be", "to", "of", "in", "on", "at", "for", "by", "with",
  "from", "that", "this", "than", "then", "as", "its", "our", "your", "their", "has", "have", "not", "very", "if",
  "wants", "shows", "clearly", "nothing", "them", "there", "after", "before", "now", "still", "present",
]);
const KEY_NOISE = new Set(["no", "num", "number", "id", "code"]);
const EMPTY_WORDS = ["no", "none", "missing", "without"];

const isEmpty = (v: Value | undefined) => v === null || v === undefined || v === "";
const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9$]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w));
const keyWords = (key: string) => tokens(key.replace(/_/g, " ")).filter((w) => !KEY_NOISE.has(w));
const unique = (xs: string[]) => [...new Set(xs)];

/** Bullets of a section ("- ..."), markdown kept. */
const bullets = (body: string): string[] =>
  body.split("\n").filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, "").trim());
/** Numbered steps of a section ("1. ..."), markdown kept. */
const numbered = (body: string): string[] =>
  body.split("\n").filter((l) => /^\s*\d+\.\s/.test(l)).map((l) => l.replace(/^\s*\d+\.\s+/, "").trim());

/** Markdown to a plain sentence; `field_key` becomes the job's label ("Receipt no."), else "field key". */
function plain(md: string, job: JobProfile): string {
  const labels = new Map<string, string>();
  job.screen.fields.forEach((f) => labels.set(f.key, f.label));
  job.screen.actions.forEach((a) => labels.set(a.key, a.label));
  return md
    .replace(/`([^`]+)`/g, (_, k: string) => labels.get(k) ?? k.replace(/_/g, " "))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words the record "says": filled field keys and values, empty fields as "no/missing <key>", plus the action. */
function recordWords(record: Record<string, Value>, action?: string): { all: string[]; emptyKeys: string[]; filledKeys: string[] } {
  const all: string[] = [];
  const emptyKeys: string[] = [];
  const filledKeys: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (isEmpty(value)) {
      emptyKeys.push(key);
      all.push(...keyWords(key), ...EMPTY_WORDS);
    } else {
      filledKeys.push(key);
      all.push(...keyWords(key), ...tokens(String(value)));
    }
  }
  if (action) all.push(...keyWords(action));
  return { all: unique(all), emptyKeys, filledKeys };
}

const mentionsKey = (text: string, key: string) => new RegExp(`\`${key}\`|\\b${key}\\b`, "i").test(text);
const mentionsWords = (text: string, ws: string[]) => ws.length > 0 && ws.every((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
const countWord = (text: string, w: string) => (text.match(new RegExp(`\\b${w}\\b`, "gi")) ?? []).length;

/** Earliest item with the highest score, or null when nothing scores above `min`. */
function best<T>(items: T[], scoreOf: (x: T) => number, min = 0): T | null {
  let pick: T | null = null;
  let top = min;
  for (const x of items) {
    const s = scoreOf(x);
    if (s > top) { top = s; pick = x; }
  }
  return pick;
}

/**
 * What a good trainer would say next for this record, from the role file (no expert session needed):
 * the workflow step that talks about the fields still empty (or the intended action), the judgment call
 * whose situation shares the most words with the record, and the guardrail that mentions the action or an empty field.
 * All plain sentences. Falls back to the first workflow step; empty strings when the role has no file.
 */
export function nextStepFor(job: JobProfile, record: Record<string, Value>, action?: string): NextStep {
  const md = roleDoc(job.job.role_id ?? "") ?? "";
  if (!md) return { step: "" };
  const { all, emptyKeys, filledKeys } = recordWords(record, action);
  const out: NextStep = { step: "" };

  // (a) Workflow step: empty fields weigh most, then the intended action, then filled fields. Ties go to the earlier step.
  const steps = numbered(section(md, "## 4."));
  const stepScore = (s: string) =>
    emptyKeys.filter((k) => mentionsKey(s, k)).length * 3 +
    (action && mentionsKey(s, action) ? 3 : 0) +
    Math.min(2, filledKeys.filter((k) => mentionsKey(s, k)).length);
  const step = best(steps, stepScore) ?? steps[0];
  if (step) out.step = plain(step, job);

  // (b) Judgment call: the bold situation that shares at least two words with the record.
  const calls = bullets(section(md, "## 5.")).map((b) => {
    const m = b.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
    return m ? { situation: m[1].trim(), answer: m[2].trim() } : null;
  }).filter((c): c is { situation: string; answer: string } => !!c);
  const call = best(calls, (c) => unique(tokens(c.situation)).filter((w) => all.includes(w)).length, 1);
  if (call) {
    const answer = plain(call.answer.replace(/^Standard answer:\s*/i, ""), job);
    out.judgment = `${plain(call.situation, job).replace(/[.!?]$/, "")}. The usual answer: ${answer}`;
  }

  // (c) Guardrail: mentions the intended action, an amount the record exceeds, an empty field, or the record's own values.
  const guardrails = bullets(section(md, "## 6."));
  const amounts = Object.values(record).filter((v): v is number => typeof v === "number");
  const valueWords = unique(filledKeys.flatMap((k) => tokens(String(record[k]))).filter((w) => w.length > 2));
  const guardScore = (g: string) => {
    let s = 0;
    if (action && keyWords(action).some((w) => countWord(g, w) > 0)) s += 2;
    for (const m of g.matchAll(/over \$?(\d+)/gi)) if (amounts.some((a) => a > Number(m[1]))) s += 2;
    for (const k of emptyKeys) if (mentionsKey(g, k) || mentionsWords(g, keyWords(k))) s += 2;
    for (const k of filledKeys) if (mentionsKey(g, k)) s += 1;
    s += valueWords.filter((w) => countWord(g, w) > 0).length;
    return s;
  };
  const guard = best(guardrails, guardScore);
  if (guard) out.guardrail = plain(guard, job);

  return out;
}

/** One line to open with, from index.json: "This is a retail cashier, returns desk role. Here's how it's normally done." */
export function roleIntro(job: JobProfile): string {
  const role = roleById(job.job.role_id);
  const name = (role?.name ?? job.job.name).toLowerCase();
  const article = /^[aeiou]/.test(name) ? "an" : "a";
  return `This is ${article} ${name} role. Here's how it's normally done.`;
}
