# ExpertAI

An AI apprentice for any desk job. An experienced worker does the job on screen; ExpertAI watches, asks by voice
why they did what they did at natural pauses, and turns the answers into a **Work Map**: rules tied to screen
moments, in the expert's own words. A new hire then does the same job with an AI tutor that catches a wrong
decision before it is saved and explains it the way the expert would.

Built for Hack-Nation's "The AI Apprentice" challenge (ElevenLabs). Spec: [PROJECT.md](PROJECT.md).

## What it does

- **Expert mode:** screen watching, voice interviewer (ElevenLabs), and **Record task**: every key, click, and
  mouse path is followed and saved as a task ExpertAI can teach.
- **New hire mode:** voice tutor, guardrails that pause a risky save, and **Guide me**: a glowing mouse shows each
  step of the case and waits while the new hire does it.
- **Any job:** each job is a profile in `shared/jobs/*.json`; the same engine runs every job, no per-job code.
- **Trust:** "off the record", redaction of personal data, and a hash-chained audit log.

## Layout

| Folder | What it is |
|---|---|
| `app/` | Next.js web app: simulated job apps, expert and new hire views, Work Map, API routes |
| `engine/` | Screen capture, vision, when-to-ask gate, question picker, stuck detector |
| `voice/` | ElevenLabs interviewer and tutor agents, context messages, debrief and teach-back |
| `brain/` | Work Map builder, rule checker, step guide, redaction, scoring, audit |
| `shared/` | Cross-part types (`contracts.ts`), job profiles, agent prompts |
| `knowledge/` | Built-in role and software knowledge |
| `extension/` | Chrome extension: ExpertAI on any web app |
| `supabase/` | Optional accounts and persistence (off by default) |

## Run it

Needs Node 20+.

```bash
npm install
cp .env.example app/.env.local   # then fill in the Anthropic and ElevenLabs keys
npm run dev
```

Open http://localhost:3000 (Expert) or http://localhost:3000/?mode=tutor (New hire). The dev server listens on
your network too, so others on the same Wi-Fi can open `http://<your-ip>:3000`.

Tests: `npm test -w brain` and `npm test -w voice`.
