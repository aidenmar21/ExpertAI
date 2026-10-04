// Simulated only: every SDK request is intercepted, and fetch is forbidden.
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { Rule, Value } from "@understudy/shared";
import { checkAction, deriveFields, emptyWorkMap, overrideByDecisions, reconcileBaseline, runTutorCases, caseRecord, rulesLearned } from "../index";
import { appendAudit, auditDir, verifyAudit } from "../audit";
import { baselineRulesFor, knowledgeIndex, roleDoc } from "../knowledge";
import { confirmWorkMap, loadJob, parsePolicy } from "../server";

mock.method(globalThis, "fetch", () => { throw new Error("Network forbidden in simulated tests"); });
// Production only awaits create(); the simulated boundary does not need the SDK's streaming APIPromise helpers.
const messages = Anthropic.Messages.prototype as unknown as { create: (...args: unknown[]) => Promise<unknown> };
const model = mock.method(messages, "create", () => { throw new Error("Unexpected model request"); });
delete process.env.ANTHROPIC_API_KEY;
const job = loadJob("returns-desk")!;
function rule(p: Partial<Rule> = {}): Rule {
  return { id: "company", text: "No receipt means store credit only", type: "guardrail", when: [{ field: "receipt_no", op: "missing" }], then: { must: { refund_method: "Store credit" } }, reason_quote: "No receipt means store credit only.", screen_moment: { t: 65_000 }, source: "live_question", confirmed: true, ...p };
}
const baseline = rule({ id: "baseline", source: "baseline", confirmed: false });
const mapOf = (...rules: Rule[]) => ({ ...emptyWorkMap(job.job.id, "Demo expert"), rules });
const demo = confirmWorkMap({ ...mapOf(
  rule({ id: "opened-code", text: "Opened access codes are never refundable", when: [{ field: "item", op: "eq", value: "Intro to Biology textbook + access code" }, { field: "condition", op: "eq", value: "Opened" }], then: { must_not_action: ["refund", "store_credit"] }, reason_quote: "Opened access codes are never refundable." }),
  rule({ id: "no-receipt" }),
  rule({ id: "manager", when: [{ field: "price", op: "gt", value: 100 }], then: { must_not_action: ["refund", "store_credit"], escalate_to: "Shift manager" }, reason_quote: "Over a hundred dollars I call the shift manager." }),
  rule({ id: "card", when: [{ field: "payment_method", op: "eq", value: "card" }], then: { must: { refund_method: "Original card" }, must_not: { refund_method: "Cash" } }, reason_quote: "Card payments go back to the card, never cash." }),
), records: [] }, "2026-10-03T12:00:00.000Z");

test("confirmed four-rule demo catches N1/N3/N4 and stays silent on every correct move, including N2/N5", () => {
  assert.equal(demo.rules.length, 4);
  assert.ok(demo.rules.every(r => r.confirmed));
  assert.deepEqual(runTutorCases(job, demo).map(({ case: id, trap, caught, false_alarm }) => ({ id, trap, caught, false_alarm })), [
    { id: "N1", trap: true, caught: true, false_alarm: false },
    { id: "N2", trap: false, caught: null, false_alarm: false },
    { id: "N3", trap: true, caught: true, false_alarm: false },
    { id: "N4", trap: true, caught: true, false_alarm: false },
    { id: "N5", trap: false, caught: null, false_alarm: false },
  ]);
  assert.deepEqual(rulesLearned(job, demo), ["R1", "R2", "R3", "R4"].map(id => ({ id, learned: true })));
  const check = (record: Record<string, Value>, action = "refund") => checkAction({ action, record }, demo, { job });
  const routine = caseRecord(job, "N5")!;
  assert.equal(check({ ...routine, price: 100 }).ok, true, "threshold is strictly over $100");
  assert.equal(check({ ...routine, price: 100.01 }).rule?.id, "manager");
  assert.equal(check({ ...routine, refund_method: "Cash" }).rule?.id, "card");
  assert.equal(check({ ...routine, card: null, receipt_no: null, refund_method: "Cash" }).rule?.id, "no-receipt");
  assert.equal(check({ ...routine, card: null, receipt_no: null, refund_method: "Cash" }, "store_credit").ok, true, "apply action sets before checking outcomes");
  assert.equal(check({ ...routine, condition: "Opened" }).ok, true, "an opened novel is not an access code");
  assert.equal(check({ ...routine, item: "Intro to Biology textbook + access code", condition: "Opened" }).rule?.id, "opened-code");
});

