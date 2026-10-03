import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentContextMessage, ScreenEvent, TranscriptLine, Value } from "../../shared/contracts";
import { deliveryFor, formatContext, useApprenticeAgent, type AgentMode, type Delivery } from "../index";
import { editableFields, profile, records, sampleMap, sampleRule } from "./samples";

type Sent = { id: number; at: number; text: string; delivery: Delivery; outcome: "sent" | "queued" | "dropped" | "held" };
type Entry = { at: number; sent?: Sent; line?: TranscriptLine };

const PHASES = ["idle", "asking", "teach_back", "confirmed"] as const;
const PHASE_LABEL: Record<(typeof PHASES)[number], string> = {
  idle: "Not started",
  asking: "Asking gaps",
  teach_back: "Teach-back",
  confirmed: "Confirmed",
};
const OUTCOME_LABEL: Record<Sent["outcome"], string> = {
  sent: "",
  queued: "Queued until connected",
  dropped: "Not sent: agent not connected",
  held: "Held back: off the record",
};

let seq = 0;

export function App() {
  const [mode, setMode] = useState<AgentMode>("interviewer");
  const [expert, setExpert] = useState("Aarav");
  const [agentId, setAgentId] = useState("");
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [recordIx, setRecordIx] = useState(0);
  const [record, setRecord] = useState<Record<string, Value>>(records[0]);
  const [question, setQuestion] = useState("Why did you send that one back to the original card?");
  const [guardrailQ, setGuardrailQ] = useState(false);
  const [hint, setHint] = useState("deciding between Refund and Call manager on a $129 return");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const sessionStart = useRef(Date.now());

  const agent = useApprenticeAgent(mode, {
    expert,
    agentId: agentId.trim() || undefined,
    now: () => Date.now() - sessionStart.current,
  });

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

  function send(m: AgentContextMessage) {
    const delivery = deliveryFor(m);
    const outcome: Sent["outcome"] =
      m.kind === "screen_event" && agent.offRecord ? "held" : connected ? "sent" : delivery === "context" ? "queued" : "dropped";
    setSent((s) => [...s, { id: ++seq, at: Date.now() - sessionStart.current, text: formatContext(m, { expert }), delivery, outcome }]);
    agent.sendContext(m);
  }

  function screenEvent(e: Omit<ScreenEvent, "id" | "t" | "confidence" | "record">) {
    send({
      kind: "screen_event",
      event: { id: `ev-${++seq}`, t: Date.now() - sessionStart.current, confidence: 1, record: String(record.receipt_no), ...e },
    });
  }

  function changeField(key: string, label: string, to: Value) {
    const from = record[key] ?? null;
    if (from === to) return;
    setRecord((r) => ({ ...r, [key]: to }));
    screenEvent({ type: key === "status" ? "status_changed" : "field_changed", field: key, from, to, detail: `${label} changed` });
  }

  function runAction(key: string) {
    const action = profile.screen.actions.find((a) => a.key === key)!;
    for (const [field, to] of Object.entries(action.sets)) {
      const label = editableFields.find((f) => f.key === field)?.label ?? field;
      changeField(field, label, to);
    }
  }

  function openNextRecord() {
    const ix = (recordIx + 1) % records.length;
    setRecordIx(ix);
    setRecord(records[ix]);
    send({
      kind: "screen_event",
      event: {
        id: `ev-${++seq}`,
        t: Date.now() - sessionStart.current,
        type: "record_opened",
        record: String(records[ix].receipt_no),
        confidence: 1,
        detail: `${profile.screen.record_type} ${records[ix].receipt_no} opened: ${records[ix].item}, $${records[ix].price}`,
      },
    });
  }

  function startSession() {
    sessionStart.current = Date.now();
    agent.reset();
    setSent([]);
    agent.start();
  }

  const timeline = useMemo<Entry[]>(() => {
    const items: Entry[] = [...sent.map((s) => ({ at: s.at, sent: s })), ...agent.transcript.map((l) => ({ at: l.t, line: l }))];
    return items.sort((a, b) => a.at - b.at);
  }, [sent, agent.transcript]);

  const feedRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    feedRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [timeline.length]);

  const requiredEnv = ["ELEVENLABS_API_KEY", mode === "tutor" ? "ELEVENLABS_TUTOR_AGENT_ID" : "ELEVENLABS_INTERVIEWER_AGENT_ID"];
  const neededEnv = health && !agentId.trim() ? requiredEnv.filter((k) => !health[k]) : [];
  const gateOpen = !speech.isSpeaking && speech.msSinceSpeech >= 1500;
  const phaseIx = PHASES.indexOf(agent.debrief);

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Voice test bench</h1>
          <p className="lede">Talk to the {mode} agent, change the record, and see exactly what the agent is told.</p>
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
            <span>Expert name</span>
            <input value={expert} onChange={(e) => setExpert(e.target.value)} />
          </label>
          <label className="field">
            <span>Public agent ID <em>optional</em></span>
            <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Uses the token route when empty" disabled={connected} />
          </label>

          {neededEnv.length > 0 && (
            <p className="notice">
              Add {neededEnv.join(" and ")} to <code>app/.env.local</code> or <code>voice/.env.local</code> and restart the bench, or paste a public agent ID.
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

          <div>
            <h3>Debrief</h3>
            <ol className="phases">
              {PHASES.map((p, i) => (
                <li key={p} className={i < phaseIx ? "done" : i === phaseIx ? "current" : ""}>{PHASE_LABEL[p]}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Screen + prompts ---------- */}
        <section className="panel work" aria-labelledby="h-screen">
          <div className="panel-head">
            <h2 id="h-screen">
              Return {String(record.receipt_no)} <small>{profile.job.name} job</small>
            </h2>
            <button className="btn ghost" onClick={openNextRecord}>Open next {profile.screen.record_type}</button>
          </div>
          <p className="hint">Each change goes to the agent as silent context. Then ask it out loud: “What did I just change?”</p>

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
          <div className="prompt">
            <label className="field grow">
              <span>Question</span>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={guardrailQ} onChange={(e) => setGuardrailQ(e.target.checked)} />
              Guardrail
            </label>
            <button
              className="btn turn"
              onClick={() => send({ kind: "ask_now", pick: { question, about_event_id: "manual", is_guardrail: guardrailQ } })}
            >
              Ask now
            </button>
          </div>
          <div className="prompt">
            <label className="field grow">
              <span>Stuck hint</span>
              <input value={hint} onChange={(e) => setHint(e.target.value)} />
            </label>
            <button className="btn turn" onClick={() => send({ kind: "stuck", hint })}>Send stuck</button>
          </div>
          <div className="row wrap">
            <button className="btn turn" onClick={() => send({ kind: "guardrail_hit", check: { ok: false, rule: sampleRule, clip_id: sampleRule.clip_id, screen_moment: sampleRule.screen_moment } })}>
              Hit guardrail
            </button>
            <button className="btn turn" onClick={() => send({ kind: "start_debrief", gaps: sampleMap.open_gaps, map: { ...sampleMap, expert } })}>
              Start debrief
            </button>
            <button className="btn turn" onClick={() => send({ kind: "off_record", on: !agent.offRecord })}>
              {agent.offRecord ? "Go back on the record" : "Go off the record"}
            </button>
          </div>
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
              {timeline.map((e, i) =>
                e.sent ? (
                  <li key={`s${e.sent.id}`} className={`sent ${e.sent.delivery} ${e.sent.outcome}`}>
                    <time>{fmt(e.at)}</time>
                    <pre>{e.sent.text}</pre>
                    {e.sent.outcome !== "sent" && <span className="outcome">{OUTCOME_LABEL[e.sent.outcome]}</span>}
                  </li>
                ) : (
                  <li key={`l${i}`} className={`line ${e.line!.speaker} ${e.line!.off_record ? "offrec" : ""}`}>
                    <time>{fmt(e.at)}</time>
                    <span className="who">{e.line!.speaker === "agent" ? "Agent" : e.line!.speaker === "expert" ? expert || "Expert" : "New hire"}</span>
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
