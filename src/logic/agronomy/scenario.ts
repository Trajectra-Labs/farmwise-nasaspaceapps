// Moen · runScenario(): pure what-if estimates for Current (baseline) vs Selected plan under the same
// scenario inputs. Every number is an ESTIMATE from documented assumptions (README.md), not a guarantee.
import type { CropSeason, MetricSet, RotationPlan, ScenarioInputs } from "@fw/contracts";
import { getCrop } from "./crops";
import { dataProvenance, describeClimateSource } from "./format";
import {
  clamp, effectiveArea, ET_INCREASE_PER_DEG_C, finite, HEAT_YIELD_PENALTY_PER_DEG_C, heatYieldFactor, IRRIGATION_MM_PER_SEASON,
  mid, roundKes, SEASON_RAIN_SHARE, seasonShare, seasonSupplyMm, waterNeedMm, waterYieldRatio,
} from "./model";
import type { CropRule, DetailedScenarioResult, MetricRanges, Range, ScenarioContext, ScenarioPreset, ScenarioPresetId, SliderLimit } from "./types";

export const DEFAULT_SCENARIO_INPUTS: ScenarioInputs = { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 };

export const SCENARIO_LIMITS: Readonly<Record<keyof ScenarioInputs, SliderLimit>> = {
  rainfallDeltaPct: { min: -50, max: 30, step: 5 },
  temperatureDeltaC: { min: -1, max: 4, step: 0.5 },
  /** % of the farm's normal irrigation availability. */
  irrigationPct: { min: 0, max: 100, step: 10 },
  inputCostDeltaPct: { min: -20, max: 60, step: 5 },
};

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  { id: "typical", label: "Typical", description: "Historical average conditions from the farm's climate context (no change to rain or temperature); today's input costs.", inputs: { ...DEFAULT_SCENARIO_INPUTS } },
  { id: "drier", label: "Drier", description: "30 % less seasonal rainfall than the historical average.", inputs: { ...DEFAULT_SCENARIO_INPUTS, rainfallDeltaPct: -30 } },
  { id: "hotter", label: "Hotter", description: "Mean temperature 2 °C above the historical average (higher crop water demand, more heat stress).", inputs: { ...DEFAULT_SCENARIO_INPUTS, temperatureDeltaC: 2 } },
  { id: "costlier", label: "Higher costs", description: "Seed, fertiliser and labour costs 25 % higher.", inputs: { ...DEFAULT_SCENARIO_INPUTS, inputCostDeltaPct: 25 } },
];

const KEYS = Object.keys(SCENARIO_LIMITS) as (keyof ScenarioInputs)[];

/** Clamp each input to its slider limits and snap to the step; non-numeric values fall back to the default. */
export function clampScenarioInputs(inputs: Partial<ScenarioInputs> | null | undefined): ScenarioInputs {
  const out = { ...DEFAULT_SCENARIO_INPUTS };
  for (const k of KEYS) {
    const v = Number(inputs?.[k]);
    const { min, max, step } = SCENARIO_LIMITS[k];
    if (!Number.isFinite(v)) continue;
    const snapped = Math.round((clamp(v, min, max) - min) / step) * step + min;
    out[k] = Math.round(clamp(snapped, min, max) * 1000) / 1000 + 0;
  }
  return out;
}

export function matchPreset(inputs: ScenarioInputs): ScenarioPresetId | null {
  const p = SCENARIO_PRESETS.find((pr) => KEYS.every((k) => pr.inputs[k] === inputs[k]));
  return p ? p.id : null;
}

// ───────────────────────────── core estimate ─────────────────────────────
type SeqResult = {
  metrics: MetricSet; ranges: MetricRanges; demandMm: number | null; supplyMm: number | null; unknownCrops: string[];
};

const nullMetrics = (): MetricSet => ({ waterIndex: null, yieldIndex: null, estimatedCost: null, estimatedRevenue: null, estimatedNetReturn: null, currency: "KES" });
const nullRanges = (): MetricRanges => ({ waterIndex: null, yieldIndex: null, estimatedCost: null, estimatedRevenue: null, estimatedNetReturn: null });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const rng = (a: number, b: number): Range => ({ low: Math.min(a, b), high: Math.max(a, b) });
const idx = (v: number) => Math.round(clamp(v, 0, 100));

