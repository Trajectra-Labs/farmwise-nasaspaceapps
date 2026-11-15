import "./storagePolyfill";
import { describe, expect, it } from "vitest";
import type { FarmProfile, ScenarioInputs, SoilInput } from "@fw/contracts";
import {
  clampScenarioInputs, DEFAULT_SCENARIO_INPUTS, evaluateRotations, matchPreset, runScenario, SCENARIO_LIMITS, SCENARIO_PRESETS,
} from "..";
import type { DetailedScenarioResult, EvaluatedPlan, ScenarioContext } from "..";
import { CLIMATE, SAMPLE_FARM, SOIL, farmWith } from "./fixtures";

const ev = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
const [CURRENT, MINIMUM, RESILIENCE] = ev.plans;
const ctx = (farm: FarmProfile = SAMPLE_FARM, climate = CLIMATE as typeof CLIMATE | null, soil: SoilInput | null = SOIL.normal): ScenarioContext =>
  ({ farm, climate, soil, currentPlan: evaluateRotations(farm, climate, soil).plans[0] });
const run = (inputs: Partial<ScenarioInputs>, plan: EvaluatedPlan = CURRENT, c = ctx()) => runScenario(plan, { ...DEFAULT_SCENARIO_INPUTS, ...inputs }, c);

describe("presets, limits, helpers", () => {
  it("exports the four presets with the agreed labels", () => {
    expect(SCENARIO_PRESETS.map((p) => p.id)).toEqual(["typical", "drier", "hotter", "costlier"]);
    expect(SCENARIO_PRESETS.map((p) => p.label)).toEqual(["Typical", "Drier", "Hotter", "Higher costs"]);
    expect(SCENARIO_PRESETS[0].inputs).toEqual(DEFAULT_SCENARIO_INPUTS);
    expect(DEFAULT_SCENARIO_INPUTS).toEqual({ rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 });
  });
  it("limits match the slider spec", () => {
    expect(SCENARIO_LIMITS).toEqual({
      rainfallDeltaPct: { min: -50, max: 30, step: 5 }, temperatureDeltaC: { min: -1, max: 4, step: 0.5 },
      irrigationPct: { min: 0, max: 100, step: 10 }, inputCostDeltaPct: { min: -20, max: 60, step: 5 },
    });
  });
  it("matchPreset / clampScenarioInputs", () => {
    for (const p of SCENARIO_PRESETS) expect(matchPreset(p.inputs)).toBe(p.id);
    expect(matchPreset({ ...DEFAULT_SCENARIO_INPUTS, rainfallDeltaPct: -5 })).toBeNull();
    expect(clampScenarioInputs({ rainfallDeltaPct: -99, temperatureDeltaC: 9, irrigationPct: 37, inputCostDeltaPct: Number.NaN }))
      .toEqual({ rainfallDeltaPct: -50, temperatureDeltaC: 4, irrigationPct: 40, inputCostDeltaPct: 0 });
    expect(clampScenarioInputs({ temperatureDeltaC: 1.3 }).temperatureDeltaC).toBe(1.5);
  });
});

describe("S01 · each preset moves dependent outputs in the right direction", () => {
  const typical = run({});
  it("drier → lower water index and yield", () => {
    const r = run(SCENARIO_PRESETS[1].inputs);
    expect(r.selected.waterIndex!).toBeLessThan(typical.selected.waterIndex!);
    expect(r.selected.yieldIndex!).toBeLessThan(typical.selected.yieldIndex!);
    expect(r.waterSupplyMm!).toBeLessThan(typical.waterSupplyMm!);
  });
  it("hotter → higher water demand", () => {
    const r = run(SCENARIO_PRESETS[2].inputs);
    expect(r.waterDemandMm.selected!).toBeGreaterThan(typical.waterDemandMm.selected!);
    expect(r.selected.waterIndex!).toBeLessThanOrEqual(typical.selected.waterIndex!);
  });
  it("higher costs → higher cost, lower net", () => {
    const r = run(SCENARIO_PRESETS[3].inputs);
    expect(r.selected.estimatedCost!).toBeGreaterThan(typical.selected.estimatedCost!);
    expect(r.selected.estimatedNetReturn!).toBeLessThan(typical.selected.estimatedNetReturn!);
    expect(r.selected.estimatedRevenue).toBe(typical.selected.estimatedRevenue);
  });
});

