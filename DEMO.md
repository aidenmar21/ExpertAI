# ExpertAI live demo (3 minutes)

Two people. **Aarav** plays the experienced returns-desk cashier (Expert mode, laptop A). **New hire** is a teammate (New hire mode, same laptop or laptop B with the same Work Map; see checklist). One driver narrates while the other clicks.

Job: **Returns desk** (`/?job=returns-desk`). Record queue on the left of the fake app, action buttons along the bottom: **Refund**, **Store credit**, **Call manager**, **Deny**. ExpertAI panel on the right.

Rule for Aarav's lines: one rule per sentence, short, then stop talking. Silence is what opens the gate.

---

## Pre-demo checklist (T minus 10 minutes)

- [ ] `app/.env.local` has `ANTHROPIC_API_KEY`, `VISION_MODEL`, `LLM_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_INTERVIEWER_AGENT_ID`, `ELEVENLABS_TUTOR_AGENT_ID`. Interviewer and tutor agent IDs point at the current agents in the ElevenLabs dashboard.
- [ ] Dev server running on `http://localhost:3000`; `curl -s -o /dev/null -w "%{http_code}" localhost:3000/demo` prints 200.
- [ ] Chrome (not Safari): screen share and microphone allowed for localhost (lock icon > Site settings). Share **this tab** so the vision model sees the fake app.
- [ ] Chrome extension loaded (`chrome://extensions` > Developer mode > Load unpacked) and the third-party form for beat 7 open in a tab.
- [ ] Open `/demo`, click **Reset demo state**, confirm. Then reload every ExpertAI tab.
- [ ] Backup tab: in a second Chrome profile, open `/demo`, click **Seed confirmed Work Map**, wait for "Seeded for demo: 4 confirmed rules". This tab is the fallback for the new-hire part.
- [ ] Pre-create the AP job once (`/jobs/new` > Accounts payable clerk > **Create job**) so its Work Map tab is ready for beat 2:30.
- [ ] Network: venue Wi-Fi plus a phone hotspot ready. Close Slack, Zoom, notifications (Do Not Disturb on).
- [ ] Volume up, external mic close to Aarav. Browser zoom 110% so judges can read the panel.
- [ ] Tabs in order: Expert mode, New hire mode, Work Map, `/jobs`, `/jobs/new`, third-party form, `/audit`.

---

## Beat by beat

### 0:00 to 0:10 · Hook (Aarav)

> "Every store has one person who knows how returns really work. ExpertAI sits next to them, watches, and asks why. Then it teaches the next hire in their words."

Click **Start watching** in the ExpertAI panel. Share this tab. Status reads "Watching and listening".

### 0:10 to 0:30 · Test 1: it stays quiet (Aarav)

Open **R-88101** (a $24 novel, bought last week). Talk while you work:

> "Routine one. New condition, within thirty days, back to the card."

Click **Refund**.

**Point at the gate chip** under the status line: it reads **"Busy: holding questions"** while Aarav types, reads and talks, and flips to **"Quiet: ExpertAI may ask"** only after 1.5 s of silence on keyboard, voice and screen.

> "It saw that. It said nothing. A routine refund needs no explanation, and I was busy."

### 0:30 to 1:05 · Test 2: three questions, a guardrail, a comparison (Aarav)

**Question 1 (why).** Open **R-88102** (textbook with an opened access code). Set nothing, click **Deny**. Stop talking. ExpertAI asks why.

> "Opened access codes are never refundable."

**Question 2 (guardrail).** Open the no-receipt return (University hoodie). Set **Refund to** = **Store credit**. Stop. ExpertAI asks why, then asks when to stop and ask someone.

> "No receipt means store credit only."
> "If it's over a hundred dollars I call the shift manager."

**Question 3 (comparison against the industry standard).** Open **R-88104** (Priya Raman, mug, paid by card). Set **Refund to** = **Cash** (the customer asked for cash). Stop. ExpertAI compares against the standard it already knows: card purchases usually go back to the card, so is it different here?

> "No. Card payments go back to the card, never cash. Priya Raman on Mastercard ending 0932 still gets it on the card."

Switch **Refund to** back to **Original card**.

**Point at the Conversation list**: the name and card read **[NAME]** and **[CARD]**. Redaction happens before anything is stored or sent to the model (Test 5, part 1).

The **Questions** count in the panel now shows 3, one tagged **guardrail**.

### 1:05 to 1:15 · Test 5: off the record (Aarav)

Click **Go off the record**. The red pill reads **"Off the record · nothing is kept"**; the gate chip disappears.

> "Between us, the manager's PIN is on a sticky note."

Click **Back on the record**.

> "That moment is gone. Not in the transcript, not in the Work Map, not sent to any model."

(Shown later as the hatched block on the Work Map timeline.)