test("baseline fallback only speaks for uncovered cases and identifies the industry standard", () => {
  const action = { action: "refund", record: { receipt_no: null, refund_method: "Cash", price: 40 } };
  const hit = checkAction(action, mapOf(baseline));
  assert.equal(hit.ok, false); assert.equal(hit.standard, true); assert.equal(hit.rule?.id, baseline.id);
  assert.match(hit.explanation!, /industry standard/i);
  assert.equal(checkAction(action, mapOf(baseline), { baselineFallback: false }).ok, true);
  assert.equal(checkAction(action, mapOf(rule({ confirmed: false }))).ok, true, "unconfirmed company rule cannot enforce");
  assert.equal(checkAction(action, mapOf(baseline, rule({ when: [{ field: "price", op: "gt", value: 100 }] }))).standard, true);
  assert.equal(checkAction(action, mapOf(baseline, rule({ then: { must: { refund_method: "Cash" } } }))).ok, true, "company permits this case");
  assert.equal(checkAction(action, mapOf(baseline, rule({ then: { must: { refund_method: "Cash" } } })), { includeUnconfirmed: true }).ok, true, "preview cannot promote a baseline ahead of the company");
  const companyHit = checkAction(action, mapOf(baseline, rule()));
  assert.equal(companyHit.rule?.id, "company"); assert.equal(companyHit.standard, undefined);
  assert.equal(checkAction(action, mapOf({ ...baseline, overridden_by: "decision" })).ok, true);
  assert.equal(checkAction(action, mapOf({ ...baseline, confirmed: true, overridden_by: "company" })).ok, true, "obsolete rules never enforce");
  assert.equal(checkAction(action, mapOf({ ...baseline, confirmed: true, confirmed_by: "company" })).ok, true, "matched baseline is represented by company rule");
  assert.equal(checkAction({ ...action, action: "call_manager" }, mapOf(baseline)).ok, true);
});

test("reconcileBaseline matches equivalent wording and preserves expert provenance", () => {
  const company = rule({ text: "Without a receipt, issue credit at the lowest sale price", clip_id: "expert-clip", then: { must: { refund_method: " store CREDIT " } } });
  const [matched] = reconcileBaseline([baseline], [company]);
  assert.equal(matched.confirmed, true); assert.equal(matched.confirmed_by, company.id);
  assert.equal(matched.overridden_by, undefined); assert.equal(matched.reason_quote, company.reason_quote);
  assert.equal(matched.clip_id, company.clip_id); assert.deepEqual(matched.screen_moment, company.screen_moment);
  const multiple = rule({ when: [{ field: "price", op: "gt", value: 100 }, { field: "condition", op: "in", value: ["New", "Opened"] }] });
  const reordered = rule({ ...multiple, source: "baseline", confirmed: false, when: [{ field: "condition", op: "in", value: [" opened ", "new"] }, { field: "price", op: "gt", value: 100 }] });
  assert.equal(reconcileBaseline([reordered], [multiple])[0].confirmed_by, multiple.id);
  assert.deepEqual(baseline, rule({ id: "baseline", source: "baseline", confirmed: false }), "inputs are not mutated");
});

