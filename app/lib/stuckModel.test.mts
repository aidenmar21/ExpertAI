// Node check for the stuck detector (tfjs CPU backend). Run from the repo root:
//   npx tsx app/lib/stuckModel.test.mts
import assert from "node:assert/strict";
import {
  createModel,
  describeMeta,
  evaluate,
  featurize,
  heuristicProbability,
  loadTf,
  predict,
  stuckAuditPayload,
  syntheticExamples,
  train,
  type StuckFeedbackSignals,
} from "./stuckModel";

const quiet: StuckFeedbackSignals = { idle_ms: 2000, back_and_forth: 0, hover_ms: 0, hesitation: 0, since_help_ms: 120_000, fields_touched: 3 };
const idle30: StuckFeedbackSignals = { ...quiet, idle_ms: 30_000 };
const hover6: StuckFeedbackSignals = { ...quiet, hover_ms: 6000 };

const tf = await loadTf();
console.log(`tfjs ${tf.version.tfjs}, backend ${tf.getBackend()}`);

// Features: scaled and clipped to [0, 2].
assert.deepEqual(featurize({ idle_ms: 60_000, back_and_forth: 5, hover_ms: 10_000, hesitation: 5, since_help_ms: 300_000, fields_touched: 10 }), [1, 1, 1, 1, 1, 1]);
assert.deepEqual(featurize({ idle_ms: 1e9, back_and_forth: -1, hover_ms: NaN, hesitation: 0, since_help_ms: 0, fields_touched: 0 }), [2, 0, 0, 0, 0, 0]);

// Heuristic labels behave as expected on the probes.
assert.ok(heuristicProbability(quiet) < 0.3, "heuristic quiet");
assert.ok(heuristicProbability(idle30) >= 0.6, "heuristic idle30");
assert.ok(heuristicProbability(hover6) >= 0.6, "heuristic hover6");

// Synthetic data: deterministic for a seed, mixed labels.
const trainSet = syntheticExamples(2000, 42);
const again = syntheticExamples(2000, 42);
assert.deepEqual(trainSet[7], again[7], "seeded generation is deterministic");
const positives = trainSet.filter((e) => e.label).length;
console.log(`synthetic 2000: ${positives} stuck / ${2000 - positives} not stuck`);
assert.ok(positives > 400 && positives < 1600, "labels are mixed");

// Train v1 and time it.
const model = await createModel();
const r = await train(model, trainSet, { epochs: 15, onEpoch: (e, loss, acc) => console.log(`  epoch ${e}: loss ${loss.toFixed(3)} acc ${acc.toFixed(3)}`) });
console.log(`train: ${r.ms} ms, final loss ${r.loss.toFixed(3)}, final acc ${r.acc.toFixed(3)}`);
assert.ok(r.ms < 5000, `training took ${r.ms} ms (> 5000)`);

// Held-out accuracy on a fresh synthetic set (labels carry 8% noise, so ~90% is the ceiling).
const heldOut = syntheticExamples(500, 7);
const acc = evaluate(model, heldOut);
console.log(`held-out accuracy (500): ${(acc * 100).toFixed(1)}%`);
assert.ok(acc > 0.8, `held-out accuracy ${acc}`);

// Probes.
const pQuiet = predict(model, quiet);
const pIdle = predict(model, idle30);
const pHover = predict(model, hover6);
console.log(`predict quiet=${pQuiet.toFixed(3)} idle30s=${pIdle.toFixed(3)} hover6s=${pHover.toFixed(3)}`);
assert.ok(pQuiet < 0.3, `quiet should be < 0.3, got ${pQuiet}`);
assert.ok(pIdle > 0.7, `idle 30s should be > 0.7, got ${pIdle}`);
assert.ok(pHover > 0.7, `hover 6s should be > 0.7, got ${pHover}`);

// predict() is cheap and leaks no tensors.
const before = tf.memory().numTensors;
const t0 = performance.now();
for (let i = 0; i < 100; i++) predict(model, quiet);
console.log(`predict x100: ${((performance.now() - t0) / 100).toFixed(3)} ms each`);
assert.equal(tf.memory().numTensors, before, "predict leaks tensors");

// Copy + audit payload.
assert.equal(describeMeta({ trained_at: "", synthetic_n: 2000, real_n: 0, epochs: 15, train_ms: 1, threshold: 0.7 }), "trained on 2,000 synthetic examples");
assert.equal(describeMeta({ trained_at: "", synthetic_n: 2000, real_n: 12, epochs: 15, train_ms: 1, threshold: 0.7 }), "stuck detector retrained on 12 real examples");
assert.deepEqual(stuckAuditPayload(hover6, 0.87654, true), {
  model: "stuck-mlp-v1",
  probability: 0.877,
  signals: { idle_ms: 2000, back_and_forth: 0, hover_ms: 6000, hesitation: 0, since_help_ms: 120000, fields_touched: 3 },
  label: true,
});

console.log("stuckModel: all checks passed");
