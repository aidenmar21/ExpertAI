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

## What the hook returns

| Field | Use |
|---|---|
| `status`, `isAgentSpeaking`, `error` | panel UI |
| `start()`, `stop()`, `reset()` | session control |
| `sendContext(m: AgentContextMessage)` | contract 8. `screen_event` = silent context (`sendContextualUpdate`); `ask_now`, `start_debrief`, `guardrail_hit`, `stuck`, `off_record` = agent speaks (`sendUserMessage`) |
| `transcript: TranscriptLine[]` | expert / new_hire / agent lines; `off_record: true` while off the record |
| `offRecord` | true after the expert says "off the record" (or `sendContext({kind:"off_record",on:true})`). Screen events are not forwarded while on |
| `debrief` | `idle` -> `asking` (after `start_debrief`) -> `teach_back` (agent asked "Is that right?") -> `confirmed` (expert said yes; `onTeachBackConfirmed` fires) |
| `getSpeechSignals()` | `{ isSpeaking, msSinceSpeech }` for engine `gate()` |
| `getHesitationWords()` | new-hire "um / wait / I don't know" in the last 20s, for engine `detectStuck()` |

Message format, e.g. `[SCREEN] field_changed refund_method Card -> Cash on R-88104`. See `format.ts`.

## Dashboard setup

Create two agents from `shared/prompts/interviewer.md` and `shared/prompts/tutor.md`. Optional client tools (blocking off), for when the agent should toggle state itself:
- `set_off_record` with boolean param `on`
- `confirm_teach_back` with no params

## Dev

`npm test -w voice` (formatter tests), `npm run typecheck -w voice`.
