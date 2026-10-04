// Server-only engine entry. Import this from app API routes, never from the browser.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureDecisions, checkAction, deriveFields, pickFromRecords } from "@understudy/brain";
import type {
  Condition,
  JobProfile,
  QuestionPick,
  Rule,
  ScreenEvent,
  ScreenEventType,
  ScreenState,
  TranscriptLine,
  Value,
  VisionRequest,
  VisionResponse,
  WorkMap,
} from "../shared/contracts";

const EVENT_TYPES: ReadonlySet<string> = new Set([
  "screen_opened",
  "record_opened",
  "field_changed",
  "status_changed",
  "dialog_opened",
  "note_added",
  "unknown_change",
]);

/**
 * One question, or null to stay silent. Brain chooses the wording. A change a
 * known rule already explains is not asked about again.
 */
export interface PickOptions {
  baseline?: Rule[];              // industry-standard rules for this role (knowledge/baseline-rules.json)
  screen?: ScreenState | null;    // latest screen state, for evaluating rule conditions
  job?: JobProfile | null;        // action -> sets, escalate_to, record_type
  askedGuardrail?: boolean;       // has a guardrail question been asked this session
  roleName?: string;
}

/**
 * The one question worth asking, or null to stay silent. Ranking:
 * 1. the expert CONTRADICTED a baseline rule (asked as a comparison with the standard),
 * 2. a decision no rule explains (why), then follow-ups,
 * 3. the expert CONFIRMED a baseline rule (one light check that it always holds here),
 * 4. if no guardrail question has been asked yet and the expert has explained at least one decision,
 *    one guardrail question (limit, exception, or stop-and-ask) so every session has one.
 */
export async function pickQuestion(
  recent: ScreenEvent[],
  map: WorkMap,
  policy: string,
  transcript: TranscriptLine[] = [],
  opts: PickOptions = {},
): Promise<QuestionPick | null> {
  const baseline = opts.baseline ?? (map.rules ?? []).filter((r) => r.source === "baseline");
  const companyRules = (map.rules ?? []).filter((r) => r.source !== "baseline" || r.confirmed);
  const records = captureDecisions({ events: recent, transcript });
  const unexplained = new Set(records.filter((r) => r.why === null && !r.asked.includes("why")).flatMap((r) => r.sources.event_ids));
  const askedTexts = new Set(transcript.filter((l) => l.speaker === "agent").map((l) => l.text.trim().toLowerCase()));
  const who = opts.roleName ? `most ${opts.roleName.toLowerCase().split(",")[0]}s` : "most people in this job";

  // 1. Contradictions, newest first.
  for (const event of [...recent].reverse()) {
    if (!event.field || !unexplained.has(event.id)) continue;
    const hit = contradictedRule(event, baseline, opts);
    if (!hit) continue;
    if (ruleExplains(companyRules, event, policy)) continue; // the company already told us this differs
    const q = `For ${who}, ${lower(hit.text)} You set ${label(event.field)} to ${String(event.to)}. Why is it different here?`;
    if (askedTexts.has(q.toLowerCase())) continue;
    return {
      question: q, about_event_id: event.id, is_guardrail: isGuardrailType(hit),
      kind: "contradiction", reason: `contradicts baseline ${hit.id}`, rule_id: hit.id,
    };
  }

  // 2. Unexplained decisions and follow-ups (brain's picker: why, then what would change, then when to stop).
  const pick = pickFromRecords(recent, transcript);
  if (pick) {
    const event = recent.find((item) => item.id === pick.about_event_id);
    const explained = pick.question.startsWith("Why") && event && ruleExplains(companyRules, event, policy);
    if (!explained) {
      return { ...pick, kind: pick.question.startsWith("Why") ? "unexplained" : "follow_up", reason: "no rule explains this decision" };
    }
  }

  // 3. One confirmation per baseline rule the expert followed.
  for (const event of [...recent].reverse()) {
    if (!event.field) continue;
    const rule = confirmedRule(event, baseline, opts);
    if (!rule) continue;
    const q = `That matches the standard: ${lower(rule.text)} Is it always that way here, or are there exceptions?`;
    if (askedTexts.has(q.toLowerCase())) continue;
    return { question: q, about_event_id: event.id, is_guardrail: false, kind: "confirmation", reason: `confirms baseline ${rule.id}`, rule_id: rule.id };
  }

  // 4. Guarantee one guardrail question per session.
  const explainedCount = records.filter((r) => r.why !== null).length;
  if (!opts.askedGuardrail && explainedCount >= 1 && recent.length) {
    const escalate = opts.job?.job.escalate_to ?? "a manager";
    const candidates = baseline.filter((r) => r.type === "limit" || r.type === "stop_and_ask" || r.type === "exception");
    const rule = candidates.find((r) => !map.rules?.some((x) => x.source !== "baseline" && sameFields(x, r)));
    const q = rule
      ? `Is there a point where you stop and get the ${escalate}? For ${who}, ${lower(rule.text)}`
      : `Is there a point on a case like this where you'd stop and get the ${escalate} instead of deciding yourself?`;
    if (!askedTexts.has(q.toLowerCase())) {
      const about = recent[recent.length - 1].id;
      return { question: q, about_event_id: about, is_guardrail: true, kind: "guardrail", reason: "no guardrail question yet this session", rule_id: rule?.id };
    }
  }
  return null;
}

