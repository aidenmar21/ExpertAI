# Contracts

Types live in `contracts.ts`. This file says who owns what and how parts connect. Change a contract only after asking every owner who uses it.

| # | Contract | Owner | Used by | What it is |
|---|---|---|---|---|
| 1 | `ScreenEvent`, `ScreenState` | engine | everyone | What changed on screen |
| 2 | `/api/vision`: `VisionRequest` -> `VisionResponse` | engine (logic), app (route) | engine capture loop | Frame + previous state in, new state + events out |
| 3 | `gate(GateSignals) -> GateResult` | engine | voice, app | Is it OK to talk right now? Open after 1.5s quiet on input, speech, and screen |
| 4 | `pickQuestion(recent, map, policy, transcript?) -> QuestionPick or null` | engine | voice, app | The one question worth asking, or null to stay silent. Skips a change a known rule already explains. |
| 5 | `detectStuck(StuckSignals) -> StuckResult` | engine | voice, app | Is the new hire stuck? |
| 6 | `WorkMap`, `Rule`, `buildWorkMap(...)` | brain | voice, app | The learned knowledge |
| 7 | `checkAction(ProposedAction, WorkMap) -> CheckResult` | brain | app | Runs before every save in tutor mode; not ok = block + tutor explains |
| 8 | `AgentContextMessage`, `sendContext(...)` | voice | app, engine | How anything reaches the voice agent |
| 9 | `JobProfile` (shared/jobs/*.json) | brain | app, engine | Screen fields and actions for each job |
| 10 | `Scoreboard` | brain | app | Numbers for the demo |

## Flow in capture mode

capture (engine) -> /api/vision -> ScreenEvent -> sendContext screen_event (voice) and event feed (app)
every 250ms: gate(signals) -> if open and pickQuestion() returns a pick -> sendContext ask_now (voice)
expert answers -> TranscriptLine -> buildWorkMap() (brain) -> Work Map timeline (app)

## Flow in tutor mode

new hire clicks an action -> checkAction() (brain) -> not ok -> block save (app) + sendContext guardrail_hit (voice) + replay clip (app)
detectStuck() true -> sendContext stuck (voice)

## Stubs

Until a real implementation exists, each owner exports a stub that returns valid typed data, so nobody waits.
