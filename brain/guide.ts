// Show-me guidance for the tutor (Clicky-style pointer). Browser-safe and deterministic: no model call.
// Given the new hire's open record, the Work Map, and what the expert actually did (their recorded
// clicks and keystrokes), say which field or button to go to next and why.
import type { JobProfile, Rule, Value, WorkMap } from "@understudy/shared";
import { checkAction, deriveFields, evalCondition } from "./index";

type Rec = Record<string, Value>;

/** One thing the expert did in the fake app, in order. Built by the app from its interaction trace. */
export interface DemoStep {
  kind: "field" | "action"; key: string; t: number; keys?: string[]; value?: Value;
  path?: [number, number][];     // the expert's mouse path to this step, 0..1 of the app frame
}

/**
 * The expert working one record, recorded on purpose ("Record task"): the record as it was opened, what they
 * touched, and how they closed it (null when they stopped recording before pressing a button).
 */
export interface ExpertDemo { record: Rec; steps: DemoStep[]; action: string | null; title?: string; recorded_at?: string; }

export interface GuideStep {
  target: { kind: "field" | "action"; key: string };
  value?: Value;                 // for a field: what to set it to, when a rule says so (or what the expert entered)
  keys?: string[];               // the keystrokes to type in that field, for the on-screen keycaps
  path?: [number, number][];     // the expert's mouse path to this target, 0..1 of the app frame, when known
  say: string;                   // short line for the pointer bubble and the voice tutor
  why?: string;                  // the rule or the expert's habit behind it
  rule_id?: string;
  source: "rule" | "expert_demo" | "case" | "default";
}

const eq = (a: Value | undefined, b: Value | undefined) => evalCondition({ field: "x", op: "eq", value: b ?? null }, { x: a ?? null });
const empty = (v: Value | undefined) => v === undefined || v === null || v === "";

/** Rules that apply to this record, the same way checkAction picks them. */
function applicableRules(rec: Rec, map: WorkMap): Rule[] {
  const company = map.rules.filter((r) => r.confirmed);
  const holds = (r: Rule) => r.when.every((c) => evalCondition(c, rec));
  const hit = company.filter(holds);
  if (hit.length) return hit;
  return map.rules.filter((r) => r.source === "baseline" && !r.confirmed && !r.overridden_by && holds(r));
}

/** How alike two records are, by the fields rules care about. Higher is closer. */
function similarity(a: Rec, b: Rec, keys: string[]): number {
  let s = 0;
  for (const k of keys) {
    if (empty(a[k]) && empty(b[k])) s += 1;
    else if (!empty(a[k]) && !empty(b[k])) s += eq(a[k], b[k]) ? 2 : 0.5;
  }
  return s;
}

/** The expert demo on the record most like this one (null when the expert has not worked any). */
export function closestDemo(rec: Rec, demos: ExpertDemo[], job: JobProfile): ExpertDemo | null {
  const keys = job.screen.fields.filter((f) => f.type !== "status" && !f.pii).map((f) => f.key);
  let best: ExpertDemo | null = null, bestScore = -1;
  for (const d of demos) {
    if (!d.steps.length) continue;
    // A finished recording (one that ends on a button) beats a partial one on the same case.
    const s = similarity(deriveFields(job, rec), deriveFields(job, d.record), [...keys, "payment_method"]) + (d.action ? 0.25 : 0);
    if (s > bestScore) { best = d; bestScore = s; }
  }
  return best;
}

/**
 * The next thing the new hire should do on this record, or null when it is already closed.
 * Order: a rule that hands it off, a rule's required value, the expert's own steps, then a safe default.
 */
export interface GuideInput {
  record: Rec; map: WorkMap | null; job: JobProfile; demos?: ExpertDemo[];
  touched?: string[];            // fields the new hire already changed on this record
  expected?: Rec;                // the case in front of them (what the customer handed over): what to key in
  onScreen?: Rec;                // what the inputs show right now, e.g. a pre-filled "R-" the new hire types after
}

export function nextStep(input: GuideInput): GuideStep | null {
  const step = pickStep(input);
  if (!step) return null;
  // Borrow the expert's mouse path to the same target, so the walkthrough moves the way they did.
  const demo = closestDemo(input.expected ?? input.record, input.demos ?? [], input.job);
  const path = demo?.steps.find((s) => s.kind === step.target.kind && s.key === step.target.key && s.path?.length)?.path;
  return path ? { ...step, path } : step;
}

