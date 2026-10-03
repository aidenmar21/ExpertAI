# @understudy/brain

Owner: aiden. Turns what the expert did and said into decision records, a Work Map, and tutor checks.

## `@understudy/brain` (browser-safe)
- `checkAction(a: ProposedAction, map: WorkMap): CheckResult`: tutor check before save; handoff actions (`call_manager`, `hold`, `send_to_controller`, `request_info`) always pass.
- `captureDecisions({events, transcript, piiNames?, escalateTo?}): DecisionRecord[]`: pairs each agent question with the expert's answer and the screen event it is about. Off-record lines and events in off-record windows are dropped. PII is redacted. Vague answers ("I don't know") leave `why: null`.
- `questionFor(record, kind)`, `nextQuestionKind(record)`: grounded questions in the order why, then what would change it, then when to stop. Never repeats a kind.
- `recordsToGaps`, `confirmRecords`, `correctRecord`, `workMapToAgentText(map)` (agent context text, never includes hidden_rules).
- `redact(text, names?)`, `redactRecord(rec, job)`, `score(...)`, `evalCondition`, `onRecordOnly`, `emptyWorkMap`.

## `@understudy/brain/server` (API routes only; reads ANTHROPIC_API_KEY, LLM_MODEL)
- `buildWorkMap(input): Promise<WorkMap & { records: DecisionRecord[] }>`: records -> steps, open_gaps, and rules extracted by the LLM. Each rule's `reason_quote` must be the expert's verbatim words, and its fields and actions must exist in the job's screen config. Anything else is dropped. Without an API key you still get records, steps, and gaps, but no rules.
- `confirmWorkMap(map)`: teach-back said yes.
- `loadJob(id)`, `agentSafeJob(job)`: strips hidden_rules, cases, and traps.

## Test
`npm test -w brain`: full loop on fake returns-desk data.