/** A baseline rule whose conditions hold on screen and whose outcome the expert's change breaks. */
function contradictedRule(event: ScreenEvent, baseline: Rule[], opts: PickOptions): Rule | null {
  const record: Record<string, Value> = deriveFields(opts.job, { ...(opts.screen?.record ?? {}), [event.field!]: event.to ?? null });
  const action = actionFor(event, opts.job);
  const probe = { action: action ?? "__field__", record };
  const res = checkAction(probe, { job_id: "", expert: "", steps: [], rules: baseline, open_gaps: [] }, {
    includeUnconfirmed: true, baselineFallback: false, job: opts.job ?? undefined,
  });
  if (!res.ok && res.rule) return res.rule;
  // Field-level contradiction: a rule that applies says this field must be something else.
  return baseline.find((r) =>
    r.when.every((c) => evalCond(c, record)) && r.then.must?.[event.field!] !== undefined && !valuesMatch(r.then.must[event.field!], event.to),
  ) ?? null;
}

/** A baseline rule the expert's change satisfies (same field, same required value). */
function confirmedRule(event: ScreenEvent, baseline: Rule[], opts: PickOptions): Rule | null {
  const record: Record<string, Value> = deriveFields(opts.job, { ...(opts.screen?.record ?? {}), [event.field!]: event.to ?? null });
  return baseline.find((r) =>
    r.when.length > 0 && r.when.every((c) => evalCond(c, record)) && r.then.must?.[event.field!] !== undefined &&
    valuesMatch(r.then.must[event.field!], event.to),
  ) ?? null;
}

function actionFor(event: ScreenEvent, job?: JobProfile | null): string | null {
  if (!job || event.type !== "status_changed") return null;
  return job.screen.actions.find((a) => valuesMatch(a.sets.status as Value, event.to))?.key ?? null;
}

function evalCond(c: Condition, rec: Record<string, Value>): boolean {
  const v = rec[c.field];
  switch (c.op) {
    case "missing": return v == null || v === "";
    case "present": return !(v == null || v === "");
    case "eq": return valuesMatch(c.value as Value, v);
    case "neq": return !valuesMatch(c.value as Value, v);
    case "in": return Array.isArray(c.value) && c.value.some((x) => valuesMatch(x, v));
    case "gt": return v != null && Number(v) > Number(c.value);
    case "gte": return v != null && Number(v) >= Number(c.value);
    case "lt": return v != null && Number(v) < Number(c.value);
    case "lte": return v != null && Number(v) <= Number(c.value);
  }
}
const sameFields = (a: Rule, b: Rule) => {
  const x = new Set(a.when.map((c) => c.field)), y = new Set(b.when.map((c) => c.field));
  return x.size === y.size && [...x].every((f) => y.has(f));
};
const isGuardrailType = (r: Rule) => r.type === "guardrail" || r.type === "limit" || r.type === "stop_and_ask";
const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const label = (field: string) => field.replace(/_/g, " ");

