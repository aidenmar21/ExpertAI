# ExpertAI for Chrome

ExpertAI as a layer on any web app. The extension reads the form on the page straight from the DOM (exact values,
no screenshots, no vision calls), streams what changes to the ExpertAI web app, and pauses a risky save before it
happens using the expert's own rules and words from the Work Map.

Plain JavaScript, Manifest V3, no build step.

## Install (60 seconds)

1. Start the web app (`npm run dev` in the repo, serves http://localhost:3000).
2. Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick this `extension/` folder.
3. For the local demo page: on the ExpertAI card click **Details** → turn on **Allow access to file URLs**.
4. Click the ExpertAI toolbar icon. The side panel opens.
5. In the panel: pick a **Job**, keep **New hire** selected, and turn on **Watch this site**.

Server address lives under **Settings** in the panel (stored in `chrome.storage.local`, default `http://localhost:3000`).

## Files

| File | Job |
|---|---|
| `manifest.json` | MV3 manifest: side panel, content script, background worker |
| `content.js` | Reads fields and buttons, emits ScreenEvents, intercepts saves, draws the pause card (shadow DOM) |
| `background.js` | Service worker: relays content ↔ panel, does every fetch, keeps per-tab events in `chrome.storage.session` |
| `sidepanel.html/.css/.js` | The panel: connection, job, who is working, watch toggle, latest check, live events, Learn this page, settings |
| `demo/returns-form.html` | Fake third-party returns screen ("Harbor Lane POS") to demo against |
| `icons/` | Toolbar icons |

## What it reads

Only on sites you switch on with **Watch this site** (stored per origin; `file://` counts as one site).
The script is injected everywhere so it is ready, but it does nothing until that switch is on for the page's origin.
**Learn this page** reads the page once when you press it, even if watching is off.

- **Fields:** `input` (not hidden/submit/button/file), `select`, `textarea`, `contenteditable`, radio groups.
- **Labels**, in order: `aria-labelledby`, `aria-label`, `label[for]`, a wrapping `<label>`, `placeholder`, the nearest
  preceding text, then `name`/`id`. The field key is the label in snake_case (`Receipt no.` → `receipt_no`).
- **Buttons:** `button`, `input[type=submit|button]`, `[role=button]` with their visible text.
- **Events** (ScreenEvent shape from `shared/contracts.ts`, `confidence: 1`) on `change` and blur:
  `screen_opened` when watching starts, `record_opened` when a receipt/order/invoice/case/ticket number appears,
  `status_changed` for status/state/stage fields, `field_changed` for everything else. Money-like fields
  (price, amount, total…) and number inputs are sent as numbers.

## Privacy

- **Redaction happens in the page, before anything leaves it.** Password inputs, `autocomplete` of
  `cc-number`/`cc-csc`/`cc-exp`/`current-password`/`new-password`/`one-time-code`, and any field whose label, name or id looks like
  a card number, CVV/CVC, security code, SSN, password, passcode, PIN, routing number, account number or IBAN are sent
  as `"[REDACTED]"` (or `null` when empty). Change detection on those fields uses a local fingerprint that is never sent.
- Only the web app server you configure receives data. No third parties, no analytics.
- Events go to `POST {server}/api/audit` as `type: "screen_event"` with header `x-expertai-session: s_<yyyymmdd>_<6 random>`
  (one id per browser session, same format as the web app), so they land in the same tamper-evident audit log.
  Pauses and "Save anyway" are logged as `tutor_intervention`.
- **Fail open.** If no job is selected, the server is unreachable, returns an error, or takes longer than 800 ms,
  the save goes through untouched. ExpertAI never blocks work because it is down.

## How the pause works

In **New hire** mode, clicking a submit-like button (`button[type=submit]` in a form, `input[type=submit]`, or text
matching `save|submit|approve|refund|send|confirm|post`) or submitting a form with Enter is held in the capture phase.
The extension sends a ProposedAction to the server:

```
POST {server}/api/check
{ "job_id": "<selected job>", "action": "<snake_case button text>", "record": { "<field_key>": value, ... } }
-> CheckResult  { ok, rule?, explanation?, clip_id?, screen_moment?, standard? }   (shared/contracts.ts)
```

`ok: true` → the click is replayed and the save goes through. `ok: false` → an in-page card ("Paused before saving",
the rule, the expert's quote, who it escalates to) with **Got it** (stay and fix it) and **Save anyway** (replays the
click once). In **Expert** mode nothing is paused; changes are logged as the expert teaching.

## Other endpoints used

- `GET {server}/api/jobs` → job list for the dropdown (and the connection check).
- `POST {server}/api/jobs/<id>/screen` with `{ record_type, fields, actions }` from **Learn this page**, after you review it.
- `POST {server}/api/vision` is **not** used: the DOM is exact, instant and free.

## Permissions

| Permission | Why |
|---|---|
| `sidePanel` | The ExpertAI panel |
| `storage` | Server URL, selected job, mode, watched sites; per-tab events in session storage |
| `activeTab`, `scripting` | Inject the content script into tabs that were open before the extension loaded |
| `host_permissions: http://localhost:3000/*, http://*/*` | Let the background worker call the ExpertAI server on localhost or a LAN IP. Hackathon scope: tighten to your server's origin for real use. |
| `content_scripts: <all_urls>` | Ready on any web app; dormant until you switch a site on |

## 60-second demo

Set up once: load the extension, open the web app, pick the returns job (one whose Work Map has a refund rule, for
example "Refunds over $100 go back to the original card"), and confirm the rule in the Work Map tab.

1. **(0:00)** Open `extension/demo/returns-form.html` (drag it into Chrome). Open the ExpertAI panel: **Connected**,
   job selected, **New hire**. Turn on **Watch this site**. Live events shows `screen opened`.
2. **(0:10)** Click **Look up receipt**. Live events: `record opened R-88104`, `price 149`, item, purchase date. Say:
   "No screen recording, no vision model: these are the exact values from the page."
3. **(0:20)** Type a card number. The event says `[REDACTED]`. "Card numbers and passwords never leave the page."
4. **(0:30)** Set **Refund to** = Cash and click **Refund**. The card slides in: *Paused before saving*, the rule, the
   expert's quote, "This one goes to the Shift manager." The panel's **Latest check** shows the same, with the time it took.
5. **(0:45)** Click **Got it**, switch to Original card, click **Refund**: it saves. Mention fail-open: stop the server
   and it still saves.
6. **(0:55)** Open the web app's audit log: the same session id shows every field change and the pause.

On a real public form instead: open any HTML form demo page (for example the W3Schools or MDN form examples), turn on
**Watch this site**, press **Learn this page**, untick anything irrelevant, and **Send to ExpertAI**. The fields and
buttons become the job's screen map.

## How it pairs with the Work Map

The web app learns the job (the expert works, ExpertAI asks why, rules land in the Work Map with the expert's quote).
**Learn this page** sends the real app's field keys and button actions into that same job, so the rules' conditions
(`refund_to`, `price`, action `refund`) line up with what this extension reports. From then on the extension is the
Work Map running on the real tool: every save a new hire makes is checked against the expert's confirmed rules, and
every pause points back to the moment in the Work Map where the expert explained it.

## Verify locally

```
for f in extension/*.js; do node --check "$f"; done
```

The content script was also exercised in headless Chrome over the DevTools protocol against `demo/returns-form.html`
with a stubbed `chrome.*` API: events, redaction, discovery, pause card, Got it, Save anyway, Enter-key submit, and
fail-open after the timeout.
