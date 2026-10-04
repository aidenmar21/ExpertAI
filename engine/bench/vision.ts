// Run from the worktree root: npx tsx engine/bench/vision.ts before|after
// Keys are loaded in-process and never included in logs or result files.
import { readFileSync, writeFileSync } from "node:fs";
import { analyzeFrame } from "../server";
import type { VisionRequest } from "../../shared/contracts";

async function main() {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") throw new Error("Expected before|after");
  process.loadEnvFile("app/.env.local");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  const req: VisionRequest = JSON.parse(readFileSync("engine/bench/fixtures/req2.json", "utf8"));
  req.previous_state = {
    view: "record_detail",
    record: {
      record_id: "R-88101", status: "Open", receipt_no: "R-88101", customer: "[PERSON]",
      card: "[CARD]", item: "Novel: The Lighthouse Keeper", price: 24,
      purchased: "09/28/2026", condition: "New", refund_to: "Cash",
    },
    visible_warnings: [],
  };
  const results = [];
  for (const model of ["claude-sonnet-5-5", "claude-haiku-4-5-20251001"]) {
    process.env.VISION_MODEL = model;
    const runs = [];
    for (let run = 1; run <= 5; run++) {
      const start = performance.now();
      const result = await analyzeFrame(req);
      const row = {
        run, ms: Math.round(performance.now() - start),
        detected: result.events.some((event) => event.type === "field_changed"
          && event.field === "refund_to" && event.from === "Cash" && event.to === "Original card"),
      };
      runs.push(row);
      console.log(JSON.stringify({ phase, model, ...row }));
    }
    const sorted = runs.map((r) => r.ms).sort((a, b) => a - b);
    results.push({ model, median_ms: sorted[2], p90_ms: sorted[4],
      detected: runs.filter((r) => r.detected).length, runs });
  }
  const output = { phase, measured_at: new Date().toISOString(), runs_per_model: 5,
    percentile: "nearest rank (p90 is max of 5)", results };
  writeFileSync(`engine/bench/${phase}.json`, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
  if (results.some((r) => r.detected !== 5)) process.exitCode = 1;
}

main().catch(() => { console.error("Vision benchmark failed; check fixture and credentials."); process.exitCode = 1; });
