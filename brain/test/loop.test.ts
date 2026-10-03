// SIMULATED tests: no model call. Deterministic capture, validation, enforcement, and correction.
// Model output is simulated with hand-written candidates. Real-model checks live in model.test.ts.
// Run: npm test -w brain
import assert from "node:assert/strict";
import type { Rule } from "@understudy/shared";
import {
  captureDecisions, pickFromRecords, checkAction, canonicalField, canonicalEvents, score, nextQuestionKind, questionFor,
  workMapToAgentText, redact, validateCandidates, expertCases, applyCorrections, correctWorkMap,
  unlinkedExpertLines, validateLinks, classifyQuestion, type LineLink,
  type RuleCandidate, type WorkMapWithRecords,
} from "../index";
import { buildWorkMap, confirmWorkMap, loadJob, agentSafeJob, screenValues, scoreSession, redactTranscriptForJob, parsePolicy } from "../server";
import { runTutorCases, rulesLearned, OFF_RECORD_TEXT } from "../index";
import { events, transcript, debrief, ev, OFF_RECORD_MARKERS, CORRECTION_TEXT } from "./fixtures";

delete process.env.ANTHROPIC_API_KEY;
const emptyMap = (job_id: string) => ({ job_id, expert: "Aarav", steps: [], rules: [] as Rule[], open_gaps: [] });   // guarantee no model call in this file

