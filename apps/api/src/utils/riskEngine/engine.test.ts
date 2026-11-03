import { strict as assert } from "node:assert";
import { test } from "node:test";

import { runRiskEngine } from "./index";
import { DEMO_SCENARIOS } from "../../seed/generateDemoData";
import { buildEngineData } from "../../seed/verifyScenarios";

/**
 * The engine must keep detecting every planted scenario. This test runs the
 * whole pipeline in memory, so it needs no database and no network.
 */
test("the engine detects every planted demo scenario", () => {
  const result = runRiskEngine(buildEngineData());

  assert.ok(result.cases.length > 0, "expected at least one case");
  assert.ok(result.summary.populationInvoices > 0);

  for (const scenario of DEMO_SCENARIOS) {
    const found = result.signals.some(
      (signal) => signal.ruleKey === scenario.ruleKey && signal.title.includes(scenario.match),
    );
    assert.ok(found, `${scenario.id}: ${scenario.ruleKey} for ${scenario.match} was not detected`);
  }
});

test("the engine is deterministic", () => {
  const first = runRiskEngine(buildEngineData());
  const second = runRiskEngine(buildEngineData());

  assert.equal(first.signals.length, second.signals.length);
  assert.deepEqual(
    first.cases.map((riskCase) => [riskCase.id, riskCase.riskScore, riskCase.exposureAmount]),
    second.cases.map((riskCase) => [riskCase.id, riskCase.riskScore, riskCase.exposureAmount]),
  );
});

test("scores stay inside 0..100 and cases respect the minimum score", () => {
  const result = runRiskEngine(buildEngineData());

  for (const riskCase of result.cases) {
    assert.ok(riskCase.riskScore >= 15 && riskCase.riskScore <= 100);
    assert.ok(riskCase.exposureAmount >= 0);
  }
});
