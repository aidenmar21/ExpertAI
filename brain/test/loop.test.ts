// End-to-end check of brain on fake returns-desk data: capture -> records -> Work Map -> tutor check.
// Run: npx tsx brain/test/loop.test.ts   (from repo root; uses the LLM only if ANTHROPIC_API_KEY is set)
import assert from "node:assert/strict";
import type { Rule, ScreenEvent, TranscriptLine } from "@understudy/shared";
import {
  captureDecisions, pickFromRecords, checkAction, canonicalField, score, nextQuestionKind, questionFor, workMapToAgentText, redact,
} from "../index";
import { buildWorkMap, confirmWorkMap, loadJob, agentSafeJob, groundRules, screenValues, type LlmRule } from "../server";

const ev = (id: string, t: number, record: string | undefined, field: string, from: string | null, to: string | null, type: ScreenEvent["type"] = "field_changed"): ScreenEvent =>
  ({ id, t, type, record, field, from, to, confidence: 0.9, detail: `${field} ${from} -> ${to}` });

const events: ScreenEvent[] = [
  ev("e0", 1_000, "R-88101", "status", "Open", "Refunded", "status_changed"),           // X1 routine, never asked
  ev("e1", 20_000, "R-88102", "status", "Open", "Denied", "status_changed"),            // X2
  ev("e2", 60_000, undefined, "refund_method", null, "Store credit"),                   // X3
  ev("e3", 100_000, "R-88104", "refund_method", "Cash", "Original card"),               // X4
  ev("e4", 145_000, "R-88104", "status", "Open", "Refunded", "status_changed"),         // off the record
];
const L = (t: number, speaker: TranscriptLine["speaker"], text: string, off_record?: boolean): TranscriptLine => ({ t, speaker, text, off_record });
const transcript: TranscriptLine[] = [
  L(23_000, "agent", "Why did you deny that one?"),
  L(25_000, "expert", "The access code was opened, so we can't resell it. Opened access codes are never refundable."),
  L(30_000, "agent", "What would make you decide differently?"),
  L(32_000, "expert", "If the code envelope is still sealed I'd take it back."),
  L(63_000, "agent", "Why store credit there?"),
  L(65_000, "expert", "No receipt means store credit only, and Jordan Ellis knows that."),
  L(70_000, "agent", "Is there a point where you'd stop and ask someone instead?"),
  L(72_000, "expert", "If it's over a hundred dollars I call the shift manager."),
  L(103_000, "agent", "Why the card and not cash?"),
  L(105_000, "expert", "I don't know"),
  L(141_000, "expert", "Off the record, Visa ending 4417 is my cousin's card.", true),
  L(150_000, "agent", "Why did you refund that?", true),
  L(151_000, "expert", "secret reason", true),
];

