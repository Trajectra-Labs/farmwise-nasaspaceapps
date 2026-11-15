import "./storagePolyfill";
import { describe, expect, it } from "vitest";
import type { FarmProfile } from "@fw/contracts";
import { CROPS, computeWeights, evaluateRotations, getCrop, PLAN_ORDER } from "..";
import type { EvaluatedPlan, RotationEvaluation } from "..";
import { CLIMATE, SAMPLE_FARM, SOIL, farmWith, rot } from "./fixtures";

const key = (p: EvaluatedPlan) => p.seasons.map((s) => s.cropId).join(">");
const comp = (p: EvaluatedPlan, k: string) => p.components.find((c) => c.key === k)!.value;

const FARMS: FarmProfile[] = [
  SAMPLE_FARM,
  farmWith({ rotation: rot("irish_potato", "irish_potato", "irish_potato", "irish_potato"), budget: 1_000_000 }),
  farmWith({ rotation: rot("maize", "maize", "maize", "maize", "maize", "maize"), irrigation: "rainfed" }),
  farmWith({ rotation: rot("maize") }),
  farmWith({ rotation: rot("beans", "maize") }),
  farmWith({ rotation: rot("sorghum", "cowpea", "finger_millet", "cowpea"), priorities: ["cost"] }),
  farmWith({ rotation: rot("maize", "beans", "maize", "beans"), areaHa: null, budget: null }),
  farmWith({ rotation: rot("soybean", "sweet_potato", "maize", "beans", "sorghum", "cowpea"), irrigation: "regular", priorities: [] }),
];

function assertComplete(farm: FarmProfile, e: RotationEvaluation) {
  expect(e.plans.map((p) => p.id)).toEqual([...PLAN_ORDER]);
  for (const p of e.plans) {
    expect(p.seasons).toHaveLength(farm.rotation.length);
    p.seasons.forEach((s, i) => {
      expect(s.season).toBe(farm.rotation[i].season);
      expect(s.yearOffset).toBe(farm.rotation[i].yearOffset);
      expect(s.cropId.trim()).not.toBe("");
      if (p.id !== "current") {
        const c = getCrop(s.cropId);
        expect(c, `${p.id} slot ${i}`).toBeDefined();
        expect(c!.seasons).toContain(s.season);
      }
    });
  }
  expect(new Set(e.plans.map(key)).size).toBe(3);
}

describe("R01/R11 · three complete, distinct, in-season sequences", () => {
  for (const [i, farm] of FARMS.entries()) {
    for (const preset of ["dry", "normal", "wet"] as const) {
      it(`farm #${i} (${farm.rotation.map((r) => r.cropId).join(",")}) · ${preset}`, () => {
        assertComplete(farm, evaluateRotations(farm, CLIMATE, SOIL[preset]));
      });
    }
  }
  it("works without climate or soil", () => {
    for (const farm of FARMS) assertComplete(farm, evaluateRotations(farm, null, null));
  });
  it("current plan is the farm rotation as-is", () => {
    const e = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    expect(e.plans[0].seasons).toEqual(SAMPLE_FARM.rotation);
    expect(e.plans[0].changedSeasons).toBe(0);
  });
  it("minimum changes 1–2 seasons and fixes the sample farm's back-to-back maize", () => {
    const e = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    const m = e.plans[1];
    expect(m.changedSeasons).toBeGreaterThanOrEqual(1);
    expect(m.changedSeasons).toBeLessThanOrEqual(2);
    expect(m.risks.some((r) => r.includes("pest group"))).toBe(false);
    expect(e.plans[0].risks.some((r) => r.includes("pest group"))).toBe(true);
    // familiar crop preferred (beans), not an unfamiliar legume
    expect(m.seasons.map((s) => s.cropId)).toEqual(["maize", "beans", "maize", "beans"]);
  });
  it("resilience includes a legume and drought-tolerant crops", () => {
    const r = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal).plans[2];
    const crops = r.seasons.map((s) => getCrop(s.cropId)!);
    expect(crops.some((c) => c.nitrogenFixing)).toBe(true);
    expect(crops.filter((c) => c.droughtTolerance >= 4).length).toBeGreaterThanOrEqual(2);
  });
  it("unknown season names and crops are flagged, never crash", () => {
    const farm = farmWith({ rotation: [
      { season: "Dry season", cropId: "maize", yearOffset: 0 },
      { season: "Long rains", cropId: "teff", yearOffset: 0 },
      { season: "Short rains", cropId: "", yearOffset: 0 },
    ] });
    const e = evaluateRotations(farm, CLIMATE, SOIL.normal);
    expect(e.plans).toHaveLength(3);
    expect(e.plans[0].feasible).toBe(false);
    expect(e.plans[0].missingInfo.join(" ")).toMatch(/Dry season/);
    expect(e.plans[0].missingInfo.join(" ")).toMatch(/teff/);
    expect(e.plans[0].checks.find((c) => c.id === "season")!.passed).toBe(false);
    for (const p of e.plans.slice(1)) {
      expect(p.seasons[1].cropId).not.toBe("teff");
      expect(p.seasons[2].cropId).not.toBe("");
    }
    expect(new Set(e.plans.map(key)).size).toBe(3);
  });
  it("only-unknown seasons: alternatives infeasible with clear text (edge case)", () => {
    const e = evaluateRotations(farmWith({ rotation: [{ season: "Dry season", cropId: "maize", yearOffset: 0 }] }), CLIMATE, SOIL.normal);
    expect(e.plans[1].feasible).toBe(false);
    expect(e.plans[1].constraints.join(" ")).toMatch(/no minimum-change plan/i);
    expect(e.plans[2].feasible).toBe(false);
  });
  it("empty rotation → three infeasible plans, no recommendation, no crash", () => {
    const e = evaluateRotations(farmWith({ rotation: [] }), CLIMATE, SOIL.normal);
    expect(e.plans.map((p) => p.id)).toEqual([...PLAN_ORDER]);
    for (const p of e.plans) { expect(p.feasible).toBe(false); expect(p.score).toBeNull(); expect(p.constraints.join(" ")).toMatch(/empty/i); }
    expect(e.recommendedId).toBeNull();
  });
});