describe("S02–S05 · individual sliders", () => {
  it("S02 rainfall: monotone non-increasing water/yield as rain falls", () => {
    let prev: DetailedScenarioResult | null = null;
    for (let r = 30; r >= -50; r -= 5) {
      const cur = run({ rainfallDeltaPct: r });
      if (prev) { expect(cur.selected.waterIndex!).toBeLessThanOrEqual(prev.selected.waterIndex!); expect(cur.selected.yieldIndex!).toBeLessThanOrEqual(prev.selected.yieldIndex!); }
      prev = cur;
    }
    expect(run({ rainfallDeltaPct: -50 }).selected.waterIndex!).toBeLessThan(run({ rainfallDeltaPct: 30 }).selected.waterIndex!);
  });
  it("S03 temperature: demand rises; heat-sensitive potato yield falls at +4 °C in a warm climate", () => {
    expect(run({ temperatureDeltaC: 4 }).waterDemandMm.selected!).toBeGreaterThan(run({ temperatureDeltaC: -1 }).waterDemandMm.selected!);
    const potatoFarm = farmWith({ rotation: [{ season: "Long rains", cropId: "irish_potato", yearOffset: 0 }], budget: null, irrigation: "regular" });
    const c = ctx(potatoFarm, { ...CLIMATE, meanTemperatureC: 19 });
    const cool = runScenario(c.currentPlan, DEFAULT_SCENARIO_INPUTS, c), hot = runScenario(c.currentPlan, { ...DEFAULT_SCENARIO_INPUTS, temperatureDeltaC: 4 }, c);
    expect(hot.selected.yieldIndex!).toBeLessThan(cool.selected.yieldIndex!);
  });
  it("S04 irrigation: less irrigation → lower water for an irrigated farm; no effect when rainfed", () => {
    expect(run({ irrigationPct: 0 }).selected.waterIndex!).toBeLessThan(run({ irrigationPct: 100 }).selected.waterIndex!);
    expect(run({ irrigationPct: 0 }).waterSupplyMm!).toBeLessThan(run({ irrigationPct: 100 }).waterSupplyMm!);
    const rf = ctx(farmWith({ irrigation: "rainfed" }));
    expect(run({ irrigationPct: 0 }, rf.currentPlan as EvaluatedPlan, rf).selected).toEqual(run({ irrigationPct: 100 }, rf.currentPlan as EvaluatedPlan, rf).selected);
  });
  it("S05 input cost: cost up, net down, monotone", () => {
    const lo = run({ inputCostDeltaPct: -20 }), hi = run({ inputCostDeltaPct: 60 });
    expect(hi.selected.estimatedCost!).toBeGreaterThan(lo.selected.estimatedCost!);
    expect(hi.selected.estimatedNetReturn!).toBeLessThan(lo.selected.estimatedNetReturn!);
    expect(hi.selectedRange.estimatedCost!.low).toBeGreaterThan(lo.selectedRange.estimatedCost!.low);
  });
  it("baseline = current plan under the SAME inputs; selected = plan", () => {
    const r = run({ rainfallDeltaPct: -20 }, RESILIENCE);
    const same = run({ rainfallDeltaPct: -20 }, CURRENT);
    expect(r.baseline).toEqual(same.selected);
    expect(r.planId).toBe("resilience");
    expect(r.selected).not.toEqual(r.baseline);
  });
  it("net = revenue − cost, money rounded to KES 1,000, ranges contain point values", () => {
    for (const plan of [CURRENT, MINIMUM, RESILIENCE]) {
      const r = run({ rainfallDeltaPct: -15, temperatureDeltaC: 1 }, plan);
      const s = r.selected;
      expect(s.currency).toBe("KES");
      expect(s.estimatedNetReturn).toBe(s.estimatedRevenue! - s.estimatedCost!);
      for (const v of [s.estimatedCost, s.estimatedRevenue, s.estimatedNetReturn]) expect(Math.abs(v! % 1000)).toBe(0);
      for (const k of ["estimatedCost", "estimatedRevenue", "estimatedNetReturn", "waterIndex", "yieldIndex"] as const) {
        const rg = r.selectedRange[k]!;
        expect(rg.low).toBeLessThanOrEqual(s[k]!);
        expect(rg.high).toBeGreaterThanOrEqual(s[k]!);
      }
    }
  });
});