(async () => {
  // 1. Capture: grounded records, unknown left unknown, off-record dropped, PII redacted.
  const recs = captureDecisions({ events, transcript, piiNames: ["Jordan Ellis"], escalateTo: "Shift manager" });
  const byEv = (id: string) => recs.find((r) => r.sources.event_ids[0] === id);
  const x2 = byEv("e1")!, x3 = byEv("e2")!, x4 = byEv("e3")!;
  assert.match(x2.why!, /access code was opened/);
  assert.deepEqual(x2.exceptions, ["If the code envelope is still sealed I'd take it back."]);
  assert.match(x3.why!, /No receipt means store credit only/);
  assert.ok(!x3.why!.includes("Jordan Ellis"), "PII redacted");
  assert.equal(x3.escalate_to, "Shift manager");
  assert.equal(x3.guardrails.length, 1);
  assert.equal(x4.why, null, "vague answer stays unknown");
  assert.ok(x4.unknown.includes("why"));
  assert.ok(!byEv("e4"), "off-record event dropped");
  assert.ok(!JSON.stringify(recs).includes("cousin") && !JSON.stringify(recs).includes("secret"), "off-record words dropped");
  assert.equal(byEv("e0")!.why, null);
  console.log("ok capture:", recs.length, "records;", recs.filter((r) => r.why).length, "with why");

  // 2. Questions: grounded, ordered, never repeated.
  assert.equal(nextQuestionKind(x2), "when_to_stop");
  assert.equal(nextQuestionKind(x3), "what_would_change");
  assert.equal(nextQuestionKind({ ...x3, asked: ["why", "what_would_change", "when_to_stop"] }), null, "no repeats");
  assert.equal(questionFor(x4, "why"), "Why did you change refund_method from Cash to Original card on R-88104?");
  // Picker: unexplained first, then follow-ups on the latest, silent when off record or nothing fresh.
  const evX4 = events.slice(0, 4), tX4 = transcript.slice(0, 10);   // up to the vague X4 answer
  assert.equal(pickFromRecords(evX4, tX4, { now: 106_000 }), null, "vague why not re-asked; X4 not explained -> no follow-up");
  const p1 = pickFromRecords(evX4.slice(0, 2), [], { now: 21_000 })!;
  assert.equal(p1.about_event_id, "e1"); assert.match(p1.question, /^Why did you change status from Open to Denied on R-88102/);
  const p2 = pickFromRecords(evX4.slice(0, 2), transcript.slice(0, 2), { now: 27_000 })!;
  assert.equal(p2.about_event_id, "e1"); assert.match(p2.question, /decide differently/);
  const p3 = pickFromRecords(evX4.slice(0, 2), transcript.slice(0, 4), { now: 33_000 })!;
  assert.ok(p3.is_guardrail && /stop and ask/.test(p3.question));
  assert.equal(pickFromRecords(events, transcript, { now: 152_000 }), null, "off the record -> silent");
  assert.equal(pickFromRecords(evX4.slice(0, 1), [], { now: 200_000 }), null, "stale -> silent");
  console.log("ok picker:", p1.question, "|", p2.question, "|", p3.question);
  console.log("ok questions:", questionFor(byEv("e0")!, "why"));

  // 3. Work Map: steps, gaps for unknowns, no hidden_rules leak.
  const job = loadJob("returns-desk")!;
  assert.ok(job, "job loads");
  assert.ok(!JSON.stringify(agentSafeJob(job)).includes("hidden_rules"));
  assert.equal(canonicalField(job, "refund_to"), "refund_method");
  assert.equal(canonicalField(job, "Purchased"), "purchase_date");
  assert.equal(canonicalField(job, "status"), "status");
  const sb = score({ job, map: { job_id: "returns-desk", expert: "A", steps: [], rules: [], open_gaps: [] },
    groundTruth: [{ t: 1000, field: "refund_method", from: "Cash", to: "Original card" }, { t: 5000, field: "purchase_date", from: null, to: "2026-09-30" }],
    events: [ev("v1", 2500, "R-88104", "refund_to", "Cash", "Original card"), ev("v2", 6000, "R-88104", "purchased", null, "2026-09-30")] });
  assert.equal(sb.vision_accuracy, 1, "label-named vision events match key-named ground truth");
  assert.equal(sb.rules_total, 6);
  const sv = screenValues(job, "R-88102")!;
  assert.equal(sv.item, "Intro to Biology textbook + access code");
  assert.ok(!("customer" in sv) && !("card" in sv), "PII fields stripped from LLM context");
  const map = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript });
  assert.equal(map.steps.length, 4);
  assert.equal(map.open_gaps.length, 2);
  assert.ok(map.open_gaps.some((g) => g.about_event_id === "e3"));
  const text = workMapToAgentText(map);
  assert.ok(!/PLACEHOLDER|hidden_rules|cousin/.test(text));
  console.log(`ok workmap: ${map.steps.length} steps, ${map.rules.length} LLM rules, ${map.open_gaps.length} gaps${process.env.ANTHROPIC_API_KEY ? "" : " (no ANTHROPIC_API_KEY: LLM rules skipped)"}`);
  for (const r of map.rules) console.log("   rule:", r.type, "|", r.text, "| when", JSON.stringify(r.when), "| then", JSON.stringify(r.then), "| quote:", r.reason_quote);

  // 3b. Grounding: simulated LLM output; invented quotes, unknown fields, and unexplained records are dropped.
  const base = { must: [], must_not: [], must_not_action: [], escalate_to: null } as const;
  const llm: LlmRule[] = [
    { ...base, record_id: x3.id, text: "No receipt: store credit only", type: "guardrail", when: [{ field: "receipt_no", op: "missing", value: null }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" },
    { ...base, record_id: x3.id, text: "Over $100: shift manager", type: "limit", when: [{ field: "price", op: "gt", value: 100 }], escalate_to: "Shift manager", reason_quote: "If it's over a hundred dollars I call the shift manager" },
    { ...base, record_id: x3.id, text: "Invented", type: "guardrail", when: [{ field: "price", op: "gt", value: 50 }], must_not_action: ["refund"], reason_quote: "Anything over fifty is suspicious" },
    { ...base, record_id: x3.id, text: "Bad field", type: "guardrail", when: [{ field: "loyalty_tier", op: "eq", value: "gold" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" },
    { ...base, record_id: x4.id, text: "Unexplained", type: "guardrail", when: [], must_not: [{ field: "refund_method", value: "Cash" }], reason_quote: "I don't know" },
  ];
  const grounded = groundRules(llm, recs, job);
  assert.deepEqual(grounded.map((g) => g.text), ["No receipt: store credit only", "Over $100: shift manager"]);
  console.log("ok grounding: kept", grounded.length, "of", llm.length, "simulated LLM rules");

  // 4. Confirmation (teach-back).
  const confirmed = confirmWorkMap(map, "2026-10-03T12:00:00Z");
  assert.equal(confirmed.records.filter((r) => r.status === "confirmed").length, 2);
  assert.ok(confirmed.rules.every((r) => r.confirmed));

  // 5. Tutor: checkAction on new-hire cases with rules shaped like the expert's answers.
  const rules: Rule[] = map.rules.length ? confirmed.rules : grounded.length ? grounded : [
    { id: "a", text: "No receipt means store credit only", type: "guardrail", when: [{ field: "receipt_no", op: "missing" }], then: { must_not_action: ["refund"] }, reason_quote: "No receipt means store credit only", screen_moment: x3.sources.screen_moment, source: "live_question", confirmed: true },
    { id: "b", text: "Over $100 needs the shift manager", type: "limit", when: [{ field: "price", op: "gt", value: 100 }], then: { escalate_to: "Shift manager" }, reason_quote: "If it's over a hundred dollars I call the shift manager.", screen_moment: x3.sources.screen_moment, source: "live_question", confirmed: true },
  ];
  const nh = (job.records as { new_hire: Record<string, string | number | null>[] }).new_hire;
  const r = (i: number, action: string) => checkAction({ action, record: nh[i] }, { ...map, rules });
  const n1 = r(0, "refund"), n3 = r(2, "refund"), n3ok = r(2, "call_manager"), n5 = r(4, "refund");
  assert.equal(n1.ok, false, "N1 $142 refund caught");
  assert.equal(n3.ok, false, "N3 no receipt caught");
  assert.equal(n3ok.ok, true);
  assert.equal(n5.ok, true, "N5 routine stays silent");
  console.log("ok tutor: N1 ->", n1.explanation);

  assert.equal(redact("call 555-123-4567 or a@b.co"), "call [PHONE] or [EMAIL]");
  console.log("ALL PASS");
})().catch((e) => { console.error(e); process.exit(1); });