describe("R05 · infeasible plans never win", () => {
  it("best-scoring plan is infeasible (restricted crop) → not recommended", () => {
    const crops = CROPS.map((c) => (c.id === "cowpea" ? { ...c, restricted: "Not allowed in this demo market" } : c));
    const farm = farmWith({ rotation: rot("sorghum", "cowpea", "finger_millet", "cowpea") });
    const e = evaluateRotations(farm, CLIMATE, SOIL.normal, { crops });
    const cur = e.plans[0];
    expect(cur.feasible).toBe(false);
    expect(cur.score).toBeNull();
    // what current WOULD score if ranked:
    let w = 0, acc = 0;
    for (const c of cur.components) if (c.value != null) { w += c.weight; acc += c.weight * c.value; }
    const wouldBe = Math.round(acc / w);
    const others = e.plans.filter((p) => p.feasible).map((p) => p.score as number);
    expect(wouldBe).toBeGreaterThan(Math.max(...others));
    expect(e.recommendedId).not.toBe("current");
    expect(e.plans.find((p) => p.id === e.recommendedId)!.feasible).toBe(true);
    expect(cur.checks.find((c) => c.id === "restricted")!.blocking).toBe(true);
    // generated plans never use the restricted crop
    for (const p of e.plans.slice(1)) expect(p.seasons.some((s) => s.cropId === "cowpea")).toBe(false);
  });
  it("all plans infeasible (budget far too small) → recommendedId null", () => {
    const e = evaluateRotations(farmWith({ budget: 10_000 }), CLIMATE, SOIL.normal);
    for (const p of e.plans) { expect(p.feasible).toBe(false); expect(p.score).toBeNull(); expect(p.budgetFit).toBe("over"); }
    expect(e.recommendedId).toBeNull();
    expect(e.recommendationReason).toMatch(/rejected before ranking/);
  });
  it("blocking pH and rainfed water checks reject plans", () => {
    const acid = evaluateRotations(SAMPLE_FARM, CLIMATE, { ...SOIL.normal, ph: 4.2 });
    expect(acid.plans[0].checks.find((c) => c.id === "ph")!.blocking).toBe(true);
    const dryClimate = { ...CLIMATE, annualRainfallMm: 500 };
    const e = evaluateRotations(farmWith({ irrigation: "rainfed" }), dryClimate, SOIL.normal);
    expect(e.plans[0].checks.find((c) => c.id === "water")!.blocking).toBe(true);
    expect(e.plans[0].feasible).toBe(false);
    if (e.recommendedId) expect(e.plans.find((p) => p.id === e.recommendedId)!.feasible).toBe(true);
  });
});

describe("R07 · keeping the current rotation is legitimate", () => {
  it("a good current rotation is recommended over changes", () => {
    const farm = farmWith({ rotation: rot("sorghum", "cowpea", "finger_millet", "cowpea") });
    const e = evaluateRotations(farm, CLIMATE, SOIL.normal);
    expect(e.plans[0].feasible).toBe(true);
    expect(e.recommendedId).toBe("current");
    expect(e.recommendationReason).toMatch(/legitimate/);
  });
});

