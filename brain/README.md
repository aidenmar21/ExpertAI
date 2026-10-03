# @understudy/brain

Owner: aiden. Turns what the expert did and said into decision records, validated rules, a Work Map, and tutor checks.

```
events + transcript ──captureDecisions──> DecisionRecords (what / how / why / exceptions / guardrails / quotes)
        │                                        │ why == null -> open gap (never guessed)
        │                                        v
        │                         model proposes rules (server only)
        │                                        v
        │              validateCandidates: exact quote, real fields/ops/actions,
        │              scoped, must not block the expert's own decisions
        │                    (rejections get one repair round)
        v                                        v
 off-record dropped                  WorkMap.rules (unconfirmed) ──teach-back──> confirmed ──> checkAction enforces
```

## Entry points

| Import | Where | Contains |
|---|---|---|
| `@understudy/brain` | browser or server | capture, picker, validation, `checkAction`, redaction, scoring. No SDK, no env, no `node:` imports (checked by `test/browser-safe.mjs`). |
| `@understudy/brain/server` | Next.js API routes only | `buildWorkMap`, `confirmWorkMap`, `loadJob`. Reads `ANTHROPIC_API_KEY` and `LLM_MODEL` (default `claude-opus-5-5`). |

## Integration (app)

### `POST /api/workmap` (server)
```ts
import { buildWorkMap, type WorkMapWithRecords } from "@understudy/brain/server";
// body: { job_id, expert, events: ScreenEvent[], transcript: TranscriptLine[], previous?: WorkMapWithRecords }
const map = await buildWorkMap({ job_id, expert, events, transcript, previous });
return Response.json(map);
```
- Send the **full** `events` and `transcript` every call, never deltas. Send back the last returned map as `previous`.
- Mark every transcript line said while off the record (expert and agent) with `off_record: true`. Brain drops those lines and every event inside that window.
- Records whose quotes did not change since `previous` keep their rules and confirmation with no model call, so rebuilding after every answer is cheap.
- Without `ANTHROPIC_API_KEY` you still get records, steps, and open gaps, but no rules. A failed model call is retried on the next build.
- `map.rejected_rules` lists model rules that failed validation, with reasons. It's for debugging; don't show it to the agent.

### Teach-back and corrections
Spoken debrief answers and teach-back corrections are picked up **automatically** from the transcript. No extra call is needed:
- A question that names the record ("...on R-88101?") links its answer at any age. Otherwise an answer must come within 60s of the question, and never across an off-record stretch.
- Expert lines no question captured are sent to the model **once** (cached in `map.links`). The model may link a line to a decision as `why`, `exception`, `guardrail`, or `correction`, but only by quoting the line verbatim. Brain validates the quote, that the line is on the record, and that the record exists.
- A `correction` is added to that decision's quotes and wins where it disagrees. A rule from an earlier quote is dropped only if a rule from the correction constrains the same field. "The limit is two hundred, not a hundred" replaces the $100 rule but keeps "no receipt means store credit only". Rules from a corrected decision need re-confirmation.

```ts
// expert said "yes, that's right" -> POST /api/workmap { ..., confirm: true }
map = confirmWorkMap(await buildWorkMap({ ..., previous: map }));   // rules now enforce
// optional, for a UI edit (not speech):
map = correctWorkMap(map, { record_id, text, t });
```
`record_id` is a `map.records[i].id`. `steps[i].screen_moment` and `open_gaps[i].about_event_id` point to it.

### Tutor check before every save (`POST /api/check` or client)
```ts
import { checkAction } from "@understudy/brain";
const res = checkAction({ action: "refund", record: currentRecordValues }, map, { job });
if (!res.ok) { blockSave(); sendContext({ kind: "guardrail_hit", check: res }); replay(res.screen_moment, res.clip_id); }
```
- Only **confirmed** rules enforce. Pass `{ includeUnconfirmed: true }` to preview.
- Pass `job` so the action's `sets` (e.g. `store_credit` sets `refund_method`) are applied before checking.
- Handoff actions (`call_manager`, `hold`, `send_to_controller`, `request_info`) always pass.
- `record` uses job field keys. `canonicalField(job, name)` maps vision labels (`refund_to`) to keys (`refund_method`).

### Scoreboard (`POST /api/score`, server only: reads the answer key)
```ts
import { scoreSession } from "@understudy/brain/server";
// body: { job_id, map /* confirmed */, groundTruth?, events?, questions? /* QuestionPick[] sent as ask_now */ }
const { scoreboard, tutor, rules } = scoreSession(body);
```
- `rules_learned`: an answer-key rule counts when the confirmed map blocks all of its `probes` (behavior, not wording).
- `tutor_catches / tutor_traps / false_alarms`: each new-hire case's `expected.wrong` must be blocked and `expected.right` allowed. Returns desk: N1, N3, N4 are traps; N2 and N5 must stay silent.
- `vision_accuracy`: ground-truth changes matched by vision events (same field after label->key mapping, same value, within 10s).
- The result holds only numbers and ids. `hidden_rules`, `probes`, and `expected` never leave the server.

