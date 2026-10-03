// Server-only engine entry. Import this from app API routes, never from the browser.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  QuestionPick,
  ScreenEvent,
  ScreenEventType,
  ScreenState,
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

/** Step 1 stub. Question picking lands after the gate is wired. */
export async function pickQuestion(
  _recent: ScreenEvent[],
  _map: WorkMap,
  _policy: string,
): Promise<QuestionPick | null> {
  return null;
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
        max_tokens: 4096,
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
    const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n");
    const parsed = parseVisionPayload(extractJson(text), req.t);
    return parsed ?? noEvents(req.previous_state);
  } catch {
    return noEvents(req.previous_state);
  }
}

function parseVisionPayload(raw: unknown, t: number): VisionResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { screen_state?: unknown; events?: unknown };
  const screen = parseScreenState(body.screen_state);
  if (!screen) return null;
  if (!Array.isArray(body.events)) return null;
  const events: ScreenEvent[] = [];
  for (const item of body.events) {
    const event = parseEvent(item, t);
    if (event) events.push(event);
  }
  return { screen_state: screen, events };
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
    "Output JSON only, matching the schema in your instructions. Include screen_state and events.",
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
  console.log("engine vision check ok");
}

if (process.argv.includes("--check")) {
  runCheck().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