describe("R08 · shared inputs measurably change results", () => {
  const cur = (farm: FarmProfile, soil = SOIL.normal) => evaluateRotations(farm, CLIMATE, soil).plans[0];
  it("dry vs wet soil preset changes water and soil components", () => {
    const d = cur(SAMPLE_FARM, SOIL.dry), w = cur(SAMPLE_FARM, SOIL.wet);
    expect(comp(d, "water")).toBeLessThan(comp(w, "water")!);
    expect(comp(d, "soil")).not.toBe(comp(w, "soil"));
    expect(comp(d, "soil")).toBeLessThan(comp(cur(SAMPLE_FARM, SOIL.normal), "soil")!);
  });
  it("irrigation rainfed vs regular changes the water component", () => {
    expect(comp(cur(farmWith({ irrigation: "rainfed" })), "water")).toBeLessThan(comp(cur(farmWith({ irrigation: "regular" })), "water")!);
  });
  it("budget changes cost component and budget fit", () => {
    const lo = cur(farmWith({ budget: 100_000 })), hi = cur(farmWith({ budget: 300_000 }));
    expect(comp(lo, "cost")).toBeLessThan(comp(hi, "cost")!);
    expect(hi.budgetFit).toBe("within");
    expect(cur(farmWith({ budget: null })).budgetFit).toBe("unknown");
    expect(cur(farmWith({ budget: null })).missingInfo.join(" ")).toMatch(/budget/i);
  });
  it("pH outside crop range lowers soil component", () => {
    expect(comp(cur(SAMPLE_FARM, { ...SOIL.normal, ph: 5.2 }), "soil")).toBeLessThan(comp(cur(SAMPLE_FARM), "soil")!);
  });
  it("priorities re-weight and renormalise", () => {
    const w = computeWeights(["water"]);
    expect(w.water).toBeGreaterThan(0.3);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(computeWeights([])).toEqual({ water: 0.3, soil: 0.25, cost: 0.2, climate: 0.15, change: 0.1 });
  });
  it("area unknown → per-ha costs and missing info", () => {
    const p = cur(farmWith({ areaHa: null }));
    expect(p.costBasis).toBe("per_ha");
    expect(p.missingInfo.join(" ")).toMatch(/area/i);
  });
});

describe("R09 · score and confidence are separate", () => {
  it("same inputs, different provenance → same score, different confidence", () => {
    const sim = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    const lab = evaluateRotations(SAMPLE_FARM, CLIMATE, { ...SOIL.normal, source: "USER_SOIL_TEST" });
    expect(lab.plans.map((p) => p.score)).toEqual(sim.plans.map((p) => p.score));
    expect(sim.plans[0].confidence).toBe("medium");
    expect(lab.plans[0].confidence).toBe("high");
  });
  it("missing climate → low confidence and nulls for water/climate components", () => {
    const e = evaluateRotations(SAMPLE_FARM, null, SOIL.normal);
    for (const p of e.plans) {
      expect(p.confidence).toBe("low");
      expect(comp(p, "water")).toBeNull();
      expect(comp(p, "climate")).toBeNull();
    }
    expect(e.plans[0].score).not.toBeNull();
  });
  it("USER_SOIL_TEST without area is capped at medium", () => {
    const e = evaluateRotations(farmWith({ areaHa: null }), CLIMATE, { ...SOIL.normal, source: "USER_SOIL_TEST" });
    expect(e.plans[0].confidence).toBe("medium");
  });
  it("every reason cites evidence or rules, and evidence ids resolve", () => {
    for (const p of evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.dry).plans) {
      const ids = new Set(p.evidence.map((e) => e.id));
      expect(p.evidenceIds.every((id) => ids.has(id))).toBe(true);
      for (const r of p.reasons) {
        expect(r.evidenceIds.length + r.ruleIds.length).toBeGreaterThan(0);
        for (const id of r.evidenceIds) expect(ids.has(id), id).toBe(true);
      }
      expect(ids.has("soil-moisture")).toBe(true);
      expect(ids.has("farmer-irrigation")).toBe(true);
      expect(ids.has("nasa-power-prectotcorr-annual")).toBe(true);
      expect(p.evidence.find((e) => e.id === "soil-moisture")!.source).toBe("SIMULATED_IOT");
      expect(p.evidence.some((e) => e.source === "MODEL_ESTIMATE")).toBe(true);
    }
  });
});

describe("R10 · currency and rounding", () => {
  it("costs in KES rounded to 1,000; scores are integers", () => {
    const e = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    expect(e.currency).toBe("KES");
    for (const p of e.plans) {
      expect(p.costRangeKes!.low % 1000).toBe(0);
      expect(p.costRangeKes!.high % 1000).toBe(0);
      if (p.score != null) expect(Number.isInteger(p.score)).toBe(true);
      for (const c of p.components) if (c.value != null) expect(Number.isInteger(c.value)).toBe(true);
    }
  });
  it("recommendation ties broken by smaller change; deterministic", () => {
    const a = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    const b = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);
    expect(a).toEqual(b);
    const rec = a.plans.find((p) => p.id === a.recommendedId)!;
    for (const p of a.plans) if (p.feasible && p.score === rec.score) expect(rec.changedSeasons).toBeLessThanOrEqual(p.changedSeasons);
  });
});