function ruleExplains(rules: Rule[], event: ScreenEvent, policy: string): boolean {
  if (!event.field || event.to === undefined) return false;
  if (typeof event.to === "string" && event.to.length >= 4 && policy.toLowerCase().includes(event.to.toLowerCase())) {
    return true;
  }
  return rules.some((rule) => {
    const must = rule.then.must?.[event.field!];
    if (must !== undefined && valuesMatch(must, event.to)) return true;
    return rule.when.some((cond) => cond.field === event.field && conditionMatches(cond, event.to));
  });
}

function conditionMatches(cond: Condition, to: Value | undefined): boolean {
  if (cond.op === "eq") return valuesMatch(cond.value as Value, to);
  if (cond.op === "in" && Array.isArray(cond.value)) return cond.value.some((item) => valuesMatch(item, to));
  return false;
}

function valuesMatch(a: Value | undefined, b: Value | undefined): boolean {
  if (a == null || b == null) return a == b;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Read one frame plus the previous screen state. On any failure (missing key,
 * bad HTTP, invalid JSON) return the previous state and no events.
 */
export async function analyzeFrame(req: VisionRequest): Promise<VisionResponse> {
  const frame = jpegPayload(req.frame_jpeg_base64);
  if (!frame) return noEvents(req.previous_state);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!apiKey || !model) return noEvents(req.previous_state);

  try {
    const system = visionSystemPrompt();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.previous_state ? 512 : 1024,
        // Sonnet 5.5 thinks up front unless this is set (no tools, so it skips that block); Haiku rejects it.
        ...thinkingConfig(model),
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userMessage(req) },
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: frame },
              },
            ],
          },
        ],
      }),
    });
    if (!response.ok) return noEvents(req.previous_state);
    const payload = (await response.json()) as { stop_reason?: string; content?: Array<{ type?: string; text?: string }> };
    if (payload.stop_reason === "max_tokens") return noEvents(req.previous_state);
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n");
    const parsed = parseVisionPayload(extractJson(text), req.t, req.previous_state);
    return parsed ?? noEvents(req.previous_state);
  } catch {
    return noEvents(req.previous_state);
  }
}

function parseVisionPayload(raw: unknown, t: number, previous: ScreenState | null = null): VisionResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { screen_state?: unknown; screen_state_delta?: unknown; events?: unknown };
  const screen = body.screen_state !== undefined
    ? parseScreenState(body.screen_state)
    : mergeScreenDelta(body.screen_state_delta, previous);
  if (!screen) return null;
  if (!Array.isArray(body.events)) return null;
  const events: ScreenEvent[] = [];
  for (const item of body.events) {
    const event = parseEvent(item, t);
    if (!event) continue;
    // Compact model events refer to the state diff; public events remain complete.
    if (event.field && (event.type === "field_changed" || event.type === "status_changed")) {
      const sameRecord = previous && previous.view === screen.view
        && previous.record.record_id === screen.record.record_id;
      if ((event.from === undefined || event.to === undefined) && !sameRecord) continue;
      if (event.from === undefined && previous && Object.hasOwn(previous.record, event.field)) {
        event.from = previous.record[event.field];
      }
      if (event.to === undefined && Object.hasOwn(screen.record, event.field)) {
        event.to = screen.record[event.field];
      }
      if (event.from === undefined || event.to === undefined || event.from === event.to) continue;
      if (!event.detail) event.detail = `${event.field.replace(/_/g, " ")} changed from ${event.from} to ${event.to}`;
    }
    if (!event.record && screen.record.record_id != null) event.record = String(screen.record.record_id);
    events.push(event);
  }
  return { screen_state: screen, events };
}

