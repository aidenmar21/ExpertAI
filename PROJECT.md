# Understudy: an AI apprentice for any desk job

Hack-Nation 7th Global AI Hackathon, Challenge 01 "The AI Apprentice" (ElevenLabs). Team of 4. About 24 hours, so favor working over perfect.

## What we're building

An experienced worker does their normal job on screen. The AI watches, and at natural pauses asks by voice "why did you do that?". Answers become a Work Map (rules with screen moments and voice clips). Later, a new hire does the same job and the AI tutor pops up when they're about to do something wrong or seem stuck, explaining it in the expert's own words.

It's a platform: each job (returns desk, invoice approval, ...) is a job profile JSON. Same engine for every job, no per-job code.

Demo: Aarav plays an experienced bookstore cashier on the returns-desk job (deep demo). Then 30 seconds on a second job (invoice approval) to prove it's generic.

## Judges will test these five things

1. When to ask: stays quiet while the expert types, reads, or talks.
2. What to ask: questions about things the screen can't explain, at least one about a guardrail. At least 3 questions in a live session.
3. When it has understood: debrief asks 3+ follow-ups, then a teach-back the expert confirms.
4. Whether the new hire learned: tutor catches a wrong decision on a case the expert never showed, before it's saved, using the expert's reasoning.
5. Trust: "off the record" and redaction of personal data.

## Parts and owners

Each part is a top-level folder and an npm workspace package. Only edit your own folder; ask the owner for changes elsewhere. `shared/` changes need agreement from everyone affected.

| Part | Package | Owner | Owns |
|---|---|---|---|
| `app` | `@understudy/app` | Aarav | Next.js app, config-driven fake job apps, apprentice panel, Work Map timeline UI, jobs dashboard, API routes that call engine/brain server functions, demo video |
| `engine` | `@understudy/engine` | Systems engineer | Screen capture + pixel diff (browser), `analyzeFrame` vision call (server), interruptibility gate, question picker, stuck detector |
| `voice` | `@understudy/voice` | Teammate 3 | ElevenLabs interviewer + tutor agents (browser SDK), prompts, client tools, sending context, debrief + teach-back flow, "off the record" |
| `brain` | `@understudy/brain` | Teammate 4 | Work Map builder (server), rule checker, job profiles and seed data, redaction, scoreboard vs answer key, second job |
| `shared` | `@understudy/shared` | Everyone | `contracts.ts` (all cross-part types), job JSON files, prompts |

## Contracts

All cross-part types and function signatures live in `shared/contracts.ts`, explained in `shared/contracts.md`. Build against them. If you need to change one, ask every owner who depends on it first.

## Stack

- npm workspaces monorepo (root `package.json`). Only `app` runs as an app; `engine`, `voice`, `brain` are TypeScript packages imported by `app`. Next.js `transpilePackages` covers the `@understudy/*` packages.
- `app`: Next.js (App Router) + TypeScript + Tailwind.
- Server-only code (vision calls, Work Map LLM calls) lives in `engine` and `brain`, exported from a `server.ts` entry, and is only called from `app` API routes. API keys never reach the browser.
- Vision + LLM: Anthropic API (model from env `VISION_MODEL` / `LLM_MODEL`).
- Voice: ElevenLabs Agents React SDK. IMPORTANT: check the current ElevenLabs docs for package names, hooks, client tools, signed URLs, and how to send context mid-conversation. Don't guess method names.
- Storage: in-memory + IndexedDB. No database.

## Layout

```
package.json              npm workspaces: app, engine, voice, brain, shared
.env.example              copy to .env.local, never commit
shared/
  contracts.ts            all cross-part types
  contracts.md            what each contract means, who owns it
  jobs/returns-desk.json  bookstore job (hidden_rules are placeholders)
  jobs/invoice-approval.seed.json   brain converts this into a job profile
  prompts/vision.md       vision prompt (engine)
  prompts/interviewer.md  interviewer agent prompt (voice)
  prompts/tutor.md        tutor agent prompt (voice)
app/                      Next.js app (Aarav)
engine/                   src/browser.ts (capture, gate, stuck), src/server.ts (analyzeFrame, pickQuestion)
voice/                    src/index.ts (agent hooks, context sender, debrief flow)
brain/                    src/server.ts (buildWorkMap), src/index.ts (checkAction, redact, score)
```

## Hard rules

- Fake data only. No real customers, cards, store names, or employer documents.
- The agent never sees `hidden_rules` from a job file. That's the answer key for scoring.
- Ground-truth logs from the fake app measure vision accuracy only; never feed them to the agent.
- Fake apps are config-driven from the job JSON. No `if (job === "returns")` code anywhere.
- The vision prompt stays generic: records, fields, statuses, buttons.
- Every module works against stubs first. Never block on another part.

## Build order

1. **Step 1:** screen change -> event -> agent can talk about it.
2. Gate + question picker (ask only about events no known rule explains).
3. Work Map builder + debrief + teach-back.
4. Tutor: wrong-move check on save (block + play expert clip) and stuck detection.
5. Off the record, redaction, second job, jobs dashboard, scoreboard.
6. Stretch (pick one around hour 16): two experts diff, or agent-ready guardrail export.
7. Demo rehearsal and video.

## Step 1 spec, by part

- **app:** scaffold Next.js in `app/`. Page layout: fake job app (2/3) + apprentice panel (1/3). Fake app renders `shared/jobs/returns-desk.json` (fields + actions) and logs true changes for scoring. Panel shows a live event feed. API route `POST /api/vision` calls `analyzeFrame` from `@understudy/engine/server`.
- **engine:** `startCapture()` with `getDisplayMedia`, 1.5s sampling at ~768px, pixel diff, sends changed frames to `/api/vision`. `analyzeFrame()` calls the vision model with `shared/prompts/vision.md`, returns `VisionResponse`, validates JSON, returns no events on failure.
- **voice:** create the interviewer agent in the ElevenLabs dashboard from `shared/prompts/interviewer.md`. Build `useApprenticeAgent()` that connects, exposes start/stop, and sends `AgentContextMessage`s. Every screen event goes into the conversation as context.
- **brain:** `checkAction()` and `buildWorkMap()` as stubs returning valid typed data. Convert the invoice seed into `shared/jobs/invoice-approval.json` matching the returns-desk format.

Step 1 is done when: change the refund method in the fake app, ask the agent out loud "what did I just change?", and it answers correctly three times in a row.