function estimate(seasons: CropSeason[], inputs: ScenarioInputs, ctx: ScenarioContext): SeqResult {
  const { farm, climate, soil } = ctx;
  const area = effectiveArea(farm) ?? 1;
  const costF = 1 + inputs.inputCostDeltaPct / 100;
  const meanT = finite(climate?.meanTemperatureC) ? (climate!.meanTemperatureC as number) + inputs.temperatureDeltaC : null;
  const unknownCrops: string[] = [];
  const rows: { crop: CropRule; need: number; needLo: number; needHi: number; supply: number | null }[] = [];
  for (const s of seasons ?? []) {
    const crop = getCrop(s?.cropId ?? "");
    if (!crop) { unknownCrops.push(s?.cropId || "(blank)"); continue; }
    rows.push({
      crop,
      need: waterNeedMm(crop, inputs.temperatureDeltaC, "mid"),
      needLo: waterNeedMm(crop, inputs.temperatureDeltaC, "low"),
      needHi: waterNeedMm(crop, inputs.temperatureDeltaC, "high"),
      supply: seasonSupplyMm(farm, climate, soil, s.season, inputs.rainfallDeltaPct, inputs.irrigationPct),
    });
  }
  if (!rows.length) return { metrics: nullMetrics(), ranges: nullRanges(), demandMm: null, supplyMm: null, unknownCrops };

  const demandMm = Math.round(sum(rows.map((r) => r.need)));
  const costMid = roundKes(sum(rows.map((r) => mid(r.crop.costKesPerHa) * area * costF)));
  const costLo = roundKes(sum(rows.map((r) => r.crop.costKesPerHa.low * area * costF)));
  const costHi = roundKes(sum(rows.map((r) => r.crop.costKesPerHa.high * area * costF)));
  const hasWater = rows.every((r) => r.supply != null);
  if (!hasWater) {
    // Without rainfall we cannot estimate water or yield; cost is still known from assumptions.
    return {
      metrics: { ...nullMetrics(), estimatedCost: costMid },
      ranges: { ...nullRanges(), estimatedCost: rng(costLo, costHi) },
      demandMm, supplyMm: null, unknownCrops,
    };
  }
  const ratio = (r: (typeof rows)[number], need: number) => waterYieldRatio(r.crop, r.supply as number, need) * heatYieldFactor(r.crop, meanT);
  const met = (need: number, supply: number) => Math.min(1, supply / Math.max(1, need));
  const waterIndex = idx(100 * sum(rows.map((r) => met(r.need, r.supply as number) * r.need)) / Math.max(1, sum(rows.map((r) => r.need))));
  const wLo = idx(100 * sum(rows.map((r) => met(r.needHi, r.supply as number) * r.needHi)) / Math.max(1, sum(rows.map((r) => r.needHi))));
  const wHi = idx(100 * sum(rows.map((r) => met(r.needLo, r.supply as number) * r.needLo)) / Math.max(1, sum(rows.map((r) => r.needLo))));
  const yMid = rows.map((r) => ratio(r, r.need));
  const yLo = rows.map((r) => ratio(r, r.needHi));
  const yHi = rows.map((r) => ratio(r, r.needLo));
  const yieldIndex = idx(100 * sum(yMid) / rows.length);
  const revMid = roundKes(sum(rows.map((r, i) => r.crop.yieldTPerHa.typical * yMid[i] * mid(r.crop.priceKesPerT) * area)));
  const revLo = roundKes(sum(rows.map((r, i) => r.crop.yieldTPerHa.low * yLo[i] * r.crop.priceKesPerT.low * area)));
  const revHi = roundKes(sum(rows.map((r, i) => r.crop.yieldTPerHa.high * yHi[i] * r.crop.priceKesPerT.high * area)));
  return {
    metrics: {
      waterIndex, yieldIndex: safe(yieldIndex), estimatedCost: costMid, estimatedRevenue: revMid,
      estimatedNetReturn: roundKes(revMid - costMid), currency: "KES",
    },
    ranges: {
      waterIndex: rng(wLo, wHi), yieldIndex: rng(idx(100 * sum(yLo) / rows.length), idx(100 * sum(yHi) / rows.length)),
      estimatedCost: rng(costLo, costHi), estimatedRevenue: rng(revLo, revHi), estimatedNetReturn: rng(roundKes(revLo - costHi), roundKes(revHi - costLo)),
    },
    demandMm,
    supplyMm: Math.round(sum(rows.map((r) => r.supply as number))),
    unknownCrops,
  };
}

