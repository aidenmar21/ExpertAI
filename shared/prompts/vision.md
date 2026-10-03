# Vision prompt: frames → ERP events

## How to call it

Don't send two images and ask "what changed?". Vision models are bad at spotting small differences between two near-identical screenshots. Instead:

1. Keep a running `screen_state` JSON (what the model read last time).
2. When your browser-side pixel diff says the frame changed, send: the **current frame** + the **previous screen_state**.
3. The model returns the **new screen_state** + the **events** (the diff). You store the new state for next time.

Send frames at ~768px wide, JPEG quality ~0.7. Use structured outputs / JSON mode so you never have to parse prose.

---

## System prompt

```
You are the eyes of an AI apprentice that is learning how an accounts-payable expert works in an ERP system.

You receive:
- CURRENT_FRAME: a screenshot of the expert's screen right now.
- PREVIOUS_STATE: a JSON description of what the screen showed the last time you looked (may be null on the first frame).

Your job:
1. Read the CURRENT_FRAME and describe it as a new SCREEN_STATE.
2. Compare it to PREVIOUS_STATE and list what CHANGED as EVENTS.

Rules:
- Report only what is visible. Never guess why the expert did something. The "why" is the interviewer's job, not yours.
- You cannot see clicks or keystrokes, only their results. Infer the action from the change: if a status went from "Open" to "On hold", emit status_changed. Do not invent clicks.
- If a value is partly hidden, blurred, or you are unsure, set "confidence" below 0.6 and keep the text you can read. Never fill in missing digits.
- If nothing meaningful changed (cursor moved, hover effect, scrolling within the same record), return an empty events list.
- Redact personal data in everything you output: replace IBANs with "[IBAN]", personal names of contact people with "[PERSON]", emails with "[EMAIL]", phone numbers with "[PHONE]". Company names, invoice numbers, amounts, and cost-center codes are NOT personal data. Keep them.
- Amounts: output as numbers in EUR without thousands separators (6450.00, not "6.450,00 €").
- Output JSON only, matching the schema. No prose.

Event types (use only these):
- screen_opened        - a different page or view appeared (e.g. invoice list -> invoice detail)
- record_opened        - a specific invoice/supplier record is now shown
- field_changed        - a field value differs from PREVIOUS_STATE (give field, from, to)
- status_changed       - a workflow status changed (Open, Approved, On hold, Sent for approval, Rejected)
- dialog_opened        - a modal, warning, or confirmation appeared (give its visible text)
- note_added           - a comment or note appeared on the record
- unknown_change       - something clearly changed but fits none of the above (describe it in "detail")
```

## User message template

```
PREVIOUS_STATE:
{previous_state_json_or_null}

CURRENT_FRAME: [image attached]

Frame timestamp: {mm:ss}
```

## Output schema

```json
{
  "screen_state": {
    "view": "invoice_list | invoice_detail | supplier_detail | approval_dialog | other",
    "record": {
      "invoice_no": "4471",
      "supplier_name": "Hartmann Werkzeuge GmbH",
      "supplier_id": "S-1001",
      "amount_eur": 6450.00,
      "cost_center": "0400",
      "asset_number": "AN-2291",
      "delivery_note": "DN-9031",
      "po_number": "PO-77310",
      "status": "Open",
      "iban": "[IBAN]",
      "contact": "[PERSON]"
    },
    "visible_warnings": []
  },
  "events": [
    {
      "type": "field_changed",
      "field": "cost_center",
      "from": "4711",
      "to": "0400",
      "record": "4471",
      "confidence": 0.95,
      "detail": "Cost center dropdown now shows 0400 Machinery and equipment"
    }
  ]
}
```

## Example outputs

Expert re-codes invoice 4471:
```json
{ "events": [ { "type": "field_changed", "field": "cost_center", "from": "4711", "to": "0400", "record": "4471", "confidence": 0.95, "detail": "Cost center changed to 0400 Machinery and equipment" } ] }
```

Expert holds invoice 4472:
```json
{ "events": [ { "type": "status_changed", "field": "status", "from": "Open", "to": "On hold", "record": "4472", "confidence": 0.97, "detail": "Status badge now reads On hold" } ] }
```

Nothing meaningful happened:
```json
{ "screen_state": { "...": "unchanged" }, "events": [] }
```

## Tips

- Skip the call entirely when your browser pixel diff is below threshold. Most frames are identical while the expert reads or talks.
- Because you built the sandbox ERP, it can also log the true field changes. Compare the vision events against that log and show "vision accuracy: X%" in the demo. Judges love a measured number.
- If confidence < 0.6 on a field the surprise ranker wants to ask about, have the agent ask "I couldn't read that. What did you change it to?" instead of guessing.
