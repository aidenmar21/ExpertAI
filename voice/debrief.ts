// Debrief plan + agent text for the debrief, teach-back, and tutor knowledge. Browser-safe.
import type { OpenGap, WorkMap } from "../shared/contracts";
import { nextQuestionKind, questionFor, workMapToAgentText, type DecisionRecord } from "@understudy/brain";

export interface DebriefQuestion {
  id: string;
  question: string;
  about_event_id?: string;
  source: "gap" | "follow_up" | "general";
  is_guardrail: boolean;
}

type MapWithRecords = WorkMap & { records?: DecisionRecord[] };

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

/**
 * The debrief questions, in order: open gaps first, then follow-ups on decisions the expert
 * already explained, then general questions. At least 3, at most 5, always one guardrail question.
 */
export function planDebrief(gaps: OpenGap[], map: MapWithRecords, escalateTo?: string): DebriefQuestion[] {
  const plan: DebriefQuestion[] = gaps.map((g) => ({
    id: g.id,
    question: g.question,
    about_event_id: g.about_event_id,
    source: "gap",
    is_guardrail: /\b(stop|ask|manager|never|escalat|controller)\b/i.test(g.question),
  }));

  // Follow-ups on explained decisions: "when would you stop" first, it's the guardrail the judges look for.
  const explained = (map.records ?? []).filter((r) => r.why !== null).reverse();
  for (const kind of ["when_to_stop", "what_would_change"] as const) {
    for (const r of explained) {
      if (plan.length >= MAX_QUESTIONS) break;
      if (r.asked.includes(kind) || nextQuestionKind(r) === null) continue;
      if (plan.some((q) => q.about_event_id === r.sources.event_ids[0] && q.source === "follow_up")) continue;
      plan.push({
        id: `fu-${r.id}-${kind}`,
        question: questionFor(r, kind),
        about_event_id: r.sources.event_ids[0],
        source: "follow_up",
        is_guardrail: kind === "when_to_stop",
      });
    }
  }

  const who = escalateTo ? `the ${escalateTo.toLowerCase()}` : "a manager";
  const general: DebriefQuestion[] = [
    { id: "gen-stop", question: `When would you stop and get ${who} instead of deciding yourself?`, source: "general", is_guardrail: true },
    { id: "gen-mistake", question: "What's the mistake a new person is most likely to make here?", source: "general", is_guardrail: false },
    { id: "gen-never", question: "Is there anything you'd never do on this screen, even if a customer pushed?", source: "general", is_guardrail: true },
  ];
  for (const g of general) {
    const needGuardrail = g.is_guardrail && !plan.some((q) => q.is_guardrail);
    if (plan.length < MIN_QUESTIONS || needGuardrail) plan.push(g);
  }
  // A guardrail question must survive the cap.
  if (plan.length > MAX_QUESTIONS) {
    const capped = plan.slice(0, MAX_QUESTIONS);
    if (!capped.some((q) => q.is_guardrail)) capped[MAX_QUESTIONS - 1] = plan.find((q) => q.is_guardrail)!;
    return capped;
  }
  return plan;
}

/** Silent context: what the agent has learned. Never includes hidden_rules (brain never has them here). */
export function formatWorkMapContext(map: MapWithRecords): string {
  return `[WORK MAP]\n${workMapToAgentText(map)}`;
}

export function formatDebriefQuestion(q: DebriefQuestion, index: number, total: number): string {
  const first = index === 0 ? "Capture is over. Start the debrief now. " : "";
  return (
    `[DEBRIEF] ${first}Question ${index + 1} of ${total}. Ask only this, in your own words, in one short sentence: ` +
    `${q.question}${q.is_guardrail ? " (guardrail question)" : ""} ` +
    `If the answer is vague, ask one short follow-up. I'll send the next question.`
  );
}

export function formatTeachBack(): string {
  return (
    "[TEACH BACK] That was the last question. Now explain the whole process back in under a minute, " +
    "in plain words, step by step, including the rules and when to stop and ask. Use the work map and what they just told you. " +
    'End with "Is that right?" If they correct you, repeat the corrected part back and ask again.'
  );
}
