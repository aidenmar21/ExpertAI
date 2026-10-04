// Show-me guidance: deterministic, no model call. Run: npx tsx brain/test/guide.test.ts
import assert from "node:assert/strict";
import type { JobProfile, Rule, Value } from "@understudy/shared";
import { nextStep, planWalkthrough, type ExpertDemo } from "../index";
import { loadJob } from "../server";

const job = loadJob("returns-desk") as JobProfile;
const nh = (job.records as { new_hire: Record<string, Value>[] }).new_hire;
const moment = { t: 0 };
const rule = (id: string, r: Partial<Rule>): Rule => ({
  id, text: id, type: "guardrail", when: [], then: {}, reason_quote: "", screen_moment: moment,
  source: "live_question", confirmed: true, ...r,
});
const map = {
  job_id: "returns-desk", expert: "Aarav", steps: [], open_gaps: [],
  rules: [
    rule("no-receipt", { text: "No receipt: store credit only", when: [{ field: "receipt_no", op: "missing" }], then: { must: { refund_method: "Store credit" } } }),
    rule("over-100", { text: "Refunds over $100 need a manager", when: [{ field: "price", op: "gt", value: 100 }, { field: "receipt_no", op: "present" }], then: { escalate_to: "Shift manager" } }),
  ],
};

// No receipt -> the store-credit button, because a rule requires it.
const noReceipt = nextStep({ record: nh[2], map, job })!;
assert.deepEqual(noReceipt.target, { kind: "action", key: "store_credit" });
assert.equal(noReceipt.rule_id, "no-receipt");

// $142 with a receipt -> hand it to the manager.
const big = nextStep({ record: nh[0], map, job })!;
assert.deepEqual(big.target, { kind: "action", key: "call_manager" });
assert.match(big.say, /Shift manager/);

// A plain $54 return -> no rule, so follow the expert's demo on a similar record.
const demo: ExpertDemo = {
  record: { ...nh[1], receipt_no: "R-1", price: 30, condition: null },
  steps: [{ kind: "field", key: "condition", t: 1 }, { kind: "action", key: "refund", t: 2 }],
  action: "refund",
};
assert.deepEqual(nextStep({ record: { ...nh[1], condition: null }, map, job, demos: [demo] })!.target, { kind: "field", key: "condition" }, "expert checked condition first");
const plain = nextStep({ record: nh[1], map, job, demos: [demo], touched: ["condition"] })!;
// Expert typed in a field: shown with their keystrokes until the new hire has been there.
const typed: ExpertDemo = { ...demo, steps: [{ kind: "field", key: "item", t: 1, keys: ["a", "b"], value: "x" }, demo.steps[1]] };
const show = nextStep({ record: nh[1], map, job, demos: [typed] })!;
assert.deepEqual([show.target.key, show.keys], ["item", ["a", "b"]]);
assert.equal(nextStep({ record: nh[1], map, job, demos: [typed], touched: ["item"] })!.target.key, "refund");
assert.deepEqual(plain.target, { kind: "action", key: "refund" });
assert.equal(plain.source, "expert_demo");

// Closed records need no guidance; no map still gives a safe default.
assert.equal(nextStep({ record: { ...nh[1], status: "Refunded" }, map, job }), null);
assert.ok(nextStep({ record: nh[1], map: null, job }));
// Blank form + the customer's slip: key in the slip first (in the expert's order), then decide.
const blank = Object.fromEntries(Object.keys(nh[0]).map((k) => [k, k === "status" ? "Open" : null]));
const first = nextStep({ record: blank, expected: nh[0], map, job })!;
assert.deepEqual([first.target.key, first.source, first.value], ["receipt_no", "case", "R-88201"]);
assert.deepEqual(first.keys, [..."R-88201"]);
assert.deepEqual(nextStep({ record: blank, expected: nh[0], onScreen: { ...blank, receipt_no: "R-" }, map, job })!.keys, [..."88201"], "types after the R- prefix");
const plan = planWalkthrough({ record: blank, expected: nh[0], map, job, demos: [{ ...typed, steps: [{ ...typed.steps[0], path: [[0.1, 0.1], [0.5, 0.3]] }, typed.steps[1]] }] });
assert.equal(plan[0].target.key, "item", "expert's field order first");
assert.deepEqual(plan[0].path, [[0.1, 0.1], [0.5, 0.3]], "expert's mouse path carried");
assert.deepEqual(plan.at(-1)!.target, { kind: "action", key: "call_manager" }, "$142 ends at the manager");
assert.ok(plan.some((p) => p.target.key === "purchase_date" && p.keys!.join("") === "09252026"), "dates typed as mmddyyyy");
console.log("ok guide: rule handoff, rule value, expert demo, default, slip entry, walkthrough");