test("reconcileBaseline overrides real conflicts without conflating unrelated predicates or outcomes", () => {
  const cash = rule({ then: { must: { refund_method: "Cash" } } });
  const [overridden] = reconcileBaseline([baseline], [cash]);
  assert.equal(overridden.confirmed, false); assert.equal(overridden.overridden_by, cash.id); assert.equal(overridden.override_quote, cash.reason_quote);
  const limit = rule({ source: "baseline", confirmed: false, when: [{ field: "price", op: "gt", value: 100 }], then: { escalate_to: "Shift manager" } });
  assert.equal(reconcileBaseline([limit], [rule({ ...limit, id: "higher-limit", source: "live_question", when: [{ field: "price", op: "gt", value: 200 }] })])[0].overridden_by, "higher-limit", "changed limit is an override, not confirmation");
  const conflicting = rule({ then: { must: { refund_method: "Cash" }, escalate_to: "Shift manager" } });
  assert.equal(reconcileBaseline([{ ...baseline, then: { ...baseline.then, escalate_to: "Shift manager" } }], [conflicting])[0].overridden_by, conflicting.id, "shared escalation cannot hide a conflict");
  assert.deepEqual(reconcileBaseline([baseline], [rule({ then: { must: { status: "Open" } } })]), [baseline], "unrelated outcome is not a conflict");
  const opened = { ...baseline, when: [{ field: "condition", op: "eq" as const, value: "Opened" }] };
  const sealed = rule({ when: [{ field: "condition", op: "eq", value: "New" }], then: { must: { refund_method: "Cash" } } });
  assert.deepEqual(reconcileBaseline([opened], [sealed]), [opened], "same field with disjoint values is unrelated");
  assert.equal(reconcileBaseline([opened], [sealed, rule({ when: opened.when })])[0].confirmed_by, "company", "skip an unrelated first candidate");
});

test("overrideByDecisions requires an explained, applicable violation", () => {
  const decision = { id: "decision", record: "R-test", why: "We refund cash here.", quotes: ["We refund cash here."], event: { field: "refund_method", to: "Cash" } };
  const values = () => ({ receipt_no: null });
  const [overridden] = overrideByDecisions([baseline], [decision], values);
  assert.equal(overridden.overridden_by, decision.id); assert.equal(overridden.override_quote, decision.quotes[0]);
  for (const d of [{ ...decision, why: null }, { ...decision, event: {} }, { ...decision, event: { field: "refund_method", to: " store CREDIT " } }]) {
    assert.deepEqual(overrideByDecisions([baseline], [d], values), [baseline]);
  }
  assert.deepEqual(overrideByDecisions([baseline], [decision], () => ({ receipt_no: "R" })), [baseline]);
  assert.equal(overrideByDecisions([{ ...baseline, when: [] }], [decision], values)[0].overridden_by, decision.id, "universal rule can be overridden");
  assert.equal(overrideByDecisions([{ ...baseline, then: { must_not: { refund_method: "Cash" } } }], [decision], values)[0].overridden_by, decision.id);
  for (const untouched of [rule(), { ...baseline, confirmed: true }, { ...baseline, overridden_by: "earlier" }]) {
    assert.deepEqual(overrideByDecisions([untouched], [decision], values), [untouched]);
  }
});

test("deriveFields computes past/future day offsets and card tender without mutating or overwriting", () => {
  const datedJob = { ...job, job: { ...job.job, business_date: "2026-03-10" } };
  const rec = { purchase_date: "2026-03-07", start_date: "2026-03-12", card: "[REDACTED]" };
  assert.deepEqual(deriveFields(datedJob, rec), { ...rec, days_since_purchase: 3, days_to_purchase: -3, days_since_start: -2, days_to_start: 2, payment_method: "card" });
  assert.deepEqual(rec, { purchase_date: "2026-03-07", start_date: "2026-03-12", card: "[REDACTED]" });
  const explicit = { ...rec, days_since_purchase: 9, days_to_purchase: null, payment_method: "cash" };
  assert.equal(deriveFields(datedJob, explicit).days_since_purchase, 9);
  assert.equal(deriveFields(datedJob, explicit).days_to_purchase, null);
  assert.equal(deriveFields(datedJob, explicit).payment_method, "cash");
  for (const card of [null, "", "  "]) assert.equal(deriveFields(job, { card }).payment_method, null);
  assert.deepEqual(deriveFields(undefined, { purchase_date: "2026-03-07" }), { purchase_date: "2026-03-07" });
  assert.deepEqual(deriveFields(datedJob, { purchase_date: "invalid", other_date: null }), { purchase_date: "invalid", other_date: null });
  assert.equal(deriveFields({ ...job, job: { ...job.job, business_date: "invalid" } }, rec).days_since_purchase, undefined);
});

