# Understudy setup checklist

Four people, one repo, four parts. Follow in order.

| Part | Owner | Demo role |
|---|---|---|
| app | Aarav (host) | Plays the expert cashier |
| engine | Systems engineer | Runs the demo machine |
| voice | Teammate 3 | Plays the new hire |
| brain | Teammate 4 | Plays the second expert (stretch) |

## Step 0: everyone (10 min)

- Install: git, Node 20+, Python 3, Claude Code (logged in).
- A GitHub account.
- Everyone joins the SAME phone hotspot. Venue wifi often blocks the hub, and the hub injects messages into everyone's Claude, so only run it on a network you trust.

## Step 1: host only (Aarav, 5 min)

```
unzip understudy-kit.zip && cd understudy-kit
bash setup.sh
```
Then create an empty private GitHub repo, push to it (the script prints the commands), and add your 3 teammates as collaborators.

## Step 2: keys (voice owner + host, 10 min)

- **Voice owner:** in the ElevenLabs dashboard, create two agents: "Understudy interviewer" with `shared/prompts/interviewer.md` and "Understudy tutor" with `shared/prompts/tutor.md`. Share the two agent IDs.
- **Host:** get an Anthropic API key, or use event credits if offered.
- **Everyone:** copy `.env.example` to `app/.env.local` and fill it in. Share keys by DM only, never in the repo or a public channel.

## Step 3: everyone (5 min)

```
git clone https://github.com/<host>/understudy.git && cd understudy
```
Run `npm install` from the repo root once the app owner has pushed the scaffolded Next.js app (it needs app/package.json to exist).

## Step 4: start the hub (10 min, max 20)

Host, terminal 1:
```
python3 hub.py
ipconfig getifaddr en0     # Mac. Linux: hostname -I. Windows: ipconfig
```
Each teammate tests the connection, then starts their agent:
```
curl -m 3 http://HOST-IP:8765/log      # must print JSON
HUB_URL=http://HOST-IP:8765 bin/agent <your-name>
```
Host, terminal 2: `bin/agent aarav`

Dashboard: `http://HOST-IP:8765`

**If curl fails for anyone after 20 minutes total: skip the hub.** Everyone runs plain `claude` in the repo and pastes their first prompt from below. The folders and contracts work the same without it.

## Step 5: kick off

Host types to their Claude:

> Our goal is Understudy, specced in PROJECT.md. Done = Step 1: changing a field in the fake returns app shows an event in the apprentice panel within 3 seconds, and the voice agent can describe the change out loud. Create exactly the 4 parts in PROJECT.md (app, engine, voice, brain) with their owners. Every part publishes its contract from shared/contracts.ts before writing real code, and exports typed stubs first so nobody waits. I'm claiming app.

Teammates type: `go, I want engine` / `go, I want voice` / `go, I want brain`. Then paste your role's first prompt below.

## First prompt per role

**app (Aarav)**
> Scaffold a Next.js App Router + TypeScript + Tailwind app in app/ named @understudy/app, with transpilePackages for all @understudy/* packages. Page layout: FakeApp (2/3) rendering shared/jobs/returns-desk.json from its fields and actions, config-driven, logging true changes for scoring; ApprenticePanel (1/3) with a live event feed. Add POST /api/vision calling analyzeFrame from @understudy/engine/server (use the stub until engine pushes). app/ already has a README.md; if create-next-app refuses a non-empty folder, scaffold in a temp folder and move the files in. Then run npm install from the repo root. Stop once the fake app renders so I can review it.

**engine (systems)**
> Implement engine/ per PROJECT.md and shared/contracts.ts. First commit typed stubs for gate, detectStuck, startCapture (browser) and analyzeFrame, pickQuestion (server.ts). Then build startCapture (getDisplayMedia, 1.5s sampling, ~768px, pixel diff, POST /api/vision) and analyzeFrame with shared/prompts/vision.md, validating JSON. Test analyzeFrame on a screenshot of the fake app.

**voice (teammate 3)**
> Before writing code, read the current ElevenLabs Agents React SDK docs: connection, signed URLs, client tools, and how to send context mid-conversation. Don't guess method names. Then implement voice/: useApprenticeAgent(mode: "interviewer" | "tutor") with start/stop, and sendContext(AgentContextMessage) that formats messages as text like [SCREEN], [ASK NOW], [DEBRIEF], [GUARDRAIL], [STUCK], [OFF RECORD] per shared/prompts/*.md. Commit a stub first.

**brain (teammate 4)**
> Implement brain/ per shared/contracts.ts. checkAction is deterministic: build it fully with tests against the returns-desk traps in shared/jobs/returns-desk.json. Commit stubs for buildWorkMap (server.ts), redact, and score first. Then convert shared/jobs/invoice-approval.seed.json into shared/jobs/invoice-approval.json matching the JobProfile format, and tell the other agents since that's in shared/.

## Git rhythm (prevents merge pain)

- Only edit your own folder. Changes to shared/ get announced first.
- `git pull --rebase` then `git push` every time a stub or feature works, at least every 30 minutes.
- Never commit `.env.local`.

## First hour checkpoint

- [ ] Hub running (or skipped)
- [ ] All 4 parts claimed, contracts confirmed
- [ ] Every part pushed typed stubs
- [ ] The fake returns app renders in the browser
- [ ] Both ElevenLabs agents created

Next milestone: Step 1 done (the agent describes a screen change out loud, 3 times in a row).
