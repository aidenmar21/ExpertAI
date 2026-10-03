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

### Teach-back and corrections (server or client)
```ts
import { confirmWorkMap } from "@understudy/brain/server";
import { correctWorkMap } from "@understudy/brain";
map = confirmWorkMap(map);                       // expert said "yes, that's right": rules now enforce
map = correctWorkMap(map, { record_id, text, t }); // expert corrected a decision (their exact words)
map = await buildWorkMap({ ..., previous: map }); // obsolete rules from that record are dropped and re-extracted, unconfirmed
map = confirmWorkMap(map);                       // after the corrected teach-back
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

### Question picker (engine)
`pickFromRecords(events, transcript, { now, maxAgeMs = 60000 }) -> QuestionPick | null`. It follows up on the latest explained decision (what would change it, then when to stop with `is_guardrail: true`), then asks why about the newest unexplained decision. It never repeats a question, never re-asks after a vague answer, and stays silent off the record. Engine filters out routine decisions.

### Agent context (voice)
`workMapToAgentText(map)` gives plain text for the tutor/interviewer: rules with the expert's quotes, decisions, and "UNKNOWN, do not guess" for unexplained ones. It never includes `hidden_rules`.

## Rule validation (every model rule)
A rule is rejected unless all of these hold:
1. It comes from a decision the expert explained (`why != null`).
2. `reason_quote` is an exact substring of that record's quotes, at least 8 characters. Evidence records which quote and its transcript `t` (`map.rule_sources[rule.id]`).
3. Every op is in the contract's `Op`, and the value fits the op (number for gt/gte/lt/lte, a non-empty list for `in`).
4. Every field is on the job's screen, and select/status values are real options. Actions are real job actions.
5. It has a checkable outcome (`must`, `must_not`, `must_not_action`, or `escalate_to`).
6. No conditions only if the expert said always, every, any, all, or never.
7. It doesn't block a decision the expert actually made on another case in the session (over-breadth check).

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

// on WorkMap (all optional):
//   records?: DecisionRecord[];
//   rule_sources?: Record<string, RuleEvidence>;
//   corrections?: Correction[];

// checkAction gains an optional 3rd arg:
// checkAction(a: ProposedAction, map: WorkMap, opts?: { job?: JobProfile; includeUnconfirmed?: boolean }): CheckResult
```
Until then these types are exported from `@understudy/brain`.

## Tests
- `npm test -w brain`: **simulated**, no model call. Covers capture, picker, validation of 13 hand-written candidates (10 must be rejected), confirmed-only enforcement, correction, Work Map without a key, scoring, and a browser bundle check.
- `npm run test:model -w brain`: **real model**. Reads `ANTHROPIC_API_KEY` from env, `.env.local`, or `app/.env.local`. Runs `buildWorkMap` on the fixture session, checks grounding, gaps, off-record, scope (an opened novel must not be blocked), tutor results, and a $100 -> $200 correction. Exits 2 if no key is found.