/** Internal model wire format only: callers still send/receive the shared contracts. */
function mergeScreenDelta(raw: unknown, previous: ScreenState | null): ScreenState | null {
  if (!previous || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const delta = raw as { record?: unknown; visible_warnings?: unknown; removed_fields?: unknown };
  if (Object.keys(raw).some((key) => !["record", "visible_warnings", "removed_fields"].includes(key))) return null;
  const record = { ...previous.record };
  if (delta.record !== undefined) {
    if (!delta.record || typeof delta.record !== "object" || Array.isArray(delta.record)) return null;
    for (const [key, value] of Object.entries(delta.record)) {
      const coerced = coerceValue(value);
      if (coerced === undefined) return null;
      // A new record needs a full state, otherwise old fields could leak into it.
      if (key === "record_id" && coerced !== previous.record.record_id) return null;
      record[key] = coerced;
    }
  }
  if (delta.removed_fields !== undefined) {
    if (!Array.isArray(delta.removed_fields) || !delta.removed_fields.every((key) => typeof key === "string")) return null;
    for (const key of delta.removed_fields) delete record[key];
  }
  let warnings = previous.visible_warnings;
  if (delta.visible_warnings !== undefined) {
    if (!Array.isArray(delta.visible_warnings) || !delta.visible_warnings.every((item) => typeof item === "string")) return null;
    warnings = delta.visible_warnings;
  }
  return { view: previous.view, record, visible_warnings: [...warnings] };
}

function parseScreenState(raw: unknown): ScreenState | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { view?: unknown; record?: unknown; visible_warnings?: unknown };
  if (typeof body.view !== "string") return null;
  if (!body.record || typeof body.record !== "object" || Array.isArray(body.record)) return null;
  const record: Record<string, Value> = {};
  for (const [key, value] of Object.entries(body.record as Record<string, unknown>)) {
    const coerced = coerceValue(value);
    if (coerced !== undefined) record[key] = coerced;
  }
  const warnings = Array.isArray(body.visible_warnings)
    ? body.visible_warnings.filter((item): item is string => typeof item === "string")
    : [];
  return { view: body.view, record, visible_warnings: warnings };
}

function parseEvent(raw: unknown, t: number): ScreenEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as {
    id?: unknown;
    type?: unknown;
    record?: unknown;
    field?: unknown;
    from?: unknown;
    to?: unknown;
    confidence?: unknown;
    detail?: unknown;
    frameId?: unknown;
    t?: unknown;
  };
  if (typeof body.type !== "string" || !EVENT_TYPES.has(body.type)) return null;
  const confidence = typeof body.confidence === "number" && Number.isFinite(body.confidence)
    ? Math.min(1, Math.max(0, body.confidence))
    : null;
  if (confidence === null) return null;
  const event: ScreenEvent = {
    id: typeof body.id === "string" && body.id ? body.id : newEventId(),
    t: typeof body.t === "number" && Number.isFinite(body.t) ? body.t : t,
    type: body.type as ScreenEventType,
    confidence,
    detail: typeof body.detail === "string" ? body.detail : "",
  };
  if (typeof body.record === "string") event.record = body.record;
  if (typeof body.field === "string") event.field = body.field;
  const from = coerceValue(body.from);
  const to = coerceValue(body.to);
  if (from !== undefined) event.from = from;
  if (to !== undefined) event.to = to;
  if (typeof body.frameId === "string") event.frameId = body.frameId;
  return event;
}

function coerceValue(value: unknown): Value | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function noEvents(previous: ScreenState | null): VisionResponse {
  return {
    screen_state: previous ?? { view: "other", record: {}, visible_warnings: [] },
    events: [],
  };
}

function jpegPayload(frame: string): string {
  if (!frame) return "";
  const trimmed = frame.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) return trimmed.slice(comma + 1).trim();
  return trimmed;
}

