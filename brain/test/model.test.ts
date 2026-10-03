// REAL-MODEL test: calls the Anthropic API through buildWorkMap. Costs a few cents per run.
// Needs ANTHROPIC_API_KEY (read from the environment, .env.local, or app/.env.local). LLM_MODEL optional.
// Run: npm run test:model -w brain
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Value } from "@understudy/shared";
import { checkAction, correctWorkMap, workMapToAgentText, type WorkMapWithRecords } from "../index";
import { buildWorkMap, confirmWorkMap, loadJob } from "../server";
import { events, transcript, debrief, OFF_RECORD_MARKERS, CORRECTION_TEXT } from "./fixtures";

for (const p of [join(process.cwd(), ".env.local"), join(process.cwd(), "app/.env.local"), join(process.cwd(), "../app/.env.local"), join(process.cwd(), "../.env.local")]) {
  if (!process.env.ANTHROPIC_API_KEY && existsSync(p)) process.loadEnvFile(p);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("SKIPPED: no ANTHROPIC_API_KEY in env, .env.local, or app/.env.local. This test needs the real model.");
  process.exit(2);
}

const show = (m: WorkMapWithRecords) => {
  for (const r of m.rules) {
    const e = m.rule_sources![r.id];
    console.log(`   rule [${r.type}${r.confirmed ? ", confirmed" : ""}] ${r.text}\n        when ${JSON.stringify(r.when)} then ${JSON.stringify(r.then)}\n        quote "${r.reason_quote}" (record ${e.record_id}, said at t=${e.quote_t})`);
  }
  for (const x of m.rejected_rules ?? []) console.log(`   rejected: ${x.text} -> ${x.reason}`);
};

