# L2 vision latency benchmark

Run from this worktree root (Node 24, installed workspace dependencies):

```sh
npx tsx engine/bench/vision.ts before
# Apply the vision optimization, then:
npx tsx engine/bench/vision.ts after
npx tsx --test engine/test/*.test.ts
npx tsc --noEmit -p app
(cd app && npx eslint . --quiet)
```

`before`/`after` label the output file; they do not switch implementations. The
saved baseline was run against `a99d172`'s vision implementation before editing
it. The script loads `app/.env.local` in-process without logging keys. It makes
five sequential calls per model using the same fixture and previous state on
every run. No requests are retried or discarded from the table. Model selection
remains controlled by `VISION_MODEL`; this change does not switch production to
Haiku.

`fixtures/req2.json` is an exact copy of the supplied scratchpad request. The
script supplies the previous visible record with `refund_to: "Cash"`; the image
shows `Original card`. A detection passes only for a `field_changed` event with
field `refund_to`, from `Cash`, to `Original card`. Other visible fields are
included in the previous state, with personal data redacted. The fixture is demo
data, not a real customer screen.

## Results (2026-10-03)

Latencies measure `analyzeFrame` wall time, including the Anthropic HTTP request,
JSON parsing, and normalization. p90 uses nearest rank: with five runs it is the
slowest observation. Raw runs are retained in `before.json` and `after.json`.

| Model | Before median / p90 | After median / p90 | Detection before → after |
| --- | ---: | ---: | ---: |
| claude-sonnet-5-5 | 2,136 / 2,564 ms | 1,496 / 1,703 ms | 5/5 → 5/5 |
| claude-haiku-4-5-20251001 | 3,180 / 3,955 ms | 1,220 / 1,566 ms | 5/5 → 5/5 |

Sonnet median fell 30%; Haiku median fell 62%. A separate preliminary run had
Haiku median 1,650ms, illustrating provider/network variability; the table uses
the reproducible script's saved runs, not that preliminary run.

## Changes

- A compact internal `screen_state_delta` contains only changed/new fields,
  removals, or changed warnings. The server merges it and reconstructs complete
  field events. First frames and navigation still use a full state. No public
  `VisionRequest`/`VisionResponse` or shared contract edits.
- 512 output tokens for updates (previously 1,024); first frames retain 1,024.
  Truncated, invalid, and failed responses return the previous state and no
  events. Legacy full-state/event model output remains accepted.
- Capture samples every 750ms for five seconds after input or a detected change,
  and every 1s idle. A caller-specified `intervalMs` still overrides the default.
  The proposed 1s/1.5s cadence left too little room at the observed Sonnet p90.
  Requested capture rate increased from 2 to 4fps to reduce frame delivery delay.
- A successful request triggers an immediate fresh sample, draining changes
  made during analysis. Identical analyzed frames skip API calls; resize changes
  are detected even when the sampled array length is unchanged.
- Pause/stop abort pending fetches and ignore stale results, including results
  that finish after resume. Input listeners are removed on stop.

## End-to-end budget and limits

With Sonnet's observed p90, sampling plus analysis is at most **2.453s active**
and **2.703s idle**, assuming no older request is in flight. Adding a nominal
250ms delivery interval at 4fps gives **2.703s / 2.953s** before HTTP route/audit
and panel rendering overhead. These are budgets, **not measured live
screen-change-to-panel timings**. Browser capture rates are requests, not
guarantees; network/model tails, background throttling, and changes arriving
during another request can exceed 3s. A live shared-screen test remains needed
before claiming a hard end-to-end target.

Full frames remain intentional: cropping without reliable record/view context
can hide navigation or the field label. The savings here come from shorter
output and scheduling, with full-frame thumbnails preserved. Faster polling
adds some browser work; cursor/animation changes above the existing pixel-diff
threshold can still cause unnecessary calls. Very small changes below that
threshold can still be missed. A 512-token response can truncate large forms or
large changes, safely yielding no events. Same-record state merging depends on
the model reporting removals; complete states replace old records on navigation.
As before, the response contract does not distinguish an API failure fallback
from a valid unchanged state, so capture can mark that frame analyzed until the
next pixel change.

## Verification

Ten focused tests pass: delta merge/removals, full-state replacement, legacy
payloads, failure/truncation handling, no cross-record inferred changes, adaptive
cadence, identical-frame suppression, immediate pending-change processing,
transport retry, resize detection, and pause/resume/stop races. The existing
`npx tsx engine/server.ts --check` also passes.

`npx tsc --noEmit -p app` and `(cd app && npx eslint . --quiet)` pass. On a fresh
worktree, run `(cd app && npx next typegen)` once before TypeScript to generate
Next's `PageProps`/`LayoutProps`; no app source edits are required.