// Canonical screen fields transcribed from knowledge/roles/<role>.md (some docs use plain text).
const roleFields: Record<string, string> = {
  "retail-cashier-returns": "receipt_no customer item item_type price purchase_date days_since_purchase condition payment_method refund_method status",
  "accounts-payable-clerk": "invoice_no supplier amount currency invoice_date due_date supplier_master po_number delivery_note delivery_note_history approver cost_center po_match status",
  "customer-support-agent": "customer sla_due first_response_sent category priority channel refund_amount account_tier assignee sentiment status",
  "front-desk-receptionist": "reservation_no guest loyalty_tier special_requests room_type rate check_in check_out balance_due status card_on_file id_verified",
  "hr-onboarding-coordinator": "employee_id employee start_date manager days_to_start offer_signed system_access status i9_status w4_status direct_deposit background_check equipment_requested",
  "insurance-claims-intake": "claim_no policy_no policy_status claimant loss_date report_date days_to_report loss_type estimated_amount deductible police_report photos_received prior_claims_12m fraud_flags status",
  "scheduling-coordinator": "appointment_no client provider service start_time duration_min double_booked buffer_min notice_hours no_show_count deposit_paid status",
  "bookkeeping-assistant": "transaction_id date payee amount account category receipt_attached reconciled period_closed personal_flag approver status",
};
const baselineFile = JSON.parse(readFileSync(new URL("../../knowledge/baseline-rules.json", import.meta.url), "utf8")) as { roles: Record<string, Rule[]> };
test("every baseline role is indexed and every condition field/operator is canonical", () => {
  const ids = knowledgeIndex().roles.map(r => r.id).sort();
  assert.deepEqual(Object.keys(baselineFile.roles).sort(), ids);
  assert.deepEqual(Object.keys(roleFields).sort(), ids);
  const validOps = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "missing", "present"]);
  for (const id of ids) {
    const fields = new Set(roleFields[id].split(" "));
    const doc = roleDoc(id)!;
    for (const field of fields) assert.match(doc, new RegExp(`\\b${field}\\b`), `${id}: canonical field ${field} must be documented`);
    assert.ok(baselineFile.roles[id].length > 0);
    for (const r of baselineFile.roles[id]) for (const c of r.when) {
      assert.ok(fields.has(c.field), `${id}/${r.id}: unknown field ${c.field}`);
      assert.ok(validOps.has(c.op), `${id}/${r.id}: invalid op ${c.op}`);
    }
    assert.ok(baselineRulesFor(id).every(r => r.source === "baseline" && !r.confirmed));
  }
});