function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function userMessage(req: VisionRequest): string {
  const previous = req.previous_state ? JSON.stringify(req.previous_state) : "null";
  return [
    "PREVIOUS_STATE:",
    previous,
    "",
    "CURRENT_FRAME: [image attached]",
    "",
    `Frame timestamp: ${formatTimestamp(req.t)}`,
    "",
    "Output compact JSON only. Use screen_state_delta for the same record/view; full screen_state on navigation. Include events.",
  ].join("\n");
}

function formatTimestamp(t: number): string {
  const total = Math.max(0, Math.floor(t / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

let cachedPrompt: string | null = null;

function visionSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  const path = resolvePromptPath();
  const markdown = readFileSync(path, "utf8");
  const section = markdown.indexOf("## System prompt");
  if (section < 0) throw new Error("vision prompt is missing the system section");
  const open = markdown.indexOf("```", section);
  const close = markdown.indexOf("```", open + 3);
  if (open < 0 || close < 0) throw new Error("vision prompt system section has no fenced block");
  cachedPrompt = markdown.slice(open + 3, close).replace(/^\n/, "").trim();
  return cachedPrompt;
}

function resolvePromptPath(): string {
  const candidates = [
    join(process.cwd(), "shared/prompts/vision.md"),
    join(process.cwd(), "../shared/prompts/vision.md"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("shared/prompts/vision.md not found");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("vision response had no JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

async function runCheck(): Promise<void> {
  const sample = {
    screen_state: {
      view: "invoice_detail",
      record: { invoice_no: "4471", amount_eur: 6450, iban: "[IBAN]", extra: { nested: true } },
      visible_warnings: ["Check the PO", 12],
    },
    events: [
      {
        type: "field_changed",
        field: "cost_center",
        from: "4711",
        to: "0400",
        record: "4471",
        confidence: 0.95,
        detail: "Cost center changed to 0400",
      },
      { type: "not_a_type", confidence: 1, detail: "drop me" },
      { type: "status_changed", confidence: "high", detail: "drop me too" },
    ],
  };
  const parsed = parseVisionPayload(sample, 12500);
  if (!parsed || parsed.events.length !== 1 || parsed.events[0].field !== "cost_center") {
    throw new Error("parser rejected a valid vision payload");
  }
  if (parsed.events[0].t !== 12500 || !parsed.events[0].id) {
    throw new Error("parser did not fill id and t");
  }
  if (parsed.screen_state.record.extra !== undefined) {
    throw new Error("parser kept a non-value record field");
  }
  if (parsed.screen_state.visible_warnings.length !== 1) {
    throw new Error("parser kept a non-string warning");
  }
  if (parseVisionPayload("nope", 0) !== null) {
    throw new Error("parser accepted prose");
  }
  if (parseVisionPayload({ events: [] }, 0) !== null) {
    throw new Error("parser accepted a payload with no screen_state");
  }
  const fenced = parseVisionPayload(extractJson("```json\n" + JSON.stringify(sample) + "\n```"), 1000);
  if (!fenced || fenced.events[0].type !== "field_changed") {
    throw new Error("parser missed fenced JSON");
  }
  const prompt = visionSystemPrompt();
  if (!prompt.includes("SCREEN_STATE") || !prompt.includes("field_changed")) {
    throw new Error("vision system prompt did not load");
  }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.VISION_MODEL) {
    const result = await analyzeFrame({ frame_jpeg_base64: "/9j/4AAQ", previous_state: null, t: 1000 });
    if (result.events.length !== 0 || result.screen_state.view !== "other") {
      throw new Error("analyzeFrame should return no events without a key and model");
    }
  }
  const changed: ScreenEvent = {
    id: "e1",
    t: 1000,
    type: "field_changed",
    field: "refund_method",
    from: "Cash",
    to: "Store credit",
    record: "R-88104",
    confidence: 0.95,
    detail: "Refund to now shows Store credit",
  };
  const empty: WorkMap = { job_id: "returns-desk", expert: "Aarav", steps: [], rules: [], open_gaps: [] };
  const asked = await pickQuestion([changed], empty, "Refunds go to the original payment method.", []);
  if (!asked || !asked.question.startsWith("Why") || asked.about_event_id !== "e1") {
    throw new Error(`pickQuestion should ask why, got ${JSON.stringify(asked)}`);
  }
  const known: WorkMap = {
    ...empty,
    rules: [{
      id: "r1",
      text: "No receipt means store credit",
      type: "guardrail",
      when: [],
      then: { must: { refund_method: "Store credit" } },
      reason_quote: "No receipt means store credit only",
      screen_moment: { t: 1000, record: "R-88104" },
      source: "live_question",
      confirmed: true,
    }],
  };
  if (await pickQuestion([changed], known, "", []) !== null) {
    throw new Error("pickQuestion should stay silent when a rule already requires this value");
  }
  console.log("engine vision check ok");
}

if (process.argv.includes("--check")) {
  runCheck().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}


// ---------- App discovery: one frame -> the screen map of an unknown app ----------

const DISCOVER_PROMPT = `You are looking at one screenshot of a desk-job application. Describe its data entry screen as JSON only:
{"record_type": "<singular noun for the thing being edited, e.g. return, invoice, ticket>",
 "fields": [{"key": "<snake_case from the visible label>", "label": "<label exactly as shown>", "type": "text|money|date|select|status", "options": ["..."]}],
 "actions": [{"key": "<snake_case from the button label>", "label": "<button label exactly as shown>", "sets": {"status": "<status this button likely sets, if any>"}}]}
Rules: only fields and buttons that are actually visible. A dropdown is "select" with its visible options; the record's state field is "status".
Money fields are "money", dates are "date". Do not invent fields. No prose, JSON only.`;

/** Learn an unknown app's layout from one frame. Returns an empty screen on any failure. */
export async function discoverScreen(frameJpegBase64: string): Promise<JobProfile["screen"]> {
  const empty: JobProfile["screen"] = { record_type: "record", fields: [], actions: [] };
  const frame = jpegPayload(frameJpegBase64);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!frame || !apiKey || !model) return empty;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: 1500, ...thinkingConfig(model), system: DISCOVER_PROMPT,
        messages: [{ role: "user", content: [
          { type: "text", text: "Describe this screen." },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame } },
        ] }],
      }),
    });
    if (!response.ok) return empty;
    const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (payload.content ?? []).filter((b) => b.type === "text" && b.text).map((b) => b.text).join("\n");
    const raw = extractJson(text) as Partial<JobProfile["screen"]> | null;
    if (!raw || !Array.isArray(raw.fields)) return empty;
    const types = new Set(["text", "money", "date", "select", "status"]);
    const fields = raw.fields
      .filter((f) => f && typeof f.label === "string")
      .map((f) => ({
        key: snake(String(f.key || f.label)), label: String(f.label),
        type: (types.has(String(f.type)) ? f.type : "text") as JobProfile["screen"]["fields"][number]["type"],
        ...(Array.isArray(f.options) && f.options.length ? { options: f.options.map(String) } : {}),
      }));
    const actions = (Array.isArray(raw.actions) ? raw.actions : [])
      .filter((a) => a && typeof a.label === "string")
      .map((a) => ({ key: snake(String(a.key || a.label)), label: String(a.label), sets: sanitizeSets(a.sets) }));
    return { record_type: typeof raw.record_type === "string" && raw.record_type ? raw.record_type : "record", fields, actions };
  } catch {
    return empty;
  }
}

/** Models that reject thinking/effort params (Haiku) get neither; Sonnet 5.5 needs them to skip up-front thinking. */
function thinkingConfig(model: string): Record<string, unknown> {
  if (/haiku/i.test(model)) return {};
  return { thinking: { type: "between_tools" }, output_config: { effort: "low" } };
}
const snake = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
function sanitizeSets(v: unknown): Record<string, Value> {
  const out: Record<string, Value> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "string" || typeof x === "number" || x === null) out[snake(k)] = x;
  }
  return out;
}
