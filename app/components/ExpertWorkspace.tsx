"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { planWalkthrough, type ExpertDemo, type GuideStep } from "@understudy/brain";
import type { JobProfile } from "@understudy/shared";
import FakeApp from "@/components/FakeApp";
import Walkthrough from "@/components/Walkthrough";
import { GuideBar, barBtn } from "@/components/GuideBar";
import type { ClientJob, JobRecord } from "@/lib/job";
import { expertDemos, recording, teachMode } from "@/lib/keytrace";
import { logAudit } from "@/lib/audit";
import { sessionT } from "@/lib/session";
import { useWorkMap } from "@/lib/workmap";

const NO_DEMOS: ExpertDemo[] = [];

/**
 * Expert side of the simulated app, with controls on top:
 * - Record task: what the expert does is saved as a task the new hire guide will teach.
 * - Follow mouse & keys: show every key, click, and mouse move and tell the voice agent, without saving.
 * - Showcase: play, on the expert's own screen, the guided mouse a new hire would get for this case.
 */
export default function ExpertWorkspace({ profile }: { profile: ClientJob }) {
  const map = useWorkMap(profile.job.id);
  const demos = useSyncExternalStore(expertDemos.subscribe, expertDemos.all, () => NO_DEMOS);
  const teaching = useSyncExternalStore(teachMode.subscribe, teachMode.get, () => true);
  const recSince = useSyncExternalStore(recording.subscribe, recording.get, () => null);
  const recSaved = useSyncExternalStore(recording.subscribe, recording.saved, () => 0);
  const [open, setOpen] = useState<{ record: JobRecord; expected: JobRecord; onScreen: JobRecord } | null>(null);
  const [walk, setWalk] = useState<GuideStep[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const onRecord = useCallback(
    (record: JobRecord, _i: number, expected: JobRecord, onScreen: JobRecord) => setOpen({ record, expected, onScreen }),
    [],
  );

  // A short "Learned: …" note each time a recorded task is saved.
  const lastCount = useRef(demos.length);
  useEffect(() => {
    const grew = demos.length > lastCount.current;
    lastCount.current = demos.length;
    if (!grew) return;
    const d = demos[demos.length - 1];
    const show = setTimeout(() => setToast(`Learned: ${d.title ?? "task"} · ${d.steps.length} steps. The new hire guide will teach it.`), 0);
    const hide = setTimeout(() => setToast(null), 3500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [demos]);

  function toggleRecording() {
    if (recSince === null) {
      recording.start(sessionT());
      logAudit("record_task_start", {}, "expert");
    } else {
      recording.stop();
      logAudit("record_task_stop", { saved: recording.saved() }, "expert");
    }
  }

  function showcase() {
    if (walk) return setWalk(null);
    if (!open) return;
    // From a blank form, the way a new hire would start this case.
    const blank = Object.fromEntries(Object.keys(open.record).map((k) => [k, k === "status" ? open.record[k] : null]));
    const idKey = profile.screen.fields[0]?.key;
    const prefix = idKey ? /^[A-Za-z]+-/.exec(String(open.expected[idKey] ?? ""))?.[0] : undefined;
    const onScreen = idKey && prefix ? { ...blank, [idKey]: prefix } : blank;
    const plan = planWalkthrough({ record: blank, expected: open.expected, onScreen, map, job: profile as unknown as JobProfile, demos });
    if (!plan.length) return;
    setWalk(plan);
    logAudit("showcase_guide", { steps: plan.length, from_expert: plan.filter((p) => p.path).length }, "expert");
  }

  const isRec = recSince !== null;
  const status = toast ? (
    <span className="font-medium text-success-ink">✓ {toast}</span>
  ) : walk ? (
    "Showing the guide a new hire gets for this case."
  ) : isRec ? (
    <span className="font-medium text-danger-ink">● Recording. Do the case start to finish; pressing its final button saves it.</span>
  ) : demos.length ? (
    `ExpertAI has learned ${demos.length} task${demos.length === 1 ? "" : "s"}. Record more, or showcase what a new hire will see.`
  ) : (
    "Press Record task, then do one case start to finish. ExpertAI learns every step and teaches it."
  );

  return (
    <div className="flex h-full min-h-[32rem] flex-col gap-3">
      <GuideBar title="Teach ExpertAI this job" status={status}>
        {!walk && !isRec && (
          <button
            type="button"
            onClick={() => teachMode.set(!teaching)}
            aria-pressed={teaching}
            title="Show every key, click, and mouse move and tell the voice agent (without saving a task)"
            className={teaching ? barBtn.quietOn : barBtn.quiet}
          >
            <span aria-hidden className={`size-2 rounded-full ${teaching ? "animate-pulse bg-sky-500" : "bg-ink-tertiary"}`} />
            {teaching ? "Following mouse & keys" : "Follow mouse & keys"}
          </button>
        )}
        {!walk && (
          <div className="relative">
            <button type="button" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen} className={barBtn.quiet}>
              📚 {demos.length} learned <span aria-hidden>{listOpen ? "▴" : "▾"}</span>
            </button>
            {listOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl bg-surface p-3 text-[13px] text-ink shadow-2xl ring-1 ring-line">
                {demos.length === 0 ? (
                  <p>
                    Nothing learned yet. Press <b>Record task</b>, do a case from start to finish, then stop.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                    {[...demos].reverse().map((d, i) => (
                      <li key={d.recorded_at ?? i} className="flex items-start justify-between gap-2 rounded-md bg-surface-subtle px-2.5 py-1.5">
                        <span className="min-w-0">
                          <span className="block font-semibold">{d.title ?? "Task"}</span>
                          <span className="text-[12px] text-ink-secondary">
                            {d.steps.length} steps{d.steps.some((s) => s.path?.length) ? " · with mouse path" : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => expertDemos.remove(d.recorded_at)}
                          aria-label={`Forget ${d.title ?? "task"}`}
                          className="shrink-0 rounded px-1.5 text-ink-tertiary hover:bg-surface-hover hover:text-ink"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {!walk && (
          <button
            type="button"
            onClick={toggleRecording}
            aria-pressed={isRec}
            title="Do the task once while recording: ExpertAI learns every step and teaches it to the new hire"
            className={isRec ? barBtn.recording : barBtn.record}
          >
            <span aria-hidden className={`size-3 ${isRec ? "animate-pulse rounded-sm bg-white" : "rounded-full bg-red-600"}`} />
            {isRec ? `Stop recording${recSaved ? ` · ${recSaved} saved` : ""}` : "Record task"}
          </button>
        )}
        <button type="button" onClick={showcase} title="Play the guided mouse a new hire would see for this case" className={barBtn.showcase}>
          {walk ? "■ Stop showcase" : "▶ Showcase the guide"}
        </button>
      </GuideBar>

      <div className="min-h-0 flex-1">
        <FakeApp
          profile={profile}
          onRecord={onRecord}
          overlay={
            <>
              {walk && <Walkthrough plan={walk} expert={map?.expert || "you"} onDone={() => setWalk(null)} />}
              {isRec && !walk && (
                <div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-md ring-4 ring-inset ring-red-500/80" />
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