(async () => {
  const job = loadJob("returns-desk")!;
  assert.ok(job, "job loads");
  const evs = canonicalEvents(job, events);

  // 1. Capture: grounded records, unknown left unknown, off-record dropped, PII redacted.
  const recs = captureDecisions({ events: evs, transcript, piiNames: ["Jordan Ellis"], escalateTo: "Shift manager" });
  const byEv = (id: string) => recs.find((r) => r.sources.event_ids[0] === id);
  const x2 = byEv("e1")!, x3 = byEv("e2")!, x4 = byEv("e3")!;
  assert.match(x2.why!, /access code was opened/);
  assert.deepEqual(x2.exceptions, ["If the code envelope is still sealed I'd take it back."]);
  assert.deepEqual(x2.quote_t, [25_000, 32_000], "each quote linked to its transcript t");
  assert.match(x3.why!, /No receipt means store credit only/);
  assert.ok(!x3.why!.includes("Jordan Ellis"), "PII redacted");
  assert.equal(x3.escalate_to, "Shift manager");
  assert.equal(x4.why, null, "vague answer stays unknown");
  assert.ok(x4.unknown.includes("why"));
  assert.ok(!byEv("e4"), "off-record event dropped");
  assert.ok(!OFF_RECORD_MARKERS.test(JSON.stringify(recs)), "off-record words dropped");
  assert.equal(byEv("e0")!.why, null);
  console.log("ok capture:", recs.length, "records;", recs.filter((r) => r.why).length, "explained");

  // 2. Question picker.
  const p1 = pickFromRecords(evs.slice(0, 2), [], { now: 21_000 })!;
  assert.equal(p1.about_event_id, "e1"); assert.match(p1.question, /^Why did you change status from Open to Denied on R-88102/);
  const p2 = pickFromRecords(evs.slice(0, 2), transcript.slice(0, 2), { now: 27_000 })!;
  assert.match(p2.question, /decide differently/);
  const p3 = pickFromRecords(evs.slice(0, 2), transcript.slice(0, 4), { now: 33_000 })!;
  assert.ok(p3.is_guardrail && /stop and ask/.test(p3.question));
  assert.equal(pickFromRecords(evs.slice(0, 4), transcript.slice(0, 10), { now: 106_000 }), null, "vague why not re-asked");
  assert.equal(pickFromRecords(evs, transcript.slice(0, 13), { now: 152_000 }), null, "off the record -> silent");
  assert.equal(pickFromRecords(evs.slice(0, 1), [], { now: 200_000 }), null, "stale -> silent");
  assert.equal(nextQuestionKind({ ...x3, asked: ["why", "what_would_change", "when_to_stop"] }), null, "no repeats");
  assert.equal(questionFor(x4, "why"), "Why did you change refund_method from Cash to Original card on R-88104?");
  assert.equal(classifyQuestion("Why did you change status from Open to Denied on R-88102?"), "why", "a 'why did you change' question is a why");
  assert.equal(classifyQuestion("What would make you decide differently on a case like R-88102?"), "what_would_change");
  console.log("ok picker");

  // 3. Validation of SIMULATED model candidates.
  const cases = expertCases(job, evs.filter((e) => e.t < 141_000), (r) => screenValues(job, r));
  assert.deepEqual(cases.map((c) => `${c.record}:${c.action}`).sort(), ["R-88101:refund", "R-88102:deny", "R-88104:refund"]);
  const C = (p: Partial<RuleCandidate>): RuleCandidate => ({
    record_id: x3.id, text: "t", type: "guardrail", when: [], must: [], must_not: [], must_not_action: [], escalate_to: null, reason_quote: "", ...p,
  });
  const ACCESS = "Intro to Biology textbook + access code";
  const cands: RuleCandidate[] = [
    C({ record_id: x2.id, text: "Opened access codes are not refundable", when: [{ field: "condition", op: "eq", value: "Opened", evidence: "Opened" }, { field: "item", op: "eq", value: ACCESS, evidence: "access codes" }], must_not_action: ["refund"], reason_quote: "Opened access codes are never refundable" }),
    C({ text: "No receipt: store credit only", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }], must: [{ field: "refund_method", value: "Store credit" }], reason_quote: "No receipt means store credit only" }),
    C({ text: "Over $100: shift manager before refund", type: "stop_and_ask", when: [{ field: "price", op: "gt", value: 100, evidence: "over a hundred dollars" }], must_not_action: ["refund", "store_credit"], escalate_to: "Shift manager", reason_quote: "over a hundred dollars I call the shift manager before I give anything back" }),
    // each of these must be rejected:
    C({ text: "invented quote", when: [{ field: "price", op: "gt", value: 50, evidence: "fifty" }], must_not_action: ["refund"], reason_quote: "Anything over fifty is suspicious" }),
    C({ text: "unknown field", when: [{ field: "loyalty_tier", op: "eq", value: "gold", evidence: "No receipt" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" }),
    C({ record_id: x4.id, text: "unexplained decision", when: [{ field: "card", op: "present", value: null, evidence: "know" }], must_not: [{ field: "refund_method", value: "Cash" }], reason_quote: "I don't know" }),
    C({ text: "unsupported op", when: [{ field: "item", op: "contains", value: "code", evidence: "No receipt" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" }),
    C({ text: "non-numeric limit", when: [{ field: "price", op: "gt", value: "a hundred", evidence: "over a hundred dollars" }], escalate_to: "Shift manager", reason_quote: "over a hundred dollars I call the shift manager" }),
    C({ text: "bad option", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }], must: [{ field: "refund_method", value: "Gift card" }], reason_quote: "No receipt means store credit only" }),
    C({ text: "unknown action", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }], must_not_action: ["void"], reason_quote: "No receipt means store credit only" }),
    C({ text: "no conditions", must: [{ field: "refund_method", value: "Store credit" }], reason_quote: "No receipt means store credit only" }),
    C({ text: "escalate-only over $100", type: "stop_and_ask", when: [{ field: "price", op: "gt", value: 100, evidence: "over a hundred dollars" }], escalate_to: "Shift manager", reason_quote: "over a hundred dollars I call the shift manager" }),
    C({ record_id: "dr-nope", text: "unknown record", when: [{ field: "price", op: "gt", value: 1, evidence: "No receipt" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" }),
  ];
  const v = validateCandidates(cands, { job, records: recs, cases });
  assert.deepEqual(v.rules.map((r) => r.text), ["Opened access codes are not refundable", "No receipt: store credit only", "Over $100: shift manager before refund"]);
  const why = Object.fromEntries(v.rejected.map((r) => [r.candidate.text, r.reason]));
  assert.match(why["invented quote"], /not the expert's exact words/);
  assert.match(why["unknown field"], /not on screen/);
  assert.match(why["unexplained decision"], /never explained/);
  assert.match(why["unsupported op"], /unsupported op/);
  assert.match(why["non-numeric limit"], /needs a number/);
  assert.match(why["bad option"], /not an option/);
  assert.match(why["unknown action"], /unknown action/);
  assert.match(why["no conditions"], /did not say this applies always/);
  assert.match(why["escalate-only over $100"], /too broad: .*deny.* R-88102/);
  assert.match(why["unknown record"], /unknown record_id/);
  assert.ok(v.rules.every((r) => !r.confirmed), "new rules start unconfirmed");
  for (const r of v.rules) {
    const e = v.evidence[r.id];
    const rec = recs.find((x) => x.id === e.record_id)!;
    assert.ok(rec.quotes[e.quote_index].includes(r.reason_quote) && e.quote_t !== null, "evidence links the exact quote and its time");
  }
  console.log(`ok validation: kept ${v.rules.length}, rejected ${v.rejected.length} of ${cands.length} SIMULATED candidates`);

  // 3b. Two independent sentences in ONE answer (Aarav's live case): conditions can't cross sentences.
  const one = captureDecisions({ events: [ev("k1", 1_000, undefined, "refund_to", null, "Store credit")], transcript: [
    { t: 2_000, speaker: "agent", text: "Why store credit?" },
    { t: 3_000, speaker: "expert", text: "No receipt means store credit only. If it's over a hundred dollars I call the shift manager." }] });
  const oid = one[0].id;
  const narrow = validateCandidates([
    C({ record_id: oid, text: "over $100 with no receipt", type: "stop_and_ask", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }, { field: "price", op: "gt", value: 100, evidence: "over a hundred dollars" }], must_not_action: ["refund"], escalate_to: "Shift manager", reason_quote: "If it's over a hundred dollars I call the shift manager" }),
    C({ record_id: oid, text: "spans sentences", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }, { field: "price", op: "gt", value: 100, evidence: "over a hundred dollars" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only. If it's over a hundred dollars" }),
    C({ record_id: oid, text: "over $100", type: "stop_and_ask", when: [{ field: "price", op: "gt", value: 100, evidence: "over a hundred dollars" }], must_not_action: ["refund"], escalate_to: "Shift manager", reason_quote: "If it's over a hundred dollars I call the shift manager" }),
    C({ record_id: oid, text: "no receipt", when: [{ field: "receipt_no", op: "missing", value: null, evidence: "No receipt" }], must_not_action: ["refund"], reason_quote: "No receipt means store credit only" }),
  ], { job, records: one });
  assert.deepEqual(narrow.rules.map((r) => r.text), ["over $100", "no receipt"]);
  assert.match(narrow.rejected[0].reason, /receipt_no missing is not stated in the rule's own quote/);
  assert.match(narrow.rejected[1].reason, /more than one sentence/);
  console.log("ok sentence scope: cross-sentence condition rejected, both independent rules kept");

  // 4. Tutor enforcement: only confirmed rules restrict.
  const nh = (job.records as { new_hire: Record<string, string | number | null>[] }).new_hire;
  const map0: WorkMapWithRecords = { job_id: "returns-desk", expert: "Aarav", steps: [], open_gaps: [], records: recs, rules: v.rules, rule_sources: v.evidence };
  assert.equal(checkAction({ action: "refund", record: nh[0] }, map0, { job }).ok, true, "unconfirmed rule does not enforce");
  assert.equal(checkAction({ action: "refund", record: nh[0] }, map0, { job, includeUnconfirmed: true }).ok, false, "preview mode sees it");
  const map1 = confirmWorkMap(map0, "2026-10-03T12:00:00Z");
  const n1 = checkAction({ action: "refund", record: nh[0] }, map1, { job });
  assert.equal(n1.ok, false, "N1 $142 refund caught");
  assert.match(n1.explanation!, /hand it to Shift manager/);
  assert.equal(checkAction({ action: "call_manager", record: nh[0] }, map1, { job }).ok, true);
  assert.equal(checkAction({ action: "deny", record: nh[0] }, map1, { job }).ok, true, "deny is not restricted by the $100 rule");
  assert.equal(checkAction({ action: "refund", record: nh[2] }, map1, { job }).ok, false, "N3 no receipt caught");
  assert.equal(checkAction({ action: "store_credit", record: { ...nh[2], price: 40 } }, map1, { job }).ok, true, "store_credit sets refund_method, so it passes");
  assert.equal(checkAction({ action: "refund", record: nh[4] }, map1, { job }).ok, true, "N5 routine stays silent");
  console.log("ok tutor: N1 ->", n1.explanation);

  // 5. Correction: only the contradicted rule is replaced; the record keeps its other rules.
  const prev: WorkMapWithRecords = {
    ...map1,
    extracted: Object.fromEntries(recs.filter((r) => r.why).map((r) => [r.id, JSON.stringify(r.quotes)])),
  };
  const LIMIT_ONLY = "The shift manager limit is two hundred dollars, not a hundred.";
  const corrected = correctWorkMap(prev, { record_id: x3.id, text: LIMIT_ONLY, t: 300_000 });
  const rebuilt = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript, previous: corrected });
  const x3b = rebuilt.records.find((r) => r.id === x3.id)!;
  assert.equal(x3b.status, "corrected");
  assert.equal(x3b.quotes[x3b.corrected_from!], LIMIT_ONLY, "correction appended after the earlier quotes");
  assert.match(x3b.quotes.join(" "), /No receipt means store credit only/, "earlier words kept");
  assert.ok(rebuilt.rules.some((r) => r.text === "Opened access codes are not refundable" && r.confirmed), "unrelated confirmed rule kept");
  assert.equal(rebuilt.extracted![x3.id], undefined, "corrected record queued for re-extraction (no key here)");
  // SIMULATED model output for the corrected record: it re-emits the old $100 rule, the no-receipt rule, and the new $200 rule.
  const after = validateCandidates([
    cands[1], cands[2],
    C({ text: "Over $200: shift manager", type: "limit", when: [{ field: "price", op: "gt", value: 200, evidence: "two hundred dollars" }], must_not_action: ["refund", "store_credit"], escalate_to: "Shift manager", reason_quote: "The shift manager limit is two hundred dollars, not a hundred" }),
  ], { job, records: rebuilt.records, cases });
  assert.deepEqual(after.rules.map((r) => r.text).sort(), ["No receipt: store credit only", "Over $200: shift manager"], "uncontradicted no-receipt rule survives");
  assert.match(after.rejected.find((r) => r.candidate.text.startsWith("Over $100"))!.reason, /superseded by the expert's correction/);
  const m2 = confirmWorkMap({ ...rebuilt, rules: [...rebuilt.rules, ...after.rules], rule_sources: { ...rebuilt.rule_sources, ...after.evidence } });
  assert.equal(checkAction({ action: "refund", record: nh[0] }, m2, { job }).ok, true, "$142 allowed under the $200 limit");
  assert.equal(checkAction({ action: "refund", record: { ...nh[0], price: 250 } }, m2, { job }).ok, false, "$250 blocked");
  assert.equal(checkAction({ action: "refund", record: { ...nh[2], price: 40 } }, m2, { job }).ok, false, "no-receipt rule still enforced");
  assert.equal(applyCorrections(recs, [])[0], recs[0]);
  console.log("ok correction: $100 superseded by $200; no-receipt rule kept");

  // 5b. Debrief: a question naming the record links at any age; spoken correction via (SIMULATED) model links.
  const full = [...transcript, ...debrief];
  const drec = captureDecisions({ events: evs, transcript: full });
  assert.match(drec.find((r) => r.sources.event_ids[0] === "e0")!.why!, /Routine one/, "debrief answer linked by record id, minutes later");
  const loose = unlinkedExpertLines(drec, full);
  assert.deepEqual(loose.map((l) => l.t), [160_000, 425_000, 442_000], "only unanswered on-record lines are offered; off-record and vague answers are not");
  const x3d = drec.find((r) => r.sources.event_ids[0] === "e2")!;
  const sim: LineLink[] = [
    { line_t: 425_000, record_id: x3d.id, kind: "correction", text: "The shift manager limit is two hundred dollars, not a hundred." },
    { line_t: 425_000, record_id: x3d.id, kind: "correction", text: "The limit is two hundred" },          // paraphrase: not verbatim
    { line_t: 151_000, record_id: x3d.id, kind: "why", text: "Regulars always get cash" },              // off-record line
    { line_t: 442_000, record_id: "dr-nope", kind: "why", text: "Yes, that's right." },                  // unknown record
  ];
  const kept = validateLinks(sim, drec, full.filter((l) => !l.off_record));
  assert.equal(kept.length, 1, "only the verbatim, on-record, known-record link survives");
  const spoken = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript: full,
    previous: { ...prev, links: { "160000": null, "425000": kept[0], "442000": null } } as WorkMapWithRecords });
  const x3s = spoken.records.find((r) => r.id === x3d.id)!;
  assert.equal(x3s.status, "corrected");
  assert.equal(x3s.quotes[x3s.corrected_from!], "The shift manager limit is two hundred dollars, not a hundred.");
  assert.ok(!spoken.open_gaps.some((g) => g.about_event_id === "e0"), "debrief answer closed the X1 gap");
  console.log("ok debrief: record-named question linked late; spoken correction applied; paraphrase/off-record links rejected");

  // 6. Work Map without a key: records, steps, gaps, no rules, no leaks.
  const map = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript });
  assert.equal(map.steps.length, 5);
  assert.deepEqual(map.open_gaps.map((g) => g.about_event_id).sort(), ["e0", "e3", "e3b"]);
  assert.equal(map.rules.length, 0);
  const text = workMapToAgentText(map);
  assert.ok(!/PLACEHOLDER|hidden_rules/.test(text) && !OFF_RECORD_MARKERS.test(JSON.stringify(map)));
  assert.ok(!JSON.stringify(agentSafeJob(job)).includes("hidden_rules"));
  const sv = screenValues(job, "R-88102")!;
  assert.equal(sv.item, "Intro to Biology textbook + access code");
  // PII fields keep their presence (rules may test "card present") but never their value.
  assert.ok(sv.customer === "[REDACTED]" && sv.card === "[REDACTED]", "PII values redacted from model context");
  assert.ok(!JSON.stringify(sv).includes("Priya") && !JSON.stringify(sv).includes("0932"), "no PII value leaks");
  console.log(`ok workmap (no key): ${map.steps.length} steps, ${map.open_gaps.length} gaps`);

  // 7. Field names, scoring, redaction.
  assert.equal(canonicalField(job, "refund_to"), "refund_method");
  assert.equal(canonicalField(job, "Purchased"), "purchase_date");
  const sb = score({ job, map,
    groundTruth: [{ t: 1000, field: "refund_method", from: "Cash", to: "Original card" }, { t: 5000, field: "purchase_date", from: null, to: "2026-09-30" }],
    events: [ev("v1", 2500, "R-88104", "refund_to", "Cash", "Original card"), ev("v2", 6000, "R-88104", "purchased", null, "2026-09-30")] });
  assert.equal(sb.vision_accuracy, 1);
  assert.equal(sb.rules_total, 4);
  assert.equal(redact("call 555-123-4567 or a@b.co"), "call [PHONE] or [EMAIL]");

  // 8. Answer-key scoring (SIMULATED maps). Returns desk with the 3 demo rules: R4 (card -> never cash) not taught.
  assert.deepEqual(rulesLearned(job, map1).map((x) => `${x.id}:${x.learned}`), ["R1:true", "R2:true", "R3:true", "R4:false"]);
  const tutor = runTutorCases(job, map1);
  assert.deepEqual(tutor.map((x) => `${x.case}:${x.trap ? (x.caught ? "caught" : "MISSED") : "-"}${x.false_alarm ? ":FALSE_ALARM" : ""}`),
    ["N1:caught", "N2:-", "N3:caught", "N4:caught", "N5:-"], "N1/N3/N4 caught; N2/N5 silent");
  const ss = scoreSession({ job_id: "returns-desk", map: map1, questions: [p1, p2, p3] });
  assert.deepEqual(ss.scoreboard, { rules_learned: 3, rules_total: 4, vision_accuracy: 0, tutor_catches: 3, tutor_traps: 3, false_alarms: 0, live_questions: 3, guardrail_questions: 1 });
  assert.ok(!JSON.stringify(ss).includes("refundable") && !JSON.stringify(ss).includes("PLACEHOLDER"), "score result carries ids and numbers, not answer-key text");
  assert.deepEqual(score({ job, map: emptyMap(job.job.id) }).tutor_catches, 0);
  // Invoice approval: a map implementing all six answer-key rules must learn 6/6, catch 4/4, no false alarms.
  const inv = loadJob("invoice-approval")!;
  const R = (id: string, when: Rule["when"], then: Rule["then"]): Rule => ({ id, text: id, type: "guardrail", when, then, reason_quote: id, screen_moment: { t: 0 }, source: "policy", confirmed: true });
  const invMap = { ...emptyMap("invoice-approval"), rules: [
    R("capex", [{ field: "amount", op: "gt", value: 5000 }], { must: { cost_center: "0400" } }),
    R("asset", [{ field: "cost_center", op: "eq", value: "0400" }, { field: "asset_number", op: "missing" }], { must_not_action: ["approve"] }),
    R("dup-dn", [{ field: "delivery_note_history", op: "eq", value: "Already paid" }], { must_not_action: ["approve"], escalate_to: "Controller" }),
    R("kovotech", [{ field: "supplier", op: "eq", value: "Kovotech s.r.o." }], { must_not_action: ["approve"], escalate_to: "Controller" }),
    R("unknown-supplier", [{ field: "supplier_master", op: "eq", value: "Not in master data" }], { must_not_action: ["approve"], escalate_to: "Controller" }),
    R("over-10k", [{ field: "amount", op: "gt", value: 10000 }], { must_not_action: ["approve"], escalate_to: "Controller" }),
  ] };
  const isb = score({ job: inv, map: invMap });
  assert.deepEqual([isb.rules_learned, isb.rules_total, isb.tutor_catches, isb.tutor_traps, isb.false_alarms], [6, 6, 4, 4, 0], "invoice answer key + probes are consistent");
  const invEmpty = score({ job: inv, map: emptyMap("invoice-approval") });
  assert.deepEqual([invEmpty.rules_learned, invEmpty.tutor_catches, invEmpty.false_alarms], [0, 0, 0]);
  console.log(`ok scoring: returns ${ss.scoreboard.rules_learned}/${ss.scoreboard.rules_total} rules, ${ss.scoreboard.tutor_catches}/${ss.scoreboard.tutor_traps} traps, ${ss.scoreboard.false_alarms} false alarms; invoice key 6/6, 4/4, 0`);

  // 9. Redaction + off-record end to end (judge test 5).
  const piiTalk: typeof transcript = [
    ...transcript,
    { t: 500_000, speaker: "agent", text: "Why did you change status from Open to Denied on R-88102?" },
    { t: 501_000, speaker: "expert", text: "Priya Raman paid with Mastercard ending 0932, call her at 555-201-7788. Opened access codes are never refundable." },
  ];
  const red = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript: piiTalk });
  const blob = JSON.stringify(red);
  for (const bad of ["Priya Raman", "0932", "555-201-7788", "Jordan Ellis", "cousin", "Regulars"]) assert.ok(!blob.includes(bad), `Work Map leaks "${bad}"`);
  assert.match(blob, /\[NAME\] paid with \[CARD\], call her at \[PHONE\]/);
  const shown = redactTranscriptForJob("returns-desk", piiTalk);
  assert.ok(shown.filter((l) => l.t >= 141_000 && l.t < 160_000).every((l) => l.text === OFF_RECORD_TEXT), "off-record lines masked");
  assert.ok(!JSON.stringify(shown).match(/Priya Raman|0932|Jordan Ellis|cousin/), "panel transcript redacted");
  assert.equal(shown.find((l) => l.t === 160_000)!.text, "Okay, back on the record.", "on-record lines kept");
  console.log("ok redaction: Work Map and panel transcript carry no PII or off-record text");

  // 10. parsePolicy without a model key or job: no rules, no crash.
  assert.deepEqual(await parsePolicy("Refunds over $100 need a shift manager.", job), []);
  assert.deepEqual(await parsePolicy("Refunds over $100 need a shift manager."), []);
  assert.deepEqual(await parsePolicy("   ", job), []);
  console.log("ok parsePolicy (no key): returns []");

  const _typecheck: Rule[] = map1.rules;
  void _typecheck;
  console.log("ALL SIMULATED CHECKS PASS");
})().catch((e) => { console.error(e); process.exit(1); });