function pickStep(input: GuideInput): GuideStep | null {
  const { job, map } = input;
  const record = input.record;
  const statusField = job.screen.fields.find((f) => f.type === "status");
  if (statusField && !empty(record[statusField.key]) && record[statusField.key] !== statusField.options?.[0]) return null;

  const fields = new Map(job.screen.fields.map((f) => [f.key, f]));
  const actions = job.screen.actions;
  const label = (key: string) => actions.find((a) => a.key === key)?.label ?? fields.get(key)?.label ?? key;
  const passes = (action: string) => !map || checkAction({ action, record }, map, { job }).ok;
  const handoff = actions.find((a) => /manager|escalat|controller|hold/i.test(a.key));
  const rec = deriveFields(job, record);
  const rules = map ? applicableRules(rec, map) : [];
  const demo = closestDemo(input.expected ?? record, input.demos ?? [], job);

  // 0. Key in the case first: every detail on the customer's slip that isn't on screen yet, in the order the expert went.
  if (input.expected) {
    const order = [...(demo?.steps.filter((s) => s.kind === "field").map((s) => s.key) ?? []), ...job.screen.fields.map((f) => f.key)];
    for (const k of new Set(order)) {
      const f = fields.get(k), want = input.expected[k];
      if (!f || f.readonly || f.type === "status" || empty(want) || !empty(record[k])) continue;
      const select = f.type === "select";
      return {
        target: { kind: "field", key: k },
        value: want,
        keys: select ? undefined : typedKeys(want, f.type, input.onScreen?.[k]),
        say: select ? `Choose ${f.label}.` : `Enter the ${f.label.toLowerCase().replace(/\.$/, "")}.`,
        why: `It's on the customer's slip: ${select ? "pick" : "type"} it exactly.`,
        source: "case",
      };
    }
  }

  // 1. A rule names someone to hand it to: that is the safe move whatever else it restricts.
  for (const r of rules) {
    const t = r.then;
    if (t.escalate_to && handoff)
      return { target: { kind: "action", key: handoff.key }, say: `Click ${handoff.label}: this one needs ${t.escalate_to}.`, why: r.text, rule_id: r.id, source: "rule" };
  }

  // 2. A rule needs a value. Prefer a button that sets it in one go, else point at the field.
  for (const r of rules) {
    for (const [k, want] of Object.entries(r.then.must ?? {})) {
      if (eq(record[k], want)) continue;
      const oneClick = actions.find((a) => eq(a.sets[k], want) && passes(a.key));
      if (oneClick) return { target: { kind: "action", key: oneClick.key }, say: `Click ${oneClick.label}.`, why: r.text, rule_id: r.id, source: "rule" };
      const f = fields.get(k);
      if (f && !f.readonly)
        return { target: { kind: "field", key: k }, value: want, say: `Set ${f.label} to ${want}.`, why: r.text, rule_id: r.id, source: "rule" };
    }
  }

  // 3. Follow the expert: fields they filled in before deciding, then the button they pressed.
  if (demo) {
    const touched = new Set(input.touched ?? []);
    for (const s of demo.steps) {
      const f = s.kind === "field" ? fields.get(s.key) : undefined;
      if (!f || f.readonly || f.type === "status" || touched.has(s.key)) continue;
      // Done already: a choice that matches what the expert picked, or text that is filled and the expert typed nothing.
      const done = empty(record[s.key]) ? false : f.type === "select" ? empty(s.value) || eq(record[s.key], s.value) : !s.keys?.length;
      if (done) continue;
      const select = f.type === "select" && !empty(s.value);
      return {
        target: { kind: "field", key: s.key },
        keys: f.type === "select" ? undefined : s.keys,
        value: select ? s.value : undefined,
        say: empty(record[s.key]) ? `Fill in ${f.label}.` : `Check ${f.label}.`,
        why: select
          ? `On a case like this the expert set ${f.label} to ${s.value} before deciding.`
          : `The expert went to ${f.label} before deciding on a case like this.`,
        source: "expert_demo",
      };
    }
    if (demo.action && passes(demo.action))
      return { target: { kind: "action", key: demo.action }, say: `Click ${label(demo.action)}.`, why: `That is what the expert did on a case like this.`, source: "expert_demo" };
  }

  // 4. Nothing learned covers it: any empty choice first, then the first action the rules allow.
  const firstEmpty = job.screen.fields.find((f) => f.type === "select" && !f.readonly && empty(record[f.key]));
  if (firstEmpty) return { target: { kind: "field", key: firstEmpty.key }, say: `Set ${firstEmpty.label}.`, source: "default" };
  const ok = actions.find((a) => a.key !== handoff?.key && passes(a.key)) ?? handoff;
  if (!ok) return null;
  return {
    target: { kind: "action", key: ok.key },
    say: ok.key === handoff?.key ? `Not sure? Click ${ok.label}.` : `Click ${ok.label}.`,
    source: "default",
  };
}

/** The keys that produce a value in an input of this type (dates as typed in a US date field). */
function typedKeys(v: Value, type: string, shown?: Value): string[] {
  let text = String(v);
  if (typeof shown === "string" && shown && text.startsWith(shown)) text = text.slice(shown.length);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (type === "date" && d) text = `${d[2]}${d[3]}${d[1]}`;
  return [...text].slice(0, 24);
}

/**
 * The whole walkthrough for one case, the way the live guide would lead it: key in the slip, follow the
 * rules and the expert, end on the button that closes it. Played back as a moving cursor on request.
 */
export function planWalkthrough(input: GuideInput): GuideStep[] {
  const plan: GuideStep[] = [];
  let record: Rec = { ...input.record };
  const touched = new Set(input.touched ?? []);
  for (let i = 0; i < 20; i++) {
    const step = nextStep({ ...input, record, touched: [...touched] });
    if (!step) break;
    plan.push(step);
    if (step.target.kind === "action") break;
    const k = step.target.key;
    record = { ...record, [k]: step.value ?? input.expected?.[k] ?? record[k] ?? "…" };
    touched.add(k);
  }
  return plan;
}