### Privacy (judge test 5)
- `buildWorkMap` redacts the transcript before any step (the model never sees PII) and redacts every string of the returned map: patterns (card, IBAN, email, phone) plus the job's PII field values.
- `redactTranscriptForJob(job_id, transcript)` (server) gives the panel a transcript with off-record lines replaced by `[off the record]` and PII redacted.

### Question picker (engine)
`pickFromRecords(events, transcript, { now, maxAgeMs = 60000 }) -> QuestionPick | null`. It follows up on the latest explained decision (what would change it, then when to stop with `is_guardrail: true`), then asks why about the newest unexplained decision. It never repeats a question, never re-asks after a vague answer, and stays silent off the record. Engine filters out routine decisions.

### Agent context (voice)
`workMapToAgentText(map)` gives plain text for the tutor/interviewer: rules with the expert's quotes, decisions, and "UNKNOWN, do not guess" for unexplained ones. It never includes `hidden_rules`.

## Rule validation (every model rule)
A rule is rejected unless all of these hold:
1. It comes from a decision the expert explained (`why != null`).
2. `reason_quote` is an exact substring of that record's quotes, at least 8 characters, and stays inside one sentence. Evidence records which quote and its transcript `t` (`map.rule_sources[rule.id]`).
3. Every condition carries `evidence`: words inside its own `reason_quote` that state it. Independent sentences in one answer can't lend each other conditions (e.g. "No receipt means store credit only. If it's over a hundred dollars I call the shift manager." gives two rules, not one narrowed rule).
4. Every op is in the contract's `Op`, and the value fits the op (number for gt/gte/lt/lte, a non-empty list for `in`).
5. Every field is on the job's screen, and select/status values are real options. Actions are real job actions.
6. It has a checkable outcome (`must`, `must_not`, `must_not_action`, or `escalate_to`).
7. No conditions only if the expert said always, every, any, all, or never.
8. It doesn't block a decision the expert actually made on another case in the session (over-breadth check).

## Proposed `shared/contracts.ts` additions
Additive and optional, so no current consumer breaks. Aarav (app) agreed. Waiting on the voice owner (voice consumes WorkMap).
```ts
export type QuestionKind = "why" | "what_would_change" | "when_to_stop";

export interface DecisionRecord {
  id: string; record?: string;
  what: string; how: string | null;
  why: string | null;                 // null = not explained; never guessed
  exceptions: string[]; guardrails: string[]; escalate_to?: string;
  quotes: string[]; quote_t?: number[]; // expert's exact words (redacted) + when said
  superseded?: { why: string | null; quotes: string[]; replaced_at: number };
  sources: { event_ids: string[]; transcript_t: number[]; screen_moment: ScreenMoment; clip_id?: string };
  asked: QuestionKind[]; unknown: QuestionKind[];
  status: "unconfirmed" | "confirmed" | "corrected";
}
export interface RuleEvidence { record_id: string; quote_index: number; quote_t: number | null; event_ids: string[] }
export interface Correction { record_id: string; text: string; t: number }
export interface LineLink { line_t: number; record_id: string; kind: "why" | "exception" | "guardrail" | "correction"; text: string }

// on WorkMap (all optional):
//   records?: DecisionRecord[];
//   rule_sources?: Record<string, RuleEvidence>;
//   corrections?: Correction[];
//   links?: Record<string, LineLink | null>;

// JobField gains (already used in shared/jobs, requested by app):
//   readonly?: boolean;   // data-only field shown as a value, not an input

// checkAction gains an optional 3rd arg:
// checkAction(a: ProposedAction, map: WorkMap, opts?: { job?: JobProfile; includeUnconfirmed?: boolean }): CheckResult
```
Until then these types are exported from `@understudy/brain`.

## Tests
- `npm test -w brain`: **simulated**, no model call. Covers capture, picker, validation of 13 hand-written candidates (10 must be rejected) plus the two-sentence answer case, debrief linking, a spoken correction (with simulated model links), partial corrections, answer-key scoring for both jobs, and end-to-end redaction, confirmed-only enforcement, correction, Work Map without a key, scoring, and a browser bundle check.
- `npm run test:model -w brain`: **real model**. Reads `ANTHROPIC_API_KEY` from env, `.env.local`, or `app/.env.local`. Runs `buildWorkMap` on the fixture session, checks grounding, gaps, off-record, scope (an opened novel must not be blocked), tutor results, a $100 -> $200 correction, a two-sentence answer that must give two separate rules, a spoken debrief + teach-back correction exactly as the app sends it (the no-receipt rule must survive a limit-only correction), and the scoreboard for the result. Exits 2 if no key is found.
