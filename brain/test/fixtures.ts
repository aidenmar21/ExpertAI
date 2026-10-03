// Realistic returns-desk session (fake data). Field names are vision-style labels (refund_to), as the app sends them.
import type { ScreenEvent, TranscriptLine } from "@understudy/shared";

export const ev = (id: string, t: number, record: string | undefined, field: string, from: string | number | null, to: string | number | null, type: ScreenEvent["type"] = "field_changed"): ScreenEvent =>
  ({ id, t, type, record, field, from, to, confidence: 0.9, detail: `${field} ${from} -> ${to}` });

const L = (t: number, speaker: TranscriptLine["speaker"], text: string, off_record?: boolean): TranscriptLine =>
  ({ t, speaker, text, ...(off_record ? { off_record } : {}) });

export const events: ScreenEvent[] = [
  ev("e0", 1_000, "R-88101", "status", "Open", "Refunded", "status_changed"),        // X1 routine, never asked
  ev("e1", 20_000, "R-88102", "status", "Open", "Denied", "status_changed"),         // X2 opened access code
  ev("e2", 60_000, undefined, "refund_to", null, "Store credit"),                    // X3 no receipt
  ev("e3", 100_000, "R-88104", "refund_to", "Cash", "Original card"),                // X4 customer wanted cash
  ev("e3b", 104_000, "R-88104", "status", "Open", "Refunded", "status_changed"),
  ev("e4", 145_000, "R-88104", "refund_to", "Original card", "Cash"),                // off the record
];

export const transcript: TranscriptLine[] = [
  L(23_000, "agent", "Why did you deny that one?"),
  L(25_000, "expert", "The access code was opened, so we can't resell it. Opened access codes are never refundable."),
  L(30_000, "agent", "What would make you decide differently?"),
  L(32_000, "expert", "If the code envelope is still sealed I'd take it back."),
  L(63_000, "agent", "Why store credit there?"),
  L(65_000, "expert", "No receipt means store credit only, and Jordan Ellis knows that."),
  L(70_000, "agent", "Is there a point where you'd stop and ask someone instead?"),
  L(72_000, "expert", "If it's over a hundred dollars I call the shift manager before I give anything back."),
  L(103_000, "agent", "Why the card and not cash?"),
  L(105_000, "expert", "I don't know"),
  L(141_000, "expert", "Off the record, for regulars I refund cash on card purchases anyway.", true),
  L(150_000, "agent", "Why cash for this one?", true),
  L(151_000, "expert", "Regulars always get cash, the manager never checks. Visa ending 4417 is my cousin.", true),
  L(160_000, "expert", "Okay, back on the record."),
];

// Words that must never reach records, rules, or agent text (off-record content).
export const OFF_RECORD_MARKERS = /regulars|cousin|never checks|4417/i;

// The expert corrects the X3 limit during the debrief.
export const CORRECTION_TEXT = "Actually the shift manager limit is two hundred dollars, not a hundred. No receipt still means store credit only.";

// Debrief + teach-back after the session (minutes later). The correction is SPOKEN, not passed via correctWorkMap.
export const debrief: TranscriptLine[] = [
  L(400_000, "agent", "Why did you change status from Open to Refunded on R-88101?"),
  L(402_000, "expert", "Routine one, it was new and well inside thirty days."),
  L(420_000, "agent", "Here's what I learned: opened access codes can't be refunded, no receipt means store credit only, and over a hundred dollars you call the shift manager. Is that right?"),
  L(425_000, "expert", "Almost. The shift manager limit is two hundred dollars, not a hundred."),
  L(440_000, "agent", "Got it: over two hundred dollars you call the shift manager. Is that right?"),
  L(442_000, "expert", "Yes, that's right."),
];
