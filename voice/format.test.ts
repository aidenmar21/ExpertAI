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
  holdOutgoing,
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

test("keyboard and mouse input is silent context; the guide makes the agent speak", () => {
  assert.equal(formatContext({ kind: "user_input", text: "Typed \"R-88101\" in Receipt no." }), '[INPUT] Typed "R-88101" in Receipt no.');
  assert.equal(deliveryFor({ kind: "user_input", text: "x" }), "context");
  assert.equal(deliveryFor({ kind: "guide", steps: ["a"] }), "context");
  assert.match(formatContext({ kind: "guide", steps: ["Enter the receipt no.", "Click Refund."] }), /^\[GUIDE\][\s\S]*1\. Enter the receipt no\.\n2\. Click Refund\./);
  assert.deepEqual(holdOutgoing({ kind: "user_input", text: "x" }, { offRecord: true, debrief: "idle" })?.outcome, "held");
});

test("guide progress: the tutor explains shown steps and mistakes, the rest is background", () => {
  const p = { step: 2, total: 8, say: "Enter the price.", target: "Price", value: "142", why: "It's on the slip." };
  const showing = { kind: "guide_progress" as const, progress: { ...p, event: "showing" as const } };
  assert.equal(formatContext(showing), "[GUIDE STEP 2/8] Showing on screen now: Enter the price. Value: 142. Why: It's on the slip. Explain this step and why in one short sentence.");
  assert.equal(deliveryFor(showing), "turn");
  const wrong = { kind: "guide_progress" as const, progress: { ...p, event: "wrong" as const, typed: "124" } };
  assert.match(formatContext(wrong), /They entered "124" but it should be "142" in Price/);
  assert.equal(deliveryFor(wrong), "turn");
  for (const event of ["your_turn", "step_done", "skipped", "stopped"] as const)
    assert.equal(deliveryFor({ kind: "guide_progress", progress: { ...p, event } }), "context", event);
  assert.equal(deliveryFor({ kind: "guide_progress", progress: { ...p, event: "finished" } }), "turn");
});

test("ask now, stuck, off record", () => {
  assert.equal(
    formatContext({ kind: "ask_now", pick: { question: "Why cash?", about_event_id: "e1", is_guardrail: true } }),
    "[ASK NOW] Why cash? (guardrail)",
  );
  assert.equal(
    formatContext({ kind: "stuck", hint: "deciding between Cash and Store credit" }),
    "[STUCK] deciding between Cash and Store credit. Two sentences max, then wait.",
  );
  assert.equal(formatContext({ kind: "off_record", on: true }), "[OFF RECORD]");
  assert.equal(formatContext({ kind: "off_record", on: false }), "[ON RECORD]");
});

test("debrief fallback lists gaps and asks for a story teach-back", () => {
  const text = formatContext({ kind: "start_debrief", gaps: [{ id: "g1", question: "When do you waive the receipt?" }], map });
  assert.match(text, /^\[DEBRIEF\]/);
  assert.match(text, /1\. When do you waive the receipt\?/);
  assert.match(text, /story/);
  assert.match(text, /Is that right\?/);
  assert.doesNotMatch(text, /Open receipt/, "steps are already in [WORK MAP]");
});

test("guardrail quotes the expert", () => {
  const text = formatContext({ kind: "guardrail_hit", check: { ok: false, rule, clip_id: "c1" } }, { expert: "Aarav" });
  assert.match(text, /^\[GUARDRAIL\]/);
  assert.match(text, /Say only: "Aarav would stop here\. Why do you think\?" Then wait\./);
  assert.match(text, /two sentences max/);
  assert.match(text, /Aarav said: "Anything over a hundred, I get Dana\."/);
  assert.match(text, /Escalate to: Shift manager/);
  assert.match(text, /Replay available/);
});

test("standard guardrail says it is the usual way, not the expert's rule", () => {
  const text = formatContext({ kind: "guardrail_hit", check: { ok: false, standard: true, rule, explanation: "Most stores cap cash refunds." } }, { expert: "Aarav" });
  assert.match(text, /Industry standard, no company rule yet/);
  assert.match(text, /Most people in this job would stop here/);
  assert.match(text, /not Aarav's rule/);
  assert.doesNotMatch(text, /Replay/);
});

test("context lines stay short", () => {
  const g = formatContext({ kind: "guardrail_hit", check: { ok: false, rule, clip_id: "c1" } }, { expert: "Aarav" });
  assert.ok(g.split(/\s+/).length <= 60, `guardrail is ${g.split(/\s+/).length} words`);
  assert.ok(formatContext({ kind: "stuck", hint: "Look up the sale by card" }).split(/\s+/).length <= 15);
});

test("transcript helpers", () => {
  assert.equal(isAffirmative("Yes, that's it"), true);
  assert.equal(isAffirmative("No, the limit is fifty"), false);
  assert.equal(asksForConfirmation("So you check the date first. Is that right?"), true);
  assert.equal(countHesitations("um, wait, I don't know, uh"), 4);
  assert.equal(isOwnContextEcho("[ASK NOW] why?"), true);
  assert.equal(isOwnContextEcho("why cash?"), false);
});

test("off the record phrases", () => {
  for (const t of ["ok let's go off the record for a sec", "Don't record this, but", "do not record that", "pause recording", "Can you pause the recording?", "stop recording for a second"]) {
    assert.equal(detectRecordToggle(t), true, t);
  }
});

test("back on the record phrases", () => {
  for (const t of ["alright, back on the record", "OK, on the record again", "resume", "Resume recording.", "let's resume", "okay resuming"]) {
    assert.equal(detectRecordToggle(t), false, t);
  }
});

test("not a record toggle", () => {
  for (const t of ["open the record for R-1", "I'll resume the refund after lunch", "it's on my resume", "we record the serial number", "the recording studio"]) {
    assert.equal(detectRecordToggle(t), null, t);
  }
});

test("latest toggle in one utterance wins", () => {
  assert.equal(detectRecordToggle("that was off the record, ok back on the record now"), false);
  assert.equal(detectRecordToggle("we're on the record, but pause recording for this bit"), true);
});

test("screen events and questions are held off the record", () => {
  const ev = { kind: "screen_event", event: { id: "e", t: 0, type: "field_changed", confidence: 1, detail: "" } } as const;
  const ask = { kind: "ask_now", pick: { question: "Why?", about_event_id: "e", is_guardrail: false } } as const;
  assert.deepEqual(holdOutgoing(ev, { offRecord: true, debrief: "idle" }), { outcome: "held", reason: "off the record" });
  assert.deepEqual(holdOutgoing(ask, { offRecord: true, debrief: "idle" }), { outcome: "held", reason: "off the record" });
  assert.equal(holdOutgoing(ev, { offRecord: false, debrief: "idle" }), null);
  assert.equal(holdOutgoing({ kind: "off_record", on: false }, { offRecord: true, debrief: "idle" }), null, "going back on record is sent");
  assert.equal(holdOutgoing({ kind: "stuck", hint: "h" }, { offRecord: true, debrief: "idle" }), null);
  assert.deepEqual(holdOutgoing(ask, { offRecord: false, debrief: "asking" }), { outcome: "dropped", reason: "debrief in progress" });
});
