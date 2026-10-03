// node --test voice/format.test.ts   (Node 22.6+ strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Rule, WorkMap } from "../shared/contracts";
import {
  asksForConfirmation,
  countHesitations,
  deliveryFor,
  detectRecordToggle,
  formatContext,
  isAffirmative,
  isOwnContextEcho,
} from "./format.ts";

const rule: Rule = {
  id: "r1",
  text: "Refunds over $100 need a manager",
  type: "limit",
  when: [{ field: "amount", op: "gt", value: 100 }],
  then: { escalate_to: "Shift manager" },
  reason_quote: "Anything over a hundred, I get Dana.",
  screen_moment: { t: 1000 },
  source: "live_question",
  confirmed: true,
};
const map: WorkMap = {
  job_id: "returns-desk",
  expert: "Aarav",
  steps: [{ n: 1, title: "Open receipt", screen_moment: { t: 0 }, decision: "check date", rule_ids: [] }],
  rules: [rule],
  open_gaps: [],
};

test("screen event matches the contract example", () => {
  const text = formatContext({
    kind: "screen_event",
    event: { id: "e1", t: 1, type: "field_changed", record: "R-88104", field: "refund_method", from: "Card", to: "Cash", confidence: 0.9, detail: "" },
  });
  assert.equal(text, "[SCREEN] field_changed refund_method Card -> Cash on R-88104");
});

test("screen event with null value and detail", () => {
  const text = formatContext({
    kind: "screen_event",
    event: { id: "e2", t: 1, type: "field_changed", field: "note", from: null, to: "damaged", confidence: 1, detail: "note typed\nin box" },
  });
  assert.equal(text, "[SCREEN] field_changed note empty -> damaged (note typed in box)");
});

test("only screen events are silent context", () => {
  assert.equal(deliveryFor({ kind: "screen_event", event: { id: "e", t: 0, type: "unknown_change", confidence: 0, detail: "" } }), "context");
  assert.equal(deliveryFor({ kind: "ask_now", pick: { question: "q", about_event_id: "e", is_guardrail: false } }), "turn");
  assert.equal(deliveryFor({ kind: "stuck", hint: "h" }), "turn");
});

test("ask now, stuck, off record", () => {
  assert.equal(
    formatContext({ kind: "ask_now", pick: { question: "Why cash?", about_event_id: "e1", is_guardrail: true } }),
    "[ASK NOW] Why cash? (this is a guardrail question)",
  );
  assert.equal(formatContext({ kind: "stuck", hint: "deciding between Cash and Store credit" }), "[STUCK] deciding between Cash and Store credit");
  assert.equal(formatContext({ kind: "off_record", on: true }), "[OFF RECORD]");
  assert.equal(formatContext({ kind: "off_record", on: false }), "[ON RECORD]");
});

test("debrief lists gaps, steps, rules", () => {
  const text = formatContext({ kind: "start_debrief", gaps: [{ id: "g1", question: "When do you waive the receipt?" }], map });
  assert.match(text, /^\[DEBRIEF\]/);
  assert.match(text, /1\. When do you waive the receipt\?/);
  assert.match(text, /1\. Open receipt: check date/);
  assert.match(text, /Refunds over \$100 need a manager \(limit; Aarav said: "Anything over a hundred, I get Dana\."\)/);
  assert.match(text, /Is that right\?/);
});

test("guardrail quotes the expert", () => {
  const text = formatContext({ kind: "guardrail_hit", check: { ok: false, rule, clip_id: "c1" } }, { expert: "Aarav" });
  assert.match(text, /^\[GUARDRAIL\]/);
  assert.match(text, /Say only: "Aarav would stop here\. Why do you think\?" Then stop talking/);
  assert.match(text, /Aarav said: "Anything over a hundred, I get Dana\."/);
  assert.match(text, /Escalate to: Shift manager/);
  assert.match(text, /replay/);
});

test("transcript helpers", () => {
  assert.equal(detectRecordToggle("ok let's go off the record for a sec"), true);
  assert.equal(detectRecordToggle("alright, back on the record"), false);
  assert.equal(detectRecordToggle("open the record for R-1"), null);
  assert.equal(isAffirmative("Yes, that's it"), true);
  assert.equal(isAffirmative("No, the limit is fifty"), false);
  assert.equal(asksForConfirmation("So you check the date first. Is that right?"), true);
  assert.equal(countHesitations("um, wait, I don't know, uh"), 4);
  assert.equal(isOwnContextEcho("[ASK NOW] why?"), true);
  assert.equal(isOwnContextEcho("why cash?"), false);
});
