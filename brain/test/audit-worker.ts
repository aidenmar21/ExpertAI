import { appendAudit } from "../audit";
// Widen the read-to-write window so an unlocked implementation reliably races across processes.
process.once("message", () => {
  for (let i = 0; i < 10; i++) appendAudit("concurrent", {
    actor: "system", type: "screen_event",
    payload: { get worker() { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10); return process.pid; } },
  });
  process.disconnect!();
});
process.send!("ready");
