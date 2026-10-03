# @understudy/voice

ElevenLabs interviewer + tutor agents (`@elevenlabs/react` v1). Owned by the voice part. See PROJECT.md.

## Use it (app)

```tsx
// 1. Wrap the page (client component)
import { ApprenticeVoiceProvider, useApprenticeAgent } from "@understudy/voice";
<ApprenticeVoiceProvider><Page /></ApprenticeVoiceProvider>

// 2. In the page
const agent = useApprenticeAgent("interviewer", { expert: "Aarav", onTranscript: (line) => { /* -> buildWorkMap */ } });
agent.start();                                   // asks for mic, connects
agent.sendContext({ kind: "screen_event", event });   // every ScreenEvent from engine
agent.sendContext({ kind: "ask_now", pick });          // when gate() is open and pickQuestion() returns a pick
agent.stop();
```

```ts
// 3. Token route: app/app/api/voice/token/route.ts
export { voiceTokenRoute as GET } from "@understudy/voice/server";
```
Env (in `app/.env.local`): `ELEVENLABS_API_KEY`, `ELEVENLABS_INTERVIEWER_AGENT_ID`, `ELEVENLABS_TUTOR_AGENT_ID`.
No route yet? Make the agent public in the dashboard and pass `{ agentId: "agent_..." }` instead.

## Options

`useApprenticeAgent(mode, { expert, escalateTo, workMap, onTranscript, onTeachBackConfirmed, onReplayRequested, onNewCase, now })`
- `workMap`: sent to the agent as `[WORK MAP]` silent context on connect and whenever it changes. Pass it in tutor mode (and in interviewer mode so it doesn't re-ask known things).
- `escalateTo`: `job.escalate_to`, used in the debrief's guardrail question.
- `now`: shared session clock so `TranscriptLine.t` lines up with `ScreenEvent.t`.

## What the hook returns

| Field | Use |
|---|---|
| `status`, `isAgentSpeaking`, `error` | panel UI |
| `start()`, `stop()`, `reset()` | session control |
| `sendContext(m)` | contract 8, returns `"sent" \| "queued" \| "dropped" \| "held" \| "throttled"`. `screen_event` = silent context; the rest make the agent speak. Screen events are held while off the record, `ask_now` is dropped during the debrief, `stuck` is throttled (30s cooldown, never during a guardrail or while the agent talks) |
| `say(text)` | type instead of talking; goes to the agent and the transcript as the human |
| `transcript: VoiceTranscriptLine[]` | expert / new_hire / agent lines. `off_record: true` while off the record. Debrief lines carry `about_event_id` (proposed optional field on `TranscriptLine`) |
| `outbox` | every message sent to the agent, with outcome |
| `offRecord` | after "off the record" is said, or `sendContext({kind:"off_record",on:true})` |
| `getSpeechSignals()` | `{ isSpeaking, msSinceSpeech }` for engine `gate()` |
| `getHesitationWords()` | new-hire "um / wait / I don't know" in the last 20s, for engine `detectStuck()` |

## Debrief (interviewer)

`sendContext({ kind: "start_debrief", gaps, map })` runs the whole thing:
1. `planDebrief` picks 3 to 5 questions: open gaps first, then follow-ups on explained decisions (brain `questionFor`), then general ones. There's always at least one guardrail question.
2. It sends one `[DEBRIEF]` question at a time and allows one follow-up. It moves on once the agent acknowledges the answer and stops talking. `nextDebriefQuestion()` skips ahead.
3. Then `[TEACH BACK]`. The agent's summary ending in "Is that right?" lands in `teachBack`. When the expert says yes, `debrief` becomes `"confirmed"` and `onTeachBackConfirmed` fires; the app then calls brain `confirmWorkMap()`.

State: `debrief` (`idle -> asking -> teach_back -> confirmed`), `debriefPlan`, `debriefIndex`, `teachBack`.

## Tutor

- Before a save: brain `checkAction()`. If it isn't ok, `sendContext({ kind: "guardrail_hit", check })`. The tutor says "{expert} would stop here. Why do you think?", waits, then explains in the expert's words. `activeGuardrail` holds the check until `resolveGuardrail()`.
- `sendContext({ kind: "stuck", hint })` when engine `detectStuck()` fires (feed it `getHesitationWords()`).

## Dashboard setup

Both agents are configured from `shared/prompts/interviewer.md` and `shared/prompts/tutor.md` (strip the first `#` line). Optional client tools (blocking off) let the agent change state itself:
- `set_off_record` (boolean `on`), `confirm_teach_back`
- tutor: `replay_expert_moment` -> `onReplayRequested`, `flag_new_case` (string `summary`) -> `onNewCase`

## Dev

`npm test -w voice`, `npm run typecheck -w voice`, `npm run playground -w voice` (test bench on :5174, reads keys from `voice/.env.local`; it has a type-instead-of-talking box).
