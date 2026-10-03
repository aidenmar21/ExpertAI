import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, ScreenEvent, Value } from "../../shared/contracts";
import { checkAction } from "@understudy/brain";
import { useApprenticeAgent, type AgentMode, type OutboxEntry, type VoiceTranscriptLine } from "../index";
import { editableFields, profile, records, sampleMap } from "./samples";

type Entry = { at: number; sent?: OutboxEntry; line?: VoiceTranscriptLine; key: string };

const PHASES = ["idle", "asking", "teach_back", "confirmed"] as const;
const PHASE_LABEL: Record<(typeof PHASES)[number], string> = {
  idle: "Not started",
  asking: "Asking",
  teach_back: "Teach-back",
  confirmed: "Confirmed",
};
const OUTCOME_LABEL: Record<OutboxEntry["outcome"], string> = {
  sent: "",
  queued: "Queued",
  dropped: "Not sent",
  held: "Held back",
  throttled: "Skipped",
};

let seq = 0;

export function App() {
  const [mode, setMode] = useState<AgentMode>("interviewer");
  const [expert, setExpert] = useState("Aarav");
  const [agentId, setAgentId] = useState("");
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [recordIx, setRecordIx] = useState(0);
  const [record, setRecord] = useState<Record<string, Value>>(records[0]);
  const [question, setQuestion] = useState("Why did you send that one back to the original card?");
  const [guardrailQ, setGuardrailQ] = useState(false);
  const [hint, setHint] = useState("deciding between Refund and Call manager on a $129 return");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [notes, setNotes] = useState<string[]>([]);
  const [typedLine, setTypedLine] = useState("");
  const sessionStart = useRef(Date.now());

  const map = useMemo(() => ({ ...sampleMap, expert }), [expert]);

  const agent = useApprenticeAgent(mode, {
    expert,
    escalateTo: profile.job.escalate_to,
    workMap: mode === "tutor" ? map : null,
    agentId: agentId.trim() || undefined,
    now: () => Date.now() - sessionStart.current,
    onTeachBackConfirmed: () => note("Teach-back confirmed. The app would now call confirmWorkMap()."),
    onReplayRequested: (c) => note(c ? `Replay requested: ${expert}'s moment on ${c.screen_moment?.record ?? "the record"}.` : "Replay requested, but no guardrail is active."),
    onNewCase: (s) => note(`New case flagged: ${s}`),
  });

  function note(text: string) {
    setNotes((n) => [...n.slice(-3), text]);
  }

  useEffect(() => {
    fetch("/api/voice/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Live speech readout for engine's gate().
  const [speech, setSpeech] = useState({ isSpeaking: false, msSinceSpeech: 0 });
  const [hesitations, setHesitations] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSpeech(agent.getSpeechSignals());
      setHesitations(agent.getHesitationWords());
    }, 200);
    return () => clearInterval(id);
  }, [agent.getSpeechSignals, agent.getHesitationWords]);

  const connected = agent.status === "connected";
  const send = agent.sendContext;
  const now = () => Date.now() - sessionStart.current;

  function screenEvent(e: Omit<ScreenEvent, "id" | "t" | "confidence" | "record">, rec = record) {
    send({ kind: "screen_event", event: { id: `ev-${++seq}`, t: now(), confidence: 1, record: String(rec.receipt_no), ...e } });
  }

  function changeField(key: string, label: string, to: Value) {
    const from = record[key] ?? null;
    if (from === to) return;
    setRecord((r) => ({ ...r, [key]: to }));
    screenEvent({ type: key === "status" ? "status_changed" : "field_changed", field: key, from, to, detail: `${label} changed` });
  }

  function applyAction(key: string) {
    const action = profile.screen.actions.find((a) => a.key === key)!;
    for (const [field, to] of Object.entries(action.sets)) {
      const label = editableFields.find((f) => f.key === field)?.label ?? field;
      changeField(field, label, to);
    }
  }

  // Tutor mode: brain checks the action before it saves. Not ok = block + tell the tutor.
  function runAction(key: string) {
    if (mode === "tutor") {
      const check: CheckResult = checkAction({ action: key, record }, map);
      if (!check.ok) {
        send({ kind: "guardrail_hit", check });
        return;
      }
      if (agent.activeGuardrail) agent.resolveGuardrail();
    }
    applyAction(key);
  }

  function openNextRecord() {
    const ix = (recordIx + 1) % records.length;
    const next = records[ix];
    setRecordIx(ix);
    setRecord(next);
    if (agent.activeGuardrail) agent.resolveGuardrail();
    screenEvent(
      { type: "record_opened", detail: `${profile.screen.record_type} ${next.receipt_no} opened: ${next.item}, $${next.price}` },
      next,
    );
  }

  function startSession() {
    sessionStart.current = Date.now();
    agent.reset();
    setNotes([]);
    agent.start();
  }

  const timeline = useMemo<Entry[]>(() => {
    const items: Entry[] = [
      ...agent.outbox.map((s) => ({ at: s.t, sent: s, key: `s${s.id}` })),
      ...agent.transcript.map((l, i) => ({ at: l.t, line: l, key: `l${i}` })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [agent.outbox, agent.transcript]);

  const feedRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    feedRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [timeline.length]);

  const requiredEnv = ["ELEVENLABS_API_KEY", mode === "tutor" ? "ELEVENLABS_TUTOR_AGENT_ID" : "ELEVENLABS_INTERVIEWER_AGENT_ID"];
  const neededEnv = health && !agentId.trim() ? requiredEnv.filter((k) => !health[k]) : [];
  const gateOpen = !speech.isSpeaking && speech.msSinceSpeech >= 1500;
  const phaseIx = PHASES.indexOf(agent.debrief);
  const guard = agent.activeGuardrail;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Voice test bench</h1>
          <p className="lede">
            {mode === "interviewer"
              ? "Work the record while the interviewer watches, then run the debrief and teach-back."
              : "Work the record as a new hire. Saves are checked against the Work Map before they go through."}
          </p>
        </div>
        <label className="theme">
          <span className="sr-only">Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>

      <main className="grid">
        {/* ---------- Session ---------- */}
        <section className="panel session" aria-labelledby="h-session">
          <h2 id="h-session">Session</h2>

          <div className="segmented" role="radiogroup" aria-label="Agent">
            {(["interviewer", "tutor"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} disabled={connected} onClick={() => setMode(m)}>
                {m === "interviewer" ? "Interviewer" : "Tutor"}
              </button>
            ))}
          </div>

          <label className="field">
            <span>{mode === "interviewer" ? "Expert name" : "Expert who taught the tutor"}</span>
            <input value={expert} onChange={(e) => setExpert(e.target.value)} />
          </label>
          <label className="field">
            <span>Public agent ID <em>optional</em></span>
            <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Uses the token route when empty" disabled={connected} />
          </label>

          {neededEnv.length > 0 && (
            <p className="notice">
              Add {neededEnv.join(" and ")} to <code>voice/.env.local</code> and restart the bench, or paste a public agent ID.
            </p>
          )}

          <div className="row">
            {connected || agent.status === "connecting" ? (
              <button className="btn danger" onClick={agent.stop}>End session</button>
            ) : (
              <button className="btn primary" onClick={startSession}>Start session</button>
            )}
            <button className="btn" onClick={() => agent.setMuted(!agent.isMuted)} disabled={!connected} aria-pressed={agent.isMuted}>
              {agent.isMuted ? "Unmute mic" : "Mute mic"}
            </button>
          </div>
          {agent.error && <p className="notice error" role="alert">{agent.error}</p>}

          <form
            className="say"
            onSubmit={(e) => {
              e.preventDefault();
              if (agent.say(typedLine)) setTypedLine("");
            }}
          >
            <label className="field grow">
              <span>Type instead of talking</span>
              <input value={typedLine} onChange={(e) => setTypedLine(e.target.value)} disabled={!connected} placeholder={connected ? "What did I just change?" : "Start a session first"} />
            </label>
            <button className="btn" type="submit" disabled={!connected || !typedLine.trim()}>Say</button>
          </form>

          <dl className="readout">
            <div>
              <dt>Connection</dt>
              <dd><span className={`dot ${agent.status}`} aria-hidden />{agent.status}</dd>
            </div>
            <div>
              <dt>Voice</dt>
              <dd className="voice">
                <span className={`pulse ${speech.isSpeaking ? "on" : ""} ${agent.isAgentSpeaking ? "agent" : ""}`} aria-hidden />
                {!connected ? "—" : agent.isAgentSpeaking ? "Agent speaking" : speech.isSpeaking ? "You're speaking" : `Quiet ${(speech.msSinceSpeech / 1000).toFixed(1)}s`}
              </dd>
            </div>
            <div>
              <dt>Gate, speech only</dt>
              <dd>{connected ? (gateOpen ? "Open" : "Closed") : "—"}</dd>
            </div>
            <div>
              <dt>Record</dt>
              <dd>{agent.offRecord ? <strong className="off">Off the record</strong> : "On the record"}</dd>
            </div>
            {mode === "tutor" && (
              <div>
                <dt>Hesitations, last 20s</dt>
                <dd>{hesitations}</dd>
              </div>
            )}
          </dl>

          {mode === "interviewer" && (
            <div className="debrief">
              <h3>Debrief</h3>
              <ol className="phases">
                {PHASES.map((p, i) => (
                  <li key={p} className={i < phaseIx ? "done" : i === phaseIx ? "current" : ""}>{PHASE_LABEL[p]}</li>
                ))}
              </ol>
              {agent.debriefPlan.length > 0 && (
                <ol className="plan">
                  {agent.debriefPlan.map((q, i) => (
                    <li key={q.id} className={i < agent.debriefIndex ? "done" : i === agent.debriefIndex ? "current" : ""}>
                      {q.question}
                      {q.is_guardrail && <span className="tag">Guardrail</span>}
                    </li>
                  ))}
                  <li className={agent.debriefIndex >= agent.debriefPlan.length ? "current" : ""}>Teach-back</li>
                </ol>
              )}
              {agent.debrief === "asking" && (
                <button className="btn ghost" onClick={agent.nextDebriefQuestion}>
                  {agent.debriefIndex >= agent.debriefPlan.length - 1 ? "Skip to teach-back" : "Skip to next question"}
                </button>
              )}
              {agent.teachBack && (
                <blockquote className={`teachback ${agent.debrief === "confirmed" ? "ok" : ""}`}>
                  {agent.teachBack}
                </blockquote>
              )}
            </div>
          )}
        </section>

        {/* ---------- Screen + prompts ---------- */}
        <section className="panel work" aria-labelledby="h-screen">
          <div className="panel-head">
            <h2 id="h-screen">
              Return {String(record.receipt_no)} <small>{profile.job.name} job</small>
            </h2>
            <button className="btn ghost" onClick={openNextRecord}>Open next {profile.screen.record_type}</button>
          </div>
          <p className="hint">
            {mode === "interviewer"
              ? "Each change goes to the agent as silent context. Ask it out loud: “What did I just change?”"
              : "Try Refund on R-88131 ($129). The tutor should stop you and explain in the expert's words."}
          </p>

          {guard && (
            <div className="blocked" role="alert">
              <p className="blocked-title">Save paused: {guard.rule?.text ?? "this breaks a rule"}</p>
              {guard.rule?.reason_quote && <p className="quote">“{guard.rule.reason_quote}” <span>— {expert}</span></p>}
              <div className="row wrap">
                <button className="btn" onClick={() => note(`Replay requested: ${expert}'s moment on ${guard.screen_moment?.record ?? "the record"}.`)}>
                  Replay {expert}'s moment
                </button>
                <button className="btn ghost" onClick={agent.resolveGuardrail}>Dismiss</button>
              </div>
            </div>
          )}

          <div className="record">
            {editableFields.map((f) => (
              <label key={f.key} className="field">
                <span>{f.label}</span>
                {f.options ? (
                  <select value={String(record[f.key] ?? "")} onChange={(e) => changeField(f.key, f.label, e.target.value)}>
                    {f.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    defaultValue={String(record[f.key] ?? "")}
                    key={`${record.receipt_no}-${f.key}`}
                    inputMode={f.type === "money" ? "decimal" : undefined}
                    onBlur={(e) => {
                      const v = e.target.value;
                      changeField(f.key, f.label, f.type === "money" && v !== "" ? Number(v) : v);
                    }}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="row wrap">
            {profile.screen.actions.map((a) => (
              <button key={a.key} className="btn" onClick={() => runAction(a.key)}>{a.label}</button>
            ))}
          </div>

          <h3>Make the agent speak</h3>
          {mode === "interviewer" ? (
            <>
              <div className="prompt">
                <label className="field grow">
                  <span>Question</span>
                  <input value={question} onChange={(e) => setQuestion(e.target.value)} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={guardrailQ} onChange={(e) => setGuardrailQ(e.target.checked)} />
                  Guardrail
                </label>
                <button className="btn turn" onClick={() => send({ kind: "ask_now", pick: { question, about_event_id: "manual", is_guardrail: guardrailQ } })}>
                  Ask now
                </button>
              </div>
              <div className="row wrap">
                <button className="btn turn" onClick={() => send({ kind: "start_debrief", gaps: map.open_gaps, map })}>
                  Start debrief
                </button>
                <button className="btn turn" onClick={() => send({ kind: "off_record", on: !agent.offRecord })}>
                  {agent.offRecord ? "Go back on the record" : "Go off the record"}
                </button>
              </div>
            </>
          ) : (
            <div className="prompt">
              <label className="field grow">
                <span>Stuck hint</span>
                <input value={hint} onChange={(e) => setHint(e.target.value)} />
              </label>
              <button className="btn turn" onClick={() => send({ kind: "stuck", hint })}>Send stuck</button>
            </div>
          )}

          {(notes.length > 0 || agent.newCases.length > 0) && (
            <ul className="notes" aria-live="polite">
              {notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </section>

        {/* ---------- Timeline ---------- */}
        <section className="panel feed" aria-labelledby="h-feed">
          <div className="panel-head">
            <h2 id="h-feed">Timeline</h2>
            <div className="legend" aria-hidden>
              <span className="k context">Silent context</span>
              <span className="k turn">Makes agent speak</span>
            </div>
          </div>
          {timeline.length === 0 ? (
            <p className="empty">Start a session, then change a field. Every message appears here exactly as the agent receives it, next to what was said.</p>
          ) : (
            <ol className="timeline" ref={feedRef} aria-live="polite">
              {timeline.map((e) =>
                e.sent ? (
                  <li key={e.key} className={`sent ${e.sent.delivery} ${e.sent.outcome}`}>
                    <time>{fmt(e.at)}</time>
                    <pre>{e.sent.text}</pre>
                    {e.sent.outcome !== "sent" && (
                      <span className="outcome">{OUTCOME_LABEL[e.sent.outcome]}{e.sent.reason ? `: ${e.sent.reason}` : ""}</span>
                    )}
                  </li>
                ) : (
                  <li key={e.key} className={`line ${e.line!.speaker} ${e.line!.off_record ? "offrec" : ""}`}>
                    <time>{fmt(e.at)}</time>
                    <span className="who">
                      {e.line!.speaker === "agent" ? "Agent" : e.line!.speaker === "expert" ? expert || "Expert" : "New hire"}
                      {e.line!.about_event_id && <span className="about"> about {e.line!.about_event_id}</span>}
                    </span>
                    <p>{e.line!.text}</p>
                    {e.line!.off_record && <span className="outcome">Off the record</span>}
                  </li>
                ),
              )}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