// ───────────────────────────── public API ─────────────────────────────
export const SCENARIO_ASSUMPTIONS: readonly string[] = [
  `Seasonal rainfall = mean annual rainfall from the climate context × season share (Long rains ${SEASON_RAIN_SHARE["Long rains"]}, Short rains ${SEASON_RAIN_SHARE["Short rains"]}, unknown seasons 0.3) × (1 + rainfall change %).`,
  `Crop water need = mid FAO seasonal range × (1 + ${ET_INCREASE_PER_DEG_C * 100} % per °C of warming).`,
  `Irrigation per season at 100 % availability: rainfed ${IRRIGATION_MM_PER_SEASON.rainfed} mm, limited ${IRRIGATION_MM_PER_SEASON.limited} mm, regular ${IRRIGATION_MM_PER_SEASON.regular} mm (assumption), scaled by the irrigation slider.`,
  "Soil moisture reading adjusts available water by (moisture % − 25) × 3 mm, capped at ±60 mm (assumption; simulated sensor values are not a soil test).",
  "Yield follows the FAO-33 linear water response 1 − Ya/Ym = Ky × (1 − water met), using each crop's Ky (FAO-33 / FAO-66; assumed where not tabulated).",
  `Heat stress: yield falls ${HEAT_YIELD_PENALTY_PER_DEG_C * 100} % per °C that the mean temperature (+ change) exceeds the crop's threshold (assumption).`,
  "Cost = input cost per ha (mid of demonstration range) × farm area × (1 + input-cost change %). Revenue = expected yield × mid farm-gate price × area. Net = revenue − cost.",
  "Ranges combine low/high yield, price, cost and water need. Amounts in KES, rounded to the nearest 1,000.",
  "Prices, costs and yields are demonstration assumptions for Nakuru, not market quotes. Every figure is an estimate, not a guarantee.",
];

export function runScenario(plan: RotationPlan, inputs: ScenarioInputs, context: ScenarioContext): DetailedScenarioResult {
  const clean = clampScenarioInputs(inputs);
  const sel = estimate(plan?.seasons ?? [], clean, context);
  const base = estimate(context?.currentPlan?.seasons ?? [], clean, context);
  const area = effectiveArea(context.farm);
  const uncertainty: string[] = [
    "Every figure here is a model estimate, not a guarantee of yield or income: real outcomes depend on weather timing, pests, management and markets.",
  ];
  const provenance = dataProvenance(context?.climate ?? null, context?.soil ?? null);
  uncertainty.push(describeClimateSource(provenance.climate));
  if (!context.climate || !finite(context.climate.annualRainfallMm)) uncertainty.push("Climate data unavailable: water and yield indices and revenue cannot be estimated (shown as unknown, not zero).");
  if (!finite(context.climate?.meanTemperatureC)) uncertainty.push("Mean temperature unknown: heat-stress effects are not included.");
  if (area == null) uncertainty.push("Farm area unknown or zero: money values are per hectare.");
  if (!context.soil) uncertainty.push("No soil reading: soil moisture was not included in the water balance.");
  else if (context.soil.source === "SIMULATED_IOT") uncertainty.push("Soil moisture comes from a simulated sensor, not a real field reading.");
  else if (context.soil.source === "USER_SOIL_TEST") uncertainty.push("Soil moisture comes from the farmer's own soil test entry.");
  if (!(plan?.seasons?.length)) uncertainty.push("The selected plan has no seasons, so no estimate can be made.");
  if (!(context?.currentPlan?.seasons?.length)) uncertainty.push("The current rotation has no seasons, so there is no baseline.");
  const unknown = [...new Set([...sel.unknownCrops, ...base.unknownCrops])];
  if (unknown.length) uncertainty.push(`Not in the crop manifest and left out of the estimate: ${unknown.join(", ")}.`);
  const unknownSeasons = [...new Set([...(plan?.seasons ?? []), ...(context?.currentPlan?.seasons ?? [])].map((s) => s.season).filter((s) => !seasonShare(s).known))];
  if (unknownSeasons.length) uncertainty.push(`Season name(s) not recognised (${unknownSeasons.join(", ")}): a 0.3 rainfall share was assumed.`);
  if (plan && plan.feasible === false) uncertainty.push(`This plan failed feasibility checks${plan.constraints?.length ? ` (${plan.constraints.join(" ")})` : ""}; the figures are shown for comparison only.`);

  return {
    planId: plan?.id ?? "current", inputs: clean,
    baseline: base.metrics, selected: sel.metrics,
    baselineRange: base.ranges, selectedRange: sel.ranges,
    waterDemandMm: { baseline: base.demandMm, selected: sel.demandMm },
    waterSupplyMm: sel.supplyMm,
    costBasis: area == null ? "per_ha" : "farm",
    provenance,
    uncertainty, assumptions: [...SCENARIO_ASSUMPTIONS],
  };
}
