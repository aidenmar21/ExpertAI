// Test data for the bench. Made up for testing; not the job's hidden_rules answer key.
import type { JobProfile, Rule, Value, WorkMap } from "../../shared/contracts";
import job from "../../shared/jobs/returns-desk.json";

export const profile = job as unknown as JobProfile;

/** Fields the bench lets you edit: no PII fields, so nothing personal reaches the agent. */
export const editableFields = profile.screen.fields.filter((f) => !f.pii && f.key !== "receipt_no");

export const records: Record<string, Value>[] = [
  { receipt_no: "R-88104", item: "Hardcover atlas", price: 64, purchase_date: "2026-09-21", condition: "Opened", refund_method: "Original card", status: "Open" },
  { receipt_no: "R-88131", item: "Boxed poetry set", price: 129, purchase_date: "2026-08-30", condition: "New", refund_method: "Original card", status: "Open" },
  { receipt_no: "R-88177", item: "Graphic novel", price: 22, purchase_date: "2026-10-01", condition: "Damaged", refund_method: "Original card", status: "Open" },
];

export const sampleRule: Rule = {
  id: "test-rule-1",
  text: "Refunds over $100 need the shift manager",
  type: "limit",
  when: [{ field: "price", op: "gt", value: 100 }],
  then: { must_not_action: ["refund"], escalate_to: "Shift manager" },
  reason_quote: "Anything over a hundred, I call the manager before I touch the till. That's the line.",
  screen_moment: { t: 42_000, record: "R-88131" },
  clip_id: "clip-test-1",
  source: "live_question",
  confirmed: true,
};

export const sampleMap: WorkMap = {
  job_id: profile.job.id,
  expert: "Aarav",
  steps: [
    { n: 1, title: "Open the receipt", screen_moment: { t: 2_000, record: "R-88104" }, decision: "check the purchase date is within 30 days", rule_ids: [] },
    { n: 2, title: "Check the condition", screen_moment: { t: 9_000, record: "R-88104" }, decision: "opened books still refund if undamaged", rule_ids: [] },
    { n: 3, title: "Pick the refund method", screen_moment: { t: 15_000, record: "R-88104" }, decision: "back to the original card", rule_ids: ["test-rule-1"] },
  ],
  rules: [sampleRule],
  open_gaps: [
    { id: "gap-1", question: "Why did you switch the refund to store credit on the damaged one?" },
    { id: "gap-2", question: "What do you do when there's no receipt at all?" },
  ],
};
