LANES: ExpertAI, 5 lanes + integrator. Each lane works on its own branch, owns its folders, and claims files with `sl session lock` before editing. orch-01-opus-5.5 (Claude, integrator) reviews every lane, +1s in thread, merges to main, and pushes. Do not push to main yourself: push your branch and reply "ready: lane/<n> <commit>" under this message with evidence (command + outcome).

Base: main @ d27a8e3. Run `npm install` at the root, dev server on :3000, keys in app/.env.local (never commit or paste them). Shared contract: shared/contracts.ts. Changes to it go through orch.

L1 VOICE + CONVERSATION (Claude Code, `claude`; strength: prompting, agentic flows) branch lane/1-voice
 Owns: voice/, shared/prompts/, scripts/sync-agents.mjs
 Do: a live end-to-end voice run of DEMO.md. Make the interviewer ask comparison questions naturally and keep turns short. Make the teach-back tell the job as a story in the expert's own quotes. Make the tutor's stuck hint and guardrail explanation two sentences max. Check off-the-record phrase detection. Sync both agents' prompts.
 Done = DEMO.md beats 1-3 run live 3 times with no stuck turns. Transcript excerpts as evidence.

L2 VISION + CAPTURE SPEED (Codex; strength: precise systems code, perf) branch lane/2-vision
 Owns: engine/ (index.ts capture, server.ts analyzeFrame/discoverScreen), shared/prompts/vision.md
 Do: get end to end screen change -> panel event to <3s. Ideas: crop to the changed region from the pixel diff, send the diff bbox as a hint, shrink the max_tokens/JSON, try sampling at 1.0s when the user just typed, and stream-parse. Benchmark Sonnet 5.5 vs Haiku 4.5 again after the changes (current: Sonnet 2.3s/frame median, Haiku 3.9s; both 5/5 change detection). Keep events:[] on any failure.
 Done = benchmark table (median/p90 latency, change detection N/N) before vs after.

L3 BRAIN CORRECTNESS + TESTS (Codex; strength: review, edge cases, tests) branch lane/3-brain
 Owns: brain/ (index.ts, server.ts, validate.ts, records.ts, eval.ts, audit.ts, knowledge.ts), brain/test/, knowledge/baseline-rules.json
 Do: regression tests for tutor mode on N1-N5 (no false alarms on N2/N5), reconcileBaseline match vs override cases, deriveFields, audit hash chain (tamper detection, concurrent appends), and parsePolicy on a non-returns role. Fix what breaks. Review baseline-rules.json conditions against each role's canonical fields.
 Done = `cd brain && npm test` green with the new cases. List of bugs found and fixed.

L4 UI QA + POLISH (Cursor CLI, `cursor-agent`; strength: fast UI iteration) branch lane/4-ui
 Owns: app/components/, app/app/**/page.tsx, app/app/globals.css (NOT app/lib, NOT app/app/api)
 Do: walk every route against docs/apple-ui-guidelines.md section 44 in light + dark at 1440 and 390. Live states: recording pill, gate dot breathing, tutor pause card, stuck hint card, debrief card, DiscoveryReview, Provenance dialog, thumbnails. Fix spacing/hierarchy/contrast issues; no behavior changes.
 Done = before/after screenshots per route + list of fixes.

L5 EXTENSION + INTEGRATIONS (Claude Code subagent; strength: broad wiring) branch lane/5-extension
 Owns: extension/, app/app/api/check, app/app/api/jobs, README.md extension section
 Do: finish the Chrome MV3 extension: DOM field reading, save interception via /api/check (fail-open 800ms), side panel, "Learn this page", and a demo form. Then a 60s demo on extension/demo/returns-form.html.
 Done = loads unpacked with no errors, pauses a wrong save on the demo form, lets a right one through.

INTEGRATOR (orch-01-opus-5.5, Claude Opus): reviews each lane's diff, runs typecheck + lint + brain tests + route smoke tests, +1 or requests changes in thread, merges in order L3 -> L2 -> L1 -> L5 -> L4 (UI last so it styles the final markup), pushes main, posts the merged commit here.
