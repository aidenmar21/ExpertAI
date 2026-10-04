import assert from "node:assert/strict";
import { after, test } from "node:test";
import { analyzeFrame } from "../server";
import type { ScreenState } from "../../shared/contracts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
const originalModel = process.env.VISION_MODEL;
process.env.ANTHROPIC_API_KEY = "test-only";
process.env.VISION_MODEL = "claude-sonnet-5-5";
after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.VISION_MODEL;
  else process.env.VISION_MODEL = originalModel;
});
const previous: ScreenState = {
  view: "record_detail", record: { record_id: "R-1", refund_to: "Cash", amount: 24, note: "old" },
  visible_warnings: ["Check this"],
};
const req = { frame_jpeg_base64: "test-jpeg", previous_state: previous, t: 1234 };
function respond(raw: unknown, stop_reason = "end_turn") {
  globalThis.fetch = async () => Response.json({ stop_reason, content: [{ type: "text", text: JSON.stringify(raw) }] });
}

test("delta preserves untouched state and normalizes field/status events without mutating previous", async () => {
  respond({ screen_state_delta: { record: { refund_to: "Original card" } },
    events: [{ type: "field_changed", field: "refund_to", confidence: 0.95 }] });
  const result = await analyzeFrame(req);
  assert.deepEqual(result.screen_state, { ...previous, record: { ...previous.record, refund_to: "Original card" } });
  assert.equal(previous.record.refund_to, "Cash");
  assert.deepEqual({ ...result.events[0], id: "generated" }, {
    id: "generated", t: 1234, type: "field_changed", field: "refund_to", confidence: 0.95,
    from: "Cash", to: "Original card", record: "R-1", detail: "refund to changed from Cash to Original card",
  });
});

test("empty delta keeps state; explicit null, removed fields and cleared warnings apply", async () => {
  respond({ screen_state_delta: {}, events: [] });
  assert.deepEqual(await analyzeFrame(req), { screen_state: previous, events: [] });
  respond({ screen_state_delta: { record: { refund_to: null }, removed_fields: ["note"], visible_warnings: [] },
    events: [{ type: "field_changed", field: "refund_to", confidence: 0.8 }] });
  const result = await analyzeFrame(req);
  assert.equal(result.screen_state.record.refund_to, null);
  assert.equal(result.screen_state.record.note, undefined);
  assert.deepEqual(result.screen_state.visible_warnings, []);
  assert.equal(result.events[0].to, null);
});

test("full state on navigation replaces old record instead of merging it", async () => {
  const screen = { view: "record_detail", record: { record_id: "R-2" }, visible_warnings: [] };
  respond({ screen_state: screen, events: [{ type: "record_opened", confidence: 1, detail: "New record" }] });
  const result = await analyzeFrame(req);
  assert.deepEqual(result.screen_state, screen);
  assert.equal(result.events[0].record, "R-2");
  assert.deepEqual((await analyzeFrame({ ...req, previous_state: null })).screen_state, screen);
});

test("malformed, truncated and failed calls return previous state with no events", async () => {
  const fallback = { screen_state: previous, events: [] };
  for (const delta of [null, [], { record: { amount: {} } }, { record: { record_id: "R-2" } },
    { view: "list" }, { visible_warnings: [12] }, { removed_fields: [12] }]) {
    respond({ screen_state_delta: delta, events: [{ type: "record_opened", confidence: 1 }] });
    assert.deepEqual(await analyzeFrame(req), fallback);
  }
  respond({ screen_state_delta: { record: { refund_to: "Original card" } }, events: [] }, "max_tokens");
  assert.deepEqual(await analyzeFrame(req), fallback);
  respond({ screen_state_delta: {}, events: [] });
  assert.deepEqual(await analyzeFrame({ ...req, previous_state: null }), {
    screen_state: { view: "other", record: {}, visible_warnings: [] }, events: [],
  });
  globalThis.fetch = async () => new Response("bad", { status: 503 });
  assert.deepEqual(await analyzeFrame(req), fallback);
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.deepEqual(await analyzeFrame(req), fallback);
  globalThis.fetch = async () => Response.json({ content: [{ type: "text", text: "{incomplete" }] });
  assert.deepEqual(await analyzeFrame(req), fallback);
});

test("legacy complete event payloads remain accepted", async () => {
  const event = { type: "field_changed", field: "refund_to", from: "Cash", to: "Original card",
    confidence: 0.9, detail: "Visible selection changed", id: "legacy", t: 42 };
  respond({ screen_state: { ...previous, record: { ...previous.record, refund_to: "Original card" } }, events: [event] });
  assert.deepEqual((await analyzeFrame(req)).events[0], { ...event, record: "R-1" });
});

test("compact events cannot infer a field change across records", async () => {
  respond({ screen_state: { ...previous, record: { record_id: "R-2", refund_to: "Original card" } },
    events: [{ type: "field_changed", field: "refund_to", confidence: 1 }] });
  assert.deepEqual((await analyzeFrame(req)).events, []);
});