describe("S11 · no NaN/Infinity at extremes", () => {
  const L = SCENARIO_LIMITS;
  const combos: ScenarioInputs[] = [];
  for (const a of [L.rainfallDeltaPct.min, L.rainfallDeltaPct.max]) for (const b of [L.temperatureDeltaC.min, L.temperatureDeltaC.max])
    for (const c of [L.irrigationPct.min, L.irrigationPct.max]) for (const d of [L.inputCostDeltaPct.min, L.inputCostDeltaPct.max])
      combos.push({ rainfallDeltaPct: a, temperatureDeltaC: b, irrigationPct: c, inputCostDeltaPct: d });
  const walk = (v: unknown, path: string) => {
    if (typeof v === "number") expect(Number.isFinite(v), path).toBe(true);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  const farms: FarmProfile[] = [SAMPLE_FARM, farmWith({ areaHa: 0 }), farmWith({ areaHa: null }), farmWith({ rotation: [] }), farmWith({ irrigation: "rainfed", budget: null })];
  for (const farm of farms) for (const climate of [CLIMATE, null, { ...CLIMATE, annualRainfallMm: 0, meanTemperatureC: null }]) {
    it(`area=${farm.areaHa} rot=${farm.rotation.length} climate=${climate ? climate.annualRainfallMm : "null"}`, () => {
      const c = ctx(farm, climate, SOIL.dry);
      const plans = evaluateRotations(farm, climate, SOIL.dry).plans;
      for (const inputs of combos) for (const plan of plans) {
        const r = runScenario(plan, inputs, c);
        walk(r, "result");
        expect(r.uncertainty.join(" ")).toMatch(/estimate, not a guarantee/);
        if (!climate || !climate.annualRainfallMm) { expect(r.selected.waterIndex === null || climate?.annualRainfallMm === 0).toBe(true); }
      }
    });
  }
  it("null climate → water/yield/revenue null (not fake zeros) with a note; cost still estimated", () => {
    const c = ctx(SAMPLE_FARM, null);
    const r = runScenario(c.currentPlan, DEFAULT_SCENARIO_INPUTS, c);
    expect(r.selected.waterIndex).toBeNull();
    expect(r.selected.yieldIndex).toBeNull();
    expect(r.selected.estimatedRevenue).toBeNull();
    expect(r.selected.estimatedNetReturn).toBeNull();
    expect(r.selected.estimatedCost).toBeGreaterThan(0);
    expect(r.uncertainty.join(" ")).toMatch(/Climate data unavailable/);
  });
  it("zero / unknown area → per-ha basis; empty rotation → all null", () => {
    const z = ctx(farmWith({ areaHa: 0 }));
    expect(runScenario(z.currentPlan, DEFAULT_SCENARIO_INPUTS, z).costBasis).toBe("per_ha");
    const e = ctx(farmWith({ rotation: [] }));
    const r = runScenario(e.currentPlan, DEFAULT_SCENARIO_INPUTS, e);
    expect(Object.values(r.selected).filter((v) => typeof v === "number")).toEqual([]);
    expect(r.uncertainty.join(" ")).toMatch(/no seasons/);
  });
  it("infeasible plan still gets metrics with an uncertainty note", () => {
    const farm = farmWith({ budget: 10_000 });
    const c = ctx(farm);
    const plan = evaluateRotations(farm, CLIMATE, SOIL.normal).plans[2];
    expect(plan.feasible).toBe(false);
    const r = runScenario(plan, DEFAULT_SCENARIO_INPUTS, c);
    expect(r.selected.estimatedCost).not.toBeNull();
    expect(r.uncertainty.join(" ")).toMatch(/failed feasibility/);
  });
});

describe("S13 · determinism", () => {
  it("same inputs → identical outputs", () => {
    const inputs = { rainfallDeltaPct: -25, temperatureDeltaC: 1.5, irrigationPct: 60, inputCostDeltaPct: 15 };
    expect(run(inputs, MINIMUM)).toEqual(run(inputs, MINIMUM));
    expect(JSON.stringify(run(inputs, RESILIENCE))).toBe(JSON.stringify(run(inputs, RESILIENCE)));
  });
});
