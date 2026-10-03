// npm test -w voice
import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkMap } from "../shared/contracts";
import { captureDecisions } from "@understudy/brain";
import { formatDebriefQuestion, formatTeachBack, formatWorkMapContext, planDebrief } from "./debrief";

const empty: WorkMap = { job_id: "returns-desk", expert: "Aarav", steps: [], rules: [], open_gaps: [] };

test("no gaps: three general questions, one is a guardrail", () => {
  const plan = planDebrief([], empty, "Shift manager");
  assert.equal(plan.length, 3);
  assert.ok(plan.some((q) => q.is_guardrail));
  assert.match(plan[0].question, /get the shift manager instead/);
});

test("gaps come first and keep their event id", () => {
  const plan = planDebrief(
    [
      { id: "g1", question: "Why did you change refund_method on R-88104?", about_event_id: "e3" },
      { id: "g2", question: "Why did you deny R-88102?", about_event_id: "e1" },
    ],
    empty,
  );
  assert.equal(plan[0].id, "g1");
  assert.equal(plan[0].about_event_id, "e3");
  assert.equal(plan[1].id, "g2");
  assert.equal(plan.length, 3);
  assert.ok(plan.some((q) => q.is_guardrail), "a guardrail question is added");
});

test("follow-ups on explained decisions, guardrail kind first", () => {
  const records = captureDecisions({
    events: [{ id: "e1", t: 20_000, type: "status_changed", record: "R-88102", field: "status", from: "Open", to: "Denied", confidence: 0.9, detail: "" }],
    transcript: [
      { t: 23_000, speaker: "agent", text: "Why did you deny that one?" },
      { t: 25_000, speaker: "expert", text: "The access code was opened, so we can't resell it." },
    ],
  });
  const plan = planDebrief([], { ...empty, records } as WorkMap, "Shift manager");
  assert.equal(plan[0].source, "follow_up");
  assert.equal(plan[0].is_guardrail, true);
  assert.equal(plan[0].about_event_id, "e1");
  assert.ok(plan.length >= 3);
});

test("never more than five, guardrail survives the cap", () => {
  const gaps = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, question: `Why did you change field ${i}?` }));
  const plan = planDebrief(gaps, empty);
  assert.equal(plan.length, 5);
  assert.ok(plan.some((q) => q.is_guardrail));
});

test("agent text", () => {
  const plan = planDebrief([], empty);
  assert.match(formatDebriefQuestion(plan[0], 0, 3), /^\[DEBRIEF\] Capture is over\. Question 1 of 3/);
  assert.match(formatDebriefQuestion(plan[0], 0, 3), /\(guardrail\)$/);
  assert.doesNotMatch(formatDebriefQuestion(plan[1], 1, 3), /Capture is over/);
  assert.match(formatTeachBack(), /^\[TEACH BACK\].*story, in order.*Is that right\?/);
  assert.match(formatTeachBack(), /their own words/);
  assert.match(formatWorkMapContext(empty), /^\[WORK MAP\]\nWORK MAP for returns-desk, taught by Aarav\./);
});

test("every plan has 3 to 5 questions and at least one guardrail", () => {
  const gap = (i: number) => ({ id: `g${i}`, question: `Why did you change field ${i}?` });
  for (const n of [0, 1, 2, 3, 4, 5, 9]) {
    const plan = planDebrief(Array.from({ length: n }, (_, i) => gap(i)), empty, "Shift manager");
    assert.ok(plan.length >= 3 && plan.length <= 5, `${n} gaps -> ${plan.length} questions`);
    assert.ok(plan.some((q) => q.is_guardrail), `${n} gaps -> no guardrail`);
    assert.equal(new Set(plan.map((q) => q.id)).size, plan.length, "no repeats");
  }
});

test("a guardrail gap counts as the guardrail", () => {
  const plan = planDebrief([{ id: "g1", question: "When would you ask the manager?" }], empty);
  assert.equal(plan.length, 3);
  assert.ok(!plan.some((q) => q.id === "gen-stop"), "doesn't ask when to stop twice");
});