### 1:15 to 1:50 · Test 3: debrief and teach-back (Aarav)

Click **Finish and debrief**. The panel shows "Debrief in progress". ExpertAI asks follow-ups about what it still cannot explain. Answer each in one sentence:

- R-88101 why: > "Routine one, new and inside thirty days."
- Access code exception: > "If the code envelope is still sealed I'd take it back."
- Store credit limit: > "Store credit is fine up to fifty dollars without ID."

ExpertAI explains the rules back ("ExpertAI explains it back. Say yes to confirm, or correct it."). Aarav:

> "Yes, that's right."

Status reads **"Debrief done"**, rules show **Confirmed**.

Click the **Work Map** tab. Show: **Rules, in the expert's words** with each quote and its **Screen moment**, the line "At your company, N rules differ from the industry standard", and in the **Timeline** the hatched red **Off the record** block: "Nothing from this window was kept."

### 1:50 to 2:30 · Test 4: the new hire (teammate)

Click the **New hire** tab. Click **Start shift**. The panel reads "4 company rules enforced, … industry-standard fallbacks."

**N1, a case Aarav never showed.** Open **R-88201** (Calculus textbook, $142, receipt, card). The new hire says "Receipt, card, easy," and clicks **Refund**.

Audience sees the save **blocked** before the status changes: **"Paused before saving"**, "Aarav would stop here before "Refund"", and Aarav's own words: *"If it's over a hundred dollars I call the shift manager."* The tutor says it out loud.

Click **Show Aarav's moment**: the replay shows the exact screen moment and time from Aarav's session where he said it.

New hire clicks **Call manager**. Saved, no interruption.

**N3 (if time allows, 10 s).** Open the no-receipt Graphing calculator ($119, customer wants cash). Set **Refund to** = **Cash**, click **Refund**. Paused again, quoting *"No receipt means store credit only."*

> Narrator: "Neither case was in Aarav's session. The tutor caught both before they saved, in his words."

### 2:30 to 3:00 · Platform in 30 seconds (narrator)

1. **`/jobs`**: "Every job, its coverage, and the open gaps that need an expert."
2. **New job** (`/jobs/new`): pick role **Accounts payable clerk**. "ExpertAI already knows this role's standard rules. The expert only confirms or corrects them." (Wizard text: "Pre-loaded roles come with standard rules the expert confirms or corrects.") To show the rules themselves, use a pre-created AP job and open its **Work Map** tab: the **Industry standard · confirm or override** section is already filled.
3. **Float over my app** (top of the ExpertAI panel): "The panel floats over any app, not just ours."
4. **Chrome extension**: in the third-party form tab, enter a value that breaks a confirmed rule and click its save button. "Same check, paused before save, on a site we did not build."
5. **Audit log** (`/audit`): "Every question, answer, rule, and model call, hash-chained." Point at **Chain intact · N entries**.
6. **Stuck detector**: back on New hire, point at the stuck score. "When someone hesitates, a small neural network that learns from your feedback decides when to offer help. **Helpful** / **Not helpful** trains it. The rules themselves always come from the expert."

> Close: "One expert, one afternoon, and every new hire gets their judgment. Thank you."

---

## Fallbacks

| If | Say | Do |
|---|---|---|
| Voice is slow to answer (more than 3 s) | "It waits for a real pause; it never interrupts." | Keep still. Point at the gate chip. If still nothing after 8 s, read the question from the Conversation list and answer it. |
| ExpertAI asks a different question than scripted | Answer it in one sentence using the closest scripted rule. | Carry on. |
| Mic or voice agent fails entirely | "Voice is down, the Work Map pipeline is the same." | Switch to the backup tab (seeded map), skip to the Work Map tab, then New hire. |
| Debrief stalls | "It has what it needs; let's confirm." | Say "Yes, that's right." If still stuck, use the backup tab. |
| Live Work Map has fewer than 3 rules | "Here's the same session, seeded earlier." | Backup tab: `/demo` > **Seed confirmed Work Map** (expert shows as "Aarav (seeded)"), then New hire. |
| N1 does not pause | "Let's try the no-receipt one." | Run N3. |
| Screen share drops | | **Stop session**, **Start watching**, re-share the tab. |
| Extension does not load | "The extension runs the same check." | Skip to the audit log. |

## Never say

- That the rules are learned by ML or a model was trained on the expert. The rules are the expert's sentences, confirmed by the expert. Only the stuck detector is a small neural network, and it decides **when** to help, not **what** the rules are.
- Anything about the answer key, hidden rules or traps. Judges see only what's on screen.

## Reset between runs

`/demo` > **Reset demo state** > confirm > reload all ExpertAI tabs. Optionally **Seed confirmed Work Map** in the backup profile.