(async () => {
  const job = loadJob("returns-desk")!;
  const nh = (job.records as { new_hire: Record<string, Value>[] }).new_hire;
  const ex = (job.records as { expert: Record<string, Value>[] }).expert;
  const check = (m: WorkMapWithRecords, action: string, record: Record<string, Value>) => checkAction({ action, record }, m, { job });
  const openedNovel = { ...nh[4], condition: "Opened" };                       // $24 opened book: no rule should apply
  const openedCode = { ...ex[1] };                                              // opened access code, $189
  console.log(`model: ${process.env.LLM_MODEL || "claude-opus-5-5"}`);

  // 1. Build from the session.
  let t0 = Date.now();
  const map = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript });
  console.log(`\n[1] buildWorkMap: ${map.rules.length} rules, ${map.rejected_rules!.length} rejected, ${map.open_gaps.length} gaps, ${Date.now() - t0}ms`);
  show(map);
  assert.ok(map.rules.length >= 2, "model produced grounded rules");

  // 2. Every rule is grounded: exact quote from its own record, said on the record.
  for (const r of map.rules) {
    const e = map.rule_sources![r.id];
    const rec = map.records.find((x) => x.id === e.record_id)!;
    assert.ok(rec.why !== null, "rule only from an explained decision");
    assert.ok(rec.quotes[e.quote_index].toLowerCase().includes(r.reason_quote.toLowerCase().replace(/[‘’]/g, "'").trim().slice(0, 20)), "quote is from its record");
    assert.ok(transcript.some((l) => l.t === e.quote_t && !l.off_record && l.speaker === "expert"), "quote time points at an on-record expert line");
    assert.ok(!r.confirmed, "new rules start unconfirmed");
  }

  // 3. Gaps and off-record.
  assert.deepEqual(map.open_gaps.map((g) => g.about_event_id).sort(), ["e0", "e3", "e3b"], "unanswered decisions stay open gaps");
  assert.ok(!OFF_RECORD_MARKERS.test(JSON.stringify(map)) && !OFF_RECORD_MARKERS.test(workMapToAgentText(map)), "no off-record content anywhere");
  assert.ok(!map.rules.some((r) => JSON.stringify(r.then).includes('"Cash"') && !r.then.must_not), "no rule permits cash");

  // 4. Unconfirmed rules do not enforce; confirmed ones do, with correct scope.
  assert.equal(check(map, "refund", nh[0]).ok, true, "unconfirmed: N1 not blocked");
  const conf = confirmWorkMap(map);
  const r = {
    N1: check(conf, "refund", nh[0]), N3: check(conf, "refund", nh[2]), N5: check(conf, "refund", nh[4]),
    code: check(conf, "refund", openedCode), novel: check(conf, "refund", openedNovel), N1call: check(conf, "call_manager", nh[0]),
  };
  console.log(`\n[2] tutor after confirm: N1 refund ${r.N1.ok ? "ALLOWED" : "BLOCKED"}, N3 refund ${r.N3.ok ? "ALLOWED" : "BLOCKED"}, N5 refund ${r.N5.ok ? "ALLOWED" : "BLOCKED"}, opened access code ${r.code.ok ? "ALLOWED" : "BLOCKED"}, opened novel ${r.novel.ok ? "ALLOWED" : "BLOCKED"}`);
  assert.equal(r.N1.ok, false, "N1 $142 refund blocked");
  assert.equal(r.N3.ok, false, "N3 no-receipt refund blocked");
  assert.equal(r.code.ok, false, "opened access code refund blocked");
  assert.equal(r.N5.ok, true, "N5 routine refund allowed");
  assert.equal(r.novel.ok, true, "opened novel allowed: access-code rule is not over-broad");
  assert.equal(r.N1call.ok, true, "calling the manager is always allowed");

  // 5. Correction: $100 -> $200. Old rule must disappear; unrelated confirmed rules stay without a model call.
  const before = new Set(conf.rules.map((x) => x.id));
  const x3id = map.records.find((x) => x.sources.event_ids[0] === "e2")!.id;
  t0 = Date.now();
  const fixed = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript, previous: correctWorkMap(conf, { record_id: x3id, text: CORRECTION_TEXT, t: 300_000 }) });
  console.log(`\n[3] after correction: ${fixed.rules.length} rules, ${Date.now() - t0}ms`);
  show(fixed);
  const fromX3 = fixed.rules.filter((x) => fixed.rule_sources![x.id].record_id === x3id);
  assert.ok(fromX3.some((x) => x.when.some((c) => c.field === "price" && (c.op === "gt" || c.op === "gte") && Number(c.value) >= 199)), "corrected $200 limit rule extracted (see 'rejected:' lines above if missing)");
  assert.ok(fromX3.length >= 1, "corrected record re-extracted");
  assert.ok(fromX3.every((x) => !before.has(x.id) && !x.confirmed), "corrected rules are new and unconfirmed");
  assert.ok(!fixed.rules.some((x) => x.when.some((c) => c.field === "price" && c.value === 100)), "obsolete $100 rule gone");
  assert.ok(fixed.rules.filter((x) => fixed.rule_sources![x.id].record_id !== x3id).every((x) => before.has(x.id) && x.confirmed), "unrelated rules kept as-is");
  assert.equal(check(fixed, "refund", nh[0]).ok, true, "before re-confirm: corrected rules not enforced");
  const fixedConf = confirmWorkMap(fixed);
  const big = { ...nh[0], price: 250 };
  const after = { N1: check(fixedConf, "refund", nh[0]), big: check(fixedConf, "refund", big), N3: check(fixedConf, "refund", nh[2]) };
  console.log(`    tutor after re-confirm: N1 $142 refund ${after.N1.ok ? "ALLOWED" : "BLOCKED"}, $250 refund ${after.big.ok ? "ALLOWED" : "BLOCKED"}, N3 no-receipt refund ${after.N3.ok ? "ALLOWED" : "BLOCKED"}`);
  assert.equal(after.N1.ok, true, "$142 now under the corrected $200 limit");
  assert.equal(after.big.ok, false, "$250 blocked by the corrected limit");
  assert.equal(after.N3.ok, false, "no-receipt rule restated in the correction still holds");

  // 5b. Spoken debrief + teach-back, exactly as the app sends it: no correctWorkMap call.
  t0 = Date.now();
  const spoken = await buildWorkMap({ job_id: "returns-desk", expert: "Aarav", events, transcript: [...transcript, ...debrief], previous: conf });
  console.log(`\n[3b] spoken debrief + teach-back: ${spoken.rules.length} rules, ${Date.now() - t0}ms`);
  for (const [t, k] of Object.entries(spoken.links ?? {})) console.log(`    line t=${t} -> ${k ? `${k.kind} on ${k.record_id}: "${k.text}"` : "not about a decision"}`);
  show(spoken);
  assert.ok(!spoken.open_gaps.some((g) => g.about_event_id === "e0"), "debrief answer closed the X1 gap");
  assert.equal(spoken.links?.["442000"] ?? null, null, "'Yes, that's right' is not linked");
  assert.equal(spoken.records.find((x) => x.id === x3id)!.status, "corrected", "spoken correction detected");
  assert.ok(!spoken.rules.some((x) => x.when.some((c) => c.field === "price" && c.value === 100)), "obsolete $100 rule gone");
  const spokenConf = confirmWorkMap(spoken);   // app confirms after the final "yes"
  assert.equal(check(spokenConf, "refund", nh[0]).ok, true, "$142 allowed under the spoken $200 limit");
  assert.equal(check(spokenConf, "refund", { ...nh[0], price: 250 }).ok, false, "$250 blocked");

  // 6. Aarav's live case: two independent rules in ONE answer must not merge their conditions.
  t0 = Date.now();
  const one = confirmWorkMap(await buildWorkMap({ job_id: "returns-desk", expert: "Aarav",
    events: [{ id: "k1", t: 1_000, type: "field_changed", field: "refund_to", from: null, to: "Store credit", confidence: 0.9, detail: "refund to store credit" }],
    transcript: [
      { t: 2_000, speaker: "agent", text: "Why store credit there?" },
      { t: 3_000, speaker: "expert", text: "No receipt means store credit only. If it's over a hundred dollars I call the shift manager." },
    ] }));
  console.log(`\n[4] one answer, two sentences: ${one.rules.length} rules, ${one.rejected_rules!.length} rejected, ${Date.now() - t0}ms`);
  show(one);
  assert.ok(!one.rules.some((x) => x.when.some((c) => c.field === "receipt_no") && x.when.some((c) => c.field === "price")), "no merged receipt+price rule");
  const withReceipt = check(one, "refund", nh[0]);   // $142 WITH a receipt
  console.log(`    $142 refund with receipt ${withReceipt.ok ? "ALLOWED" : "BLOCKED"}, N3 no-receipt refund ${check(one, "refund", nh[2]).ok ? "ALLOWED" : "BLOCKED"}`);
  assert.equal(withReceipt.ok, false, "$100 rule applies with a receipt too");
  assert.equal(check(one, "refund", nh[2]).ok, false, "no-receipt rule applies");

  console.log("\nALL REAL-MODEL CHECKS PASS");
})().catch((e) => { console.error(e); process.exit(1); });