test("parsePolicy validates simulated non-returns rules and returns full policy sentence unconfirmed", async () => {
  const invoiceJob = loadJob("invoice-approval")!;
  const policy = "Invoices over 10000 need the Controller before approval. Never guess a supplier.";
  model.mock.mockImplementation(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ rules: [{
    record_id: "policy", text: "Over 10000 needs Controller approval", type: "limit",
    when: [{ field: "amount", op: "gt", value: 10000, evidence: "over 10000" }], must: [], must_not: [], must_not_action: ["approve"], escalate_to: "Controller", reason_quote: "over 10000 need the Controller before approval",
  }] }) }] }));
  process.env.ANTHROPIC_API_KEY = "simulated-test-key";
  try {
    const rules = await parsePolicy(policy, invoiceJob);
    assert.equal(rules.length, 1); assert.equal(rules[0].source, "policy"); assert.equal(rules[0].confirmed, false);
    assert.equal(rules[0].reason_quote, policy.split(". ")[0] + ".");
    assert.equal(model.mock.callCount(), 1);
    const map = mapOf(...rules);
    const action = { action: "approve", record: { amount: 11000 } };
    assert.equal(checkAction(action, map).ok, true);
    assert.equal(checkAction(action, map, { includeUnconfirmed: true }).ok, false);
    assert.equal(checkAction({ ...action, record: { amount: 10000 } }, map, { includeUnconfirmed: true }).ok, true);
  } finally { delete process.env.ANTHROPIC_API_KEY; model.mock.mockImplementation(() => { throw new Error("Unexpected model request"); }); }
});

test("audit detects tampered content, sequence, malformed JSON, and null at the actual position", () => {
  const old = process.env.EXPERTAI_DATA_DIR;
  const dir = mkdtempSync(join(tmpdir(), "brain-audit-")); process.env.EXPERTAI_DATA_DIR = dir;
  try {
    const first = appendAudit("chain", { actor: "system", type: "session_start" });
    const second = appendAudit("chain", { actor: "expert", type: "expert_answer", payload: { answer: "Store credit" } });
    assert.equal(second.seq, 2); assert.equal(second.prev_hash, first.hash); assert.equal(verifyAudit("chain").ok, true);
    assert.throws(() => appendAudit("failed-write", { actor: "system", type: "screen_event", payload: { get broken() { throw new Error("bad payload"); } } }), /bad payload/);
    assert.equal(appendAudit("failed-write", { actor: "system", type: "session_start" }).seq, 1, "failed appends release the lock");
    const path = join(auditDir(), "chain.jsonl");
    const lines = readFileSync(path, "utf8").trim().split("\n");
    for (const replacement of [JSON.stringify({ ...second, payload: { answer: "Cash" } }), JSON.stringify({ ...second, seq: 99 }), "{broken", "null"]) {
      writeFileSync(path, [lines[0], replacement].join("\n") + "\n");
      const result = verifyAudit("chain"); assert.equal(result.ok, false); assert.equal(result.broken_at, 2);
    }
  } finally { if (old === undefined) delete process.env.EXPERTAI_DATA_DIR; else process.env.EXPERTAI_DATA_DIR = old; rmSync(dir, { recursive: true, force: true }); }
});

test("independent simultaneous audit writers preserve one valid chain", { timeout: 15000 }, async () => {
  const old = process.env.EXPERTAI_DATA_DIR;
  const dir = mkdtempSync(join(tmpdir(), "brain-audit-race-")); process.env.EXPERTAI_DATA_DIR = dir;
  const workers = [0, 1].map(() => fork(fileURLToPath(new URL("./audit-worker.ts", import.meta.url)), [], { execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  const exits = workers.map(w => new Promise<void>((resolve, reject) => { let error = ""; w.stderr!.on("data", b => { error += b; }); w.once("error", reject); w.once("exit", code => code === 0 ? resolve() : reject(new Error(`audit worker ${code}: ${error}`))); }));
  try {
    await Promise.all(workers.map(w => new Promise<void>(resolve => w.once("message", () => resolve()))));
    workers.forEach(w => w.send("go"));
    await Promise.all(exits);
    const result = verifyAudit("concurrent"); assert.equal(result.ok, true, `broken at ${result.broken_at}`);
    assert.equal(result.entries.length, 20); assert.deepEqual(result.entries.map(e => e.seq), Array.from({ length: 20 }, (_, i) => i + 1));
  } finally { workers.forEach(w => w.kill()); await Promise.allSettled(exits); if (old === undefined) delete process.env.EXPERTAI_DATA_DIR; else process.env.EXPERTAI_DATA_DIR = old; rmSync(dir, { recursive: true, force: true }); }
});
