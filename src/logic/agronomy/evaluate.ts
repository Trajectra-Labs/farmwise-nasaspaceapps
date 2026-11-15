// Moen · evaluateRotations(): pure, deterministic rotation generation + feasibility + scoring.
// No Date.now / Math.random / I/O. See README.md for every rule and assumption.
import type { ClimateContext, CropSeason, Evidence, FarmProfile, SoilInput } from "@fw/contracts";
import { CROPS, getCrop, isKnownSeason } from "./crops";
import {
  clamp, effectiveArea, effectiveBudget, finite, mid, roundKes, seasonRainMm, seasonSupplyMm, soilMoistureAdjMm,
  waterNeedMm, irrigationMm, WATER_RELIABILITY_BUFFER,
} from "./model";
import type {
  ChangeSize, CropRule, EvaluateOptions, EvaluatedPlan, FeasibilityCheck, PlanId, Reason, RotationEvaluation,
  ScoreComponent, ScoreKey,
} from "./types";
import { PLAN_ORDER } from "./types";

// ───────────────────────────── weights ─────────────────────────────
export const DEFAULT_WEIGHTS: Readonly<Record<ScoreKey, number>> = { water: 0.3, soil: 0.25, cost: 0.2, climate: 0.15, change: 0.1 };
/** Each farmer priority multiplies its component weight by this factor before renormalising. */
export const PRIORITY_BOOST = 1.6;
const SCORE_KEYS: ScoreKey[] = ["water", "soil", "cost", "climate", "change"];
const LABELS: Record<ScoreKey, string> = { water: "Water fit", soil: "Soil & rotation health", cost: "Input cost burden", climate: "Climate (heat & drought) fit", change: "Ease of change" };

export function computeWeights(priorities: readonly string[] = []): Record<ScoreKey, number> {
  const w: Record<ScoreKey, number> = { ...DEFAULT_WEIGHTS };
  for (const p of new Set(priorities)) if (p === "water" || p === "cost" || p === "soil") w[p] *= PRIORITY_BOOST;
  const sum = SCORE_KEYS.reduce((a, k) => a + w[k], 0);
  for (const k of SCORE_KEYS) w[k] = Math.round((w[k] / sum) * 1000) / 1000;
  return w;
}

// ───────────────────────────── context ─────────────────────────────
type Ctx = {
  farm: FarmProfile; climate: ClimateContext | null; soil: SoilInput | null; crops: CropRule[];
  area: number | null; budget: number | null; meanT: number | null; hasRain: boolean;
  weights: Record<ScoreKey, number>; current: CropSeason[];
};

const PH_BLOCKING_MARGIN = 0.5;
const WATER_BLOCK_RATIO = 0.6; // rainfed + drought-sensitive + rain < 60 % of need → blocking
const WATER_RISK_RATIO = 0.8;  // drought-sensitive + supply < 80 % of need → risk (issue)
const LOW_TOLERANCE = 2;

const lookup = (ctx: Ctx, id: string) => getCrop(id, ctx.crops);
const knownSeason = (ctx: Ctx, season: string) => isKnownSeason(season, ctx.crops);

function slotSupply(ctx: Ctx, season: string): number | null {
  return seasonSupplyMm(ctx.farm, ctx.climate, ctx.soil, season);
}

/** Blocking problems of one crop in one slot (independent of neighbours). */
function slotBlockers(ctx: Ctx, slot: CropSeason): string[] {
  const out: string[] = [];
  const id = (slot.cropId ?? "").trim();
  if (!id) return [`${slotLabel(slot)} has no crop`];
  const crop = lookup(ctx, id);
  if (!crop) return [`"${id}" (${slotLabel(slot)}) is not in the crop manifest, so it cannot be checked`];
  if (knownSeason(ctx, slot.season) && !crop.seasons.includes(slot.season)) out.push(`${crop.name} is not grown in the ${slot.season} season here`);
  if (crop.restricted) out.push(`${crop.name} is restricted: ${crop.restricted}`);
  const ph = ctx.soil?.ph;
  if (finite(ph) && (ph < crop.phRange.low - PH_BLOCKING_MARGIN || ph > crop.phRange.high + PH_BLOCKING_MARGIN))
    out.push(`Soil pH ${ph} is far outside the ${crop.phRange.low}–${crop.phRange.high} range for ${crop.name}`);
  if (ctx.farm.irrigation === "rainfed" && crop.droughtTolerance <= LOW_TOLERANCE) {
    const rain = seasonRainMm(ctx.climate, slot.season);
    const need = waterNeedMm(crop);
    if (rain != null && rain < WATER_BLOCK_RATIO * need)
      out.push(`${crop.name} (${slotLabel(slot)}) is rainfed and drought-sensitive, but expected rain ≈${Math.round(rain)} mm is well below its ≈${Math.round(need)} mm need`);
  }
  if (ctx.budget != null && ctx.area != null && crop.costKesPerHa.low * ctx.area > ctx.budget)
    out.push(`${crop.name} needs at least ${kes(crop.costKesPerHa.low * ctx.area)} of inputs per season, above the ${kes(ctx.budget)} budget`);
  return out;
}

const kes = (n: number) => `KES ${Math.round(roundKes(n)).toLocaleString("en-US")}`;
export const slotLabel = (s: CropSeason) => `${s.season || "Unnamed season"} · year ${(s.yearOffset ?? 0) + 1}`;

/** Indices i where slot i and the next slot (cyclic, the rotation repeats) share a pest group. */
function pestPairs(ctx: Ctx, seq: CropSeason[]): Array<[number, number]> {
  const n = seq.length;
  const pairs: Array<[number, number]> = [];
  if (n === 0) return pairs;
  if (n === 1) {
    const c = lookup(ctx, seq[0].cropId);
    return c ? [[0, 0]] : [];
  }
  const lim = n === 2 ? 1 : n;
  for (let i = 0; i < lim; i++) {
    const a = lookup(ctx, seq[i].cropId), b = lookup(ctx, seq[(i + 1) % n].cropId);
    if (a && b && a.pestGroup === b.pestGroup) pairs.push([i, (i + 1) % n]);
  }
  return pairs;
}

function waterRiskSlots(ctx: Ctx, seq: CropSeason[]): number[] {
  const out: number[] = [];
  seq.forEach((s, i) => {
    const c = lookup(ctx, s.cropId);
    const sup = slotSupply(ctx, s.season);
    if (c && sup != null && c.droughtTolerance <= LOW_TOLERANCE && sup < WATER_RISK_RATIO * waterNeedMm(c)) out.push(i);
  });
  return out;
}

const hasLegume = (ctx: Ctx, seq: CropSeason[]) => seq.some((s) => lookup(ctx, s.cropId)?.nitrogenFixing);

/** Issue counts by severity: [blocking slots, water-risk slots, pest-cycle pairs, no-legume]. */
function issueVector(ctx: Ctx, seq: CropSeason[]): [number, number, number, number] {
  const blocking = seq.filter((s) => slotBlockers(ctx, s).length > 0).length;
  return [blocking, waterRiskSlots(ctx, seq).length, pestPairs(ctx, seq).length, seq.length > 0 && !hasLegume(ctx, seq) ? 1 : 0];
}
const ISSUE_NAMES = ["a blocking constraint", "a water shortfall for a drought-sensitive crop", "back-to-back crops from the same pest group", "no legume in the rotation"];

// ───────────────────────────── components ─────────────────────────────
type Comp = { value: number | null; explanation: string };

function waterComponent(ctx: Ctx, seq: CropSeason[]): Comp {
  if (!ctx.hasRain) return { value: null, explanation: "Not scored: rainfall data (NASA climate context) is unavailable." };
  const vals: number[] = [];
  for (const s of seq) {
    const c = lookup(ctx, s.cropId);
    const sup = slotSupply(ctx, s.season);
    if (!c || sup == null) continue;
    const deficitRisk = clamp(1 - sup / (WATER_RELIABILITY_BUFFER * waterNeedMm(c)), 0, 1);
    vals.push(100 * clamp(1 - (c.ky ?? 1) * deficitRisk, 0, 1));
  }
  if (!vals.length) return { value: null, explanation: "Not scored: no known crops to compare with water supply." };
  return {
    value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    explanation: "Average per season of 100 × (1 − Ky × shortfall), where shortfall compares rain + irrigation + soil-moisture adjustment with crop water need plus a 30 % variability buffer.",
  };
}

function soilComponent(ctx: Ctx, seq: CropSeason[]): Comp {
  const known = seq.map((s) => lookup(ctx, s.cropId));
  if (!known.some(Boolean)) return { value: null, explanation: "Not scored: no known crops in this rotation." };
  let v = 70;
  const parts: string[] = [];
  const pairs = pestPairs(ctx, seq).length;
  if (pairs) { v -= 15 * pairs; parts.push(`−${15 * pairs} for ${pairs} back-to-back same pest group`); }
  const legumes = known.filter((c) => c?.nitrogenFixing).length;
  if (legumes) { const b = Math.min(20, 10 + 5 * (legumes - 1)); v += b; parts.push(`+${b} for legume seasons`); }
  else { v -= 10; parts.push("−10 for no legume"); }
  const n = ctx.soil?.n;
  if (finite(n)) {
    let pen = 0;
    known.forEach((c, i) => {
      if (!c || c.nitrogenFixing) return;
      const prev = known[(i - 1 + known.length) % known.length];
      if (prev?.nitrogenFixing && known.length > 1) return;
      pen += clamp((30 - n) / 10, 0, 1.5) * 8;
    });
    if (pen > 0) { v -= pen; parts.push(`−${Math.round(pen)} for low soil N (${n} mg/kg) under nitrogen-demanding crops not following a legume`); }
  }
  const ph = ctx.soil?.ph;
  if (finite(ph)) {
    let pen = 0;
    for (const c of known) if (c) pen += 15 * Math.max(0, c.phRange.low - ph, ph - c.phRange.high);
    if (pen > 0) { v -= pen; parts.push(`−${Math.round(pen)} for crops outside their pH range`); }
  }
  return { value: Math.round(clamp(v, 0, 100)), explanation: `Starts at 70: ${parts.join("; ") || "no adjustments"}.` };
}

function seasonCosts(ctx: Ctx, seq: CropSeason[]): { low: number; mid: number; high: number }[] {
  const f = ctx.area ?? 1;
  return seq.map((s) => lookup(ctx, s.cropId)).filter((c): c is CropRule => !!c)
    .map((c) => ({ low: c.costKesPerHa.low * f, mid: mid(c.costKesPerHa) * f, high: c.costKesPerHa.high * f }));
}

function costComponent(ctx: Ctx, seq: CropSeason[]): Comp {
  const costs = seasonCosts(ctx, seq);
  if (!costs.length) return { value: null, explanation: "Not scored: no known crops." };
  if (ctx.budget != null && ctx.area != null) {
    const peak = Math.max(...costs.map((c) => c.mid));
    const pressure = ctx.budget > 0 ? peak / ctx.budget : 10;
    return { value: Math.round(clamp(100 * (1.5 - pressure), 0, 100)), explanation: `100 × (1.5 − peak season cost ÷ budget); peak season ≈ ${kes(peak)} vs budget ${kes(ctx.budget)}.` };
  }
  const avgPerHa = costs.reduce((a, c) => a + c.mid, 0) / costs.length / (ctx.area ?? 1);
  return { value: Math.round(clamp(100 * (1 - avgPerHa / 200000), 0, 100)), explanation: `Budget or area unknown, so scored on average input cost per hectare per season (≈${kes(avgPerHa)}) against a 200,000 KES/ha reference.` };
}

function climateComponent(ctx: Ctx, seq: CropSeason[]): Comp {
  if (!finite(ctx.meanT)) return { value: null, explanation: "Not scored: temperature data (NASA climate context) is unavailable." };
  const vals = seq.map((s) => lookup(ctx, s.cropId)).filter((c): c is CropRule => !!c)
    .map((c) => ((c.droughtTolerance - 1) / 4) * 50 + clamp((c.heatStressAboveC - (ctx.meanT as number)) / 8, 0, 1) * 50);
  if (!vals.length) return { value: null, explanation: "Not scored: no known crops." };
  return { value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), explanation: `Per season: 50 × drought tolerance (1–5 scaled) + 50 × heat margin (crop threshold − ${ctx.meanT} °C mean, full credit at ≥ 8 °C).` };
}

function changeComponent(changed: number): Comp {
  return { value: clamp(100 - 25 * changed, 0, 100), explanation: `100 − 25 per changed season (${changed} changed).` };
}

function components(ctx: Ctx, seq: CropSeason[], changed: number): ScoreComponent[] {
  const c: Record<ScoreKey, Comp> = {
    water: waterComponent(ctx, seq), soil: soilComponent(ctx, seq), cost: costComponent(ctx, seq),
    climate: climateComponent(ctx, seq), change: changeComponent(changed),
  };
  return SCORE_KEYS.map((key) => ({ key, label: LABELS[key], weight: ctx.weights[key], value: c[key].value, explanation: c[key].explanation }));
}

function weightedScore(comps: ScoreComponent[]): number | null {
  let wsum = 0, acc = 0;
  for (const c of comps) if (c.value != null && Number.isFinite(c.value)) { wsum += c.weight; acc += c.weight * c.value; }
  return wsum > 0 ? Math.round(acc / wsum) : null;
}

const countChanged = (a: CropSeason[], b: CropSeason[]) => a.reduce((n, s, i) => n + (b[i]?.cropId === s.cropId ? 0 : 1), 0);

// ───────────────────────────── checks ─────────────────────────────
function checks(ctx: Ctx, seq: CropSeason[]): FeasibilityCheck[] {
  const out: FeasibilityCheck[] = [];
  const emptyCrop = seq.filter((s) => !(s.cropId ?? "").trim());
  const keys = seq.map((s) => `${s.season}|${s.yearOffset}`);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  out.push({
    id: "sequence", label: "Complete season sequence",
    passed: seq.length > 0 && emptyCrop.length === 0 && dup.length === 0,
    blocking: seq.length === 0 || emptyCrop.length > 0,
    detail: seq.length === 0 ? "The farm rotation is empty — add at least one season and crop on My Farm."
      : emptyCrop.length ? `${emptyCrop.length} season(s) have no crop.`
        : dup.length ? `Season slot repeated in the farm rotation (${dup.join(", ")}); check the season list.` : `${seq.length} consecutive seasons, each with one crop.`,
  });
  const unknown = seq.filter((s) => (s.cropId ?? "").trim() && !lookup(ctx, s.cropId));
  out.push({
    id: "crops-known", label: "Crops in manifest", passed: unknown.length === 0, blocking: unknown.length > 0,
    detail: unknown.length ? `Unknown crop(s): ${unknown.map((s) => `"${s.cropId}"`).join(", ")} — cannot be checked.` : "All crops are in the regional crop manifest.",
  });
  const outSeason = seq.filter((s) => { const c = lookup(ctx, s.cropId); return c && knownSeason(ctx, s.season) && !c.seasons.includes(s.season); });
  const unkSeason = [...new Set(seq.filter((s) => !knownSeason(ctx, s.season)).map((s) => s.season || "(blank)"))];
  out.push({
    id: "season", label: "Season suitability", passed: outSeason.length === 0 && unkSeason.length === 0, blocking: outSeason.length > 0,
    detail: [
      outSeason.length ? `Out of season: ${outSeason.map((s) => `${lookup(ctx, s.cropId)?.name} in ${s.season}`).join(", ")}.` : "",
      unkSeason.length ? `Season name(s) not recognised (${unkSeason.join(", ")}); suitability could not be checked.` : "",
    ].filter(Boolean).join(" ") || "Every crop is grown in its season in this region.",
  });
  const ph = ctx.soil?.ph;
  if (finite(ph)) {
    const off = seq.map((s) => lookup(ctx, s.cropId)).filter((c): c is CropRule => !!c && (ph < c.phRange.low || ph > c.phRange.high));
    const far = off.filter((c) => ph < c.phRange.low - PH_BLOCKING_MARGIN || ph > c.phRange.high + PH_BLOCKING_MARGIN);
    out.push({
      id: "ph", label: "Soil pH vs crop range", passed: off.length === 0, blocking: far.length > 0,
      detail: off.length ? `pH ${ph} is outside the range for ${[...new Set(off.map((c) => `${c.name} (${c.phRange.low}–${c.phRange.high})`))].join(", ")}.` : `pH ${ph} suits every crop in the plan.`,
    });
  }
  if (ctx.hasRain) {
    const bad = seq.filter((s) => slotBlockers(ctx, s).some((b) => b.includes("drought-sensitive")));
    const risk = waterRiskSlots(ctx, seq);
    out.push({
      id: "water", label: "Water supply vs need", passed: bad.length === 0 && risk.length === 0, blocking: bad.length > 0,
      detail: bad.length ? `Rainfed, drought-sensitive crop with rainfall well below need in ${bad.map(slotLabel).join(", ")}.`
        : risk.length ? `Possible water shortfall (supply < 80 % of need) in ${risk.map((i) => slotLabel(seq[i])).join(", ")}.` : "Expected rain plus irrigation covers crop water need in every season.",
    });
  }
  if (ctx.budget != null && ctx.area != null) {
    const costs = seasonCosts(ctx, seq);
    const peakLow = costs.length ? Math.max(...costs.map((c) => c.low)) : 0;
    const peakHigh = costs.length ? Math.max(...costs.map((c) => c.high)) : 0;
    out.push({
      id: "budget", label: "Input budget per season", passed: peakHigh <= ctx.budget, blocking: peakLow > ctx.budget,
      detail: peakLow > ctx.budget ? `Even the low-cost estimate for the costliest season (${kes(peakLow)}) exceeds the ${kes(ctx.budget)} budget.`
        : peakHigh > ctx.budget ? `The costliest season may exceed the ${kes(ctx.budget)} budget (up to ${kes(peakHigh)}).` : `Every season fits within the ${kes(ctx.budget)} budget.`,
    });
  }
  const restricted = seq.map((s) => lookup(ctx, s.cropId)).filter((c): c is CropRule => !!c?.restricted);
  out.push({
    id: "restricted", label: "Restricted crops", passed: restricted.length === 0, blocking: restricted.length > 0,
    detail: restricted.length ? `Restricted: ${[...new Set(restricted.map((c) => `${c.name} (${c.restricted})`))].join(", ")}.` : "No restricted crops.",
  });
  return out;
}

// ───────────────────────────── evidence ─────────────────────────────
function evidenceFor(ctx: Ctx, waterDemand: number | null, cost: { low: number; high: number } | null, score: number | null): Evidence[] {
  const ev: Evidence[] = [];
  if (ctx.climate) ev.push(...ctx.climate.evidence);
  const s = ctx.soil;
  if (s && (s.source === "SIMULATED_IOT" || s.source === "USER_SOIL_TEST")) {
    const label = s.source === "SIMULATED_IOT" ? "Simulated sensor" : "Farmer soil test";
    const add = (id: string, title: string, value: number | null | undefined, unit?: string) => {
      if (finite(value)) ev.push({ id, source: s.source, title: `${title} (${label})`, value, unit, period: s.timestamp, spatialScale: "field point" });
    };
    add("soil-moisture", "Soil moisture", s.moisturePct, "%");
    add("soil-ph", "Soil pH", s.ph);
    add("soil-n", "Soil nitrogen", s.n, "mg/kg");
    add("soil-p", "Soil phosphorus", s.p, "mg/kg");
    add("soil-k", "Soil potassium", s.k, "mg/kg");
  }
  ev.push({ id: "farmer-rotation", source: "FARMER_REPORTED", title: "Current crop rotation", value: ctx.current.map((x) => x.cropId).join(" → ") || null });
  ev.push({ id: "farmer-irrigation", source: "FARMER_REPORTED", title: "Irrigation access", value: ctx.farm.irrigation });
  ev.push({ id: "farmer-budget", source: "FARMER_REPORTED", title: "Input budget per season", value: ctx.budget, unit: "KES" });
  ev.push({ id: "farmer-area", source: "FARMER_REPORTED", title: "Farm area", value: ctx.area, unit: "ha" });
  ev.push({ id: "farmer-priorities", source: "FARMER_REPORTED", title: "Farmer priorities", value: ctx.farm.priorities.join(", ") || null });
  ev.push({ id: "model-water-balance", source: "MODEL_ESTIMATE", title: "Rotation crop water demand (mid estimate)", value: waterDemand, unit: "mm", note: "Sum of mid-range seasonal crop water need; estimate, not a measurement." });
  ev.push({ id: "model-cost", source: "MODEL_ESTIMATE", title: "Rotation input cost range", value: cost ? `${kes(cost.low)} – ${kes(cost.high)}` : null, unit: "KES", note: "Demonstration cost assumptions; estimate, not a quote." });
  ev.push({ id: "model-score", source: "MODEL_ESTIMATE", title: "Relative plan score (0–100)", value: score, note: "Relative comparison between the three plans, not a certified soil or yield rating." });
  return ev;
}

const climateIds = (ctx: Ctx, unitHint: string) => {
  const ev = ctx.climate?.evidence ?? [];
  const hit = ev.filter((e) => (e.unit ?? "").includes(unitHint));
  return (hit.length ? hit : ev).map((e) => e.id);
};

// ───────────────────────────── plan evaluation ─────────────────────────────
const TITLES: Record<PlanId, string> = { current: "Current rotation", minimum: "Minimum change", resilience: "Resilience-oriented" };

function evaluatePlan(ctx: Ctx, id: PlanId, seq: CropSeason[], extraConstraints: string[] = []): EvaluatedPlan {
  const changed = countChanged(seq, ctx.current);
  const comps = components(ctx, seq, changed);
  const chk = checks(ctx, seq);
  const feasible = extraConstraints.length === 0 && chk.every((c) => c.passed || !c.blocking);
  const score = feasible ? weightedScore(comps) : null;
  const knownCrops = seq.map((s) => lookup(ctx, s.cropId)).filter((c): c is CropRule => !!c);
  const waterDemand = knownCrops.length ? Math.round(knownCrops.reduce((a, c) => a + waterNeedMm(c), 0)) : null;
  const costs = seasonCosts(ctx, seq);
  const costRange = costs.length ? { low: roundKes(costs.reduce((a, c) => a + c.low, 0)), high: roundKes(costs.reduce((a, c) => a + c.high, 0)) } : null;
  const budgetCheck = chk.find((c) => c.id === "budget");
  const budgetFit: EvaluatedPlan["budgetFit"] = !budgetCheck ? "unknown" : budgetCheck.blocking ? "over" : budgetCheck.passed ? "within" : "over";

  // missing info (every unknown)
  const missing: string[] = [];
  if (!ctx.climate) missing.push("Climate context (NASA rainfall and temperature) unavailable — water and climate not scored");
  else {
    if (!ctx.hasRain) missing.push("Mean annual rainfall unknown — water not scored");
    if (!finite(ctx.meanT)) missing.push("Mean temperature unknown — climate fit not scored");
  }
  if (!ctx.soil) missing.push("Soil reading (no sensor or soil test)");
  else {
    if (!finite(ctx.soil.ph)) missing.push("Soil pH");
    if (!finite(ctx.soil.n)) missing.push("Soil nitrogen");
    if (!finite(ctx.soil.moisturePct)) missing.push("Soil moisture");
    if (ctx.soil.source !== "USER_SOIL_TEST") missing.push("Laboratory soil test (simulated sensor values used instead)");
  }
  if (ctx.area == null) missing.push("Farm area — costs shown per hectare");
  if (ctx.budget == null) missing.push("Input budget — budget fit not checked");
  for (const s of seq) {
    if ((s.cropId ?? "").trim() && !lookup(ctx, s.cropId)) missing.push(`Crop rules for "${s.cropId}"`);
    if (!knownSeason(ctx, s.season)) missing.push(`Season "${s.season || "(blank)"}" not recognised — rainfall share and suitability assumed`);
  }
  const missingInfo = [...new Set(missing)];

  // confidence (separate from score)
  const unknownBits = seq.some((s) => !lookup(ctx, s.cropId) || !knownSeason(ctx, s.season));
  let confidence: EvaluatedPlan["confidence"] = "low";
  if (ctx.climate && ctx.hasRain && finite(ctx.meanT) && ctx.soil && !unknownBits && seq.length) {
    confidence = ctx.soil.source === "USER_SOIL_TEST" && ctx.area != null && ctx.budget != null ? "high" : "medium";
  }

  // narrative
  const pairs = pestPairs(ctx, seq);
  const legumes = [...new Set(knownCrops.filter((c) => c.nitrogenFixing).map((c) => c.name))];
  const tolerant = knownCrops.filter((c) => c.droughtTolerance >= 4).length;
  const benefits: string[] = [];
  const risks: string[] = [];
  if (legumes.length) benefits.push(`Includes ${legumes.join(", ")} — legume(s) that fix some nitrogen and break cereal pest cycles.`);
  else if (seq.length) risks.push("No legume in the rotation: soil nitrogen is not replenished.");
  if (seq.length && !pairs.length) benefits.push("No back-to-back crops from the same pest group.");
  for (const [a, b] of pairs) {
    const c = lookup(ctx, seq[a].cropId);
    risks.push(a === b ? `${c?.name} every season: pest and disease build-up risk.` : `${c?.name} → ${lookup(ctx, seq[b].cropId)?.name} (${slotLabel(seq[a])} → ${slotLabel(seq[b])}) share the "${c?.pestGroup}" pest group.`);
  }
  if (tolerant) benefits.push(`Drought-tolerant crops in ${tolerant} of ${seq.length} seasons.`);
  for (const i of waterRiskSlots(ctx, seq)) risks.push(`Water shortfall risk for ${lookup(ctx, seq[i].cropId)?.name} in ${slotLabel(seq[i])}.`);
  for (const c of chk) if (!c.passed && !c.blocking && c.id !== "water") risks.push(c.detail);
  if (changed === 0 && id === "current") benefits.push("No change needed: familiar crops, seed and markets.");
  const constraints = [...extraConstraints, ...chk.filter((c) => !c.passed && c.blocking).map((c) => c.detail)];

  const reasons: Reason[] = [];
  const rainIds = climateIds(ctx, "mm");
  const tempIds = climateIds(ctx, "°C");
  const soilIds = (k: string) => (ctx.soil && finite((ctx.soil as Record<string, unknown>)[k] as number) ? [k === "moisturePct" ? "soil-moisture" : `soil-${k}`] : []);
  const wc = comps.find((c) => c.key === "water")!;
  if (wc.value != null) {
    const seasonsTxt = [...new Set(seq.map((s) => s.season))].map((s) => `${s} ≈${Math.round(seasonRainMm(ctx.climate, s) ?? 0)} mm`).join(", ");
    reasons.push({
      text: `Water fit ${wc.value}/100: expected rain (${seasonsTxt}) plus ${Math.round(irrigationMm(ctx.farm))} mm irrigation and ${Math.round(soilMoistureAdjMm(ctx.soil))} mm soil-moisture adjustment vs ≈${waterDemand ?? "?"} mm total crop need.`,
      evidenceIds: [...rainIds, "farmer-irrigation", ...soilIds("moisturePct"), "model-water-balance"],
      ruleIds: ["rule-water-balance", "src-fao-crop-info", "src-fao-33"],
    });
  }
  const sc = comps.find((c) => c.key === "soil")!;
  if (sc.value != null) reasons.push({ text: `Soil & rotation health ${sc.value}/100. ${sc.explanation}`, evidenceIds: ["farmer-rotation", ...soilIds("n"), ...soilIds("ph")], ruleIds: ["rule-pest-cycle", "rule-legume", "rule-nitrogen", "rule-ph", "asm-agronomy"] });
  const cc = comps.find((c) => c.key === "cost")!;
  if (cc.value != null) reasons.push({ text: `Input cost ${cc.value}/100: ${cc.explanation}`, evidenceIds: ["model-cost", ...(ctx.budget != null ? ["farmer-budget"] : []), ...(ctx.area != null ? ["farmer-area"] : [])], ruleIds: ["rule-budget", "asm-economics"] });
  const kc = comps.find((c) => c.key === "climate")!;
  if (kc.value != null) reasons.push({ text: `Climate fit ${kc.value}/100 against a ${ctx.meanT} °C mean temperature (historical, not a forecast).`, evidenceIds: tempIds, ruleIds: ["rule-heat", "asm-agronomy"] });
  reasons.push({ text: changed === 0 ? "Keeps the farmer's current crops in every season." : `Changes ${changed} of ${seq.length} seasons from the current rotation.`, evidenceIds: ["farmer-rotation"], ruleIds: ["rule-change"] });
  for (const c of constraints) reasons.push({ text: `Rejected before ranking: ${c}`, evidenceIds: ["farmer-rotation"], ruleIds: ["rule-feasibility"] });

  const evidence = evidenceFor(ctx, waterDemand, costRange, score);
  const changeSize: ChangeSize = changed === 0 ? "none" : changed <= 2 ? "small" : "large";
  return {
    id, seasons: seq.map((s) => ({ season: s.season, cropId: s.cropId, yearOffset: s.yearOffset })),
    feasible, constraints, benefits, risks, score, confidence,
    evidenceIds: evidence.map((e) => e.id),
    title: TITLES[id],
    summary: seq.length ? seq.map((s) => lookup(ctx, s.cropId)?.name ?? s.cropId ?? "?").join(" → ") : "No seasons",
    changeSize, changedSeasons: changed, checks: chk, components: comps, missingInfo,
    waterDemandMm: waterDemand, costRangeKes: costRange, costBasis: ctx.area == null ? "per_ha" : "farm", budgetFit,
    evidence, reasons,
  };
}

// ───────────────────────────── generation ─────────────────────────────
const sameSeq = (a: CropSeason[], b: CropSeason[]) => a.length === b.length && a.every((s, i) => normal(s.cropId) === normal(b[i].cropId));
const normal = (id: string) => (id ?? "").trim().toLowerCase();

/** In-season, unrestricted manifest crops for a slot (empty for unknown season names). */
function options(ctx: Ctx, slot: CropSeason): CropRule[] {
  if (!knownSeason(ctx, slot.season)) return [];
  return ctx.crops.filter((c) => c.seasons.includes(slot.season) && !c.restricted);
}

const lexLess = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
const lexCmp = (a: number[], b: number[]) => (lexLess(a, b) ? -1 : lexLess(b, a) ? 1 : 0);

function quickScore(ctx: Ctx, seq: CropSeason[]): number {
  return weightedScore(components(ctx, seq, countChanged(seq, ctx.current))) ?? -1;
}

/** Minimum change: fix the worst issue with 1 changed season (2 if needed), preferring familiar crops. */
function generateMinimum(ctx: Ctx): CropSeason[] | null {
  const cur = ctx.current;
  const base = issueVector(ctx, cur);
  const worst = base.findIndex((v) => v > 0);
  type Cand = { seq: CropSeason[]; vec: number[]; unfamiliar: number; score: number; order: number };
  let order = 0;
  const make = (changes: Array<[number, CropRule]>): Cand => {
    const seq = cur.map((s) => ({ ...s }));
    let unfamiliar = 0;
    for (const [i, c] of changes) {
      seq[i] = { ...seq[i], cropId: c.id };
      const inCurrent = cur.some((s) => lookup(ctx, s.cropId)?.id === c.id);
      if (!c.familiar && !inCurrent) unfamiliar++;
    }
    return { seq, vec: issueVector(ctx, seq), unfamiliar, score: quickScore(ctx, seq), order: order++ };
  };
  const singles: Cand[] = [];
  cur.forEach((s, i) => { for (const c of options(ctx, s)) if (c.id !== normal(s.cropId)) singles.push(make([[i, c]])); });
  if (!singles.length) return null;
  const rank = (a: Cand, b: Cand) => lexCmp(a.vec, b.vec) || a.unfamiliar - b.unfamiliar || b.score - a.score || a.order - b.order;
  const noWorse = (c: Cand) => c.vec[0] <= base[0];
  const fully = (c: Cand) => worst < 0 ? c.vec.every((v) => v === 0) : c.vec[worst] === 0 && c.vec.slice(0, worst).every((v) => v === 0);
  const pick = (cs: Cand[]) => cs.slice().sort(rank)[0];

  if (worst < 0) {
    // No issues: best-scoring single change (keeps all issue counts at zero if possible).
    return pick(singles.filter(fully).length ? singles.filter(fully) : singles).seq;
  }
  const t1 = singles.filter((c) => noWorse(c) && fully(c));
  if (t1.length) return pick(t1).seq;
  const doubles: Cand[] = [];
  for (let i = 0; i < cur.length; i++) for (let j = i + 1; j < cur.length; j++) {
    for (const a of options(ctx, cur[i])) {
      if (a.id === normal(cur[i].cropId)) continue;
      for (const b of options(ctx, cur[j])) if (b.id !== normal(cur[j].cropId)) doubles.push(make([[i, a], [j, b]]));
    }
  }
  const t2 = doubles.filter((c) => noWorse(c) && fully(c));
  if (t2.length) return pick(t2).seq;
  const t3 = singles.filter((c) => noWorse(c) && c.vec[worst] < base[worst]);
  if (t3.length) return pick(t3).seq;
  return pick(singles).seq;
}

/** Resilience: beam search for a drought/heat-tolerant, legume-including, pest-cycle-breaking sequence. */
function resilienceCandidates(ctx: Ctx): CropSeason[][] {
  const cur = ctx.current;
  const n = cur.length;
  if (!n) return [];
  const slotOpts: CropRule[][] = cur.map((s) => {
    const o = options(ctx, s);
    if (o.length) return o;
    const keep = lookup(ctx, s.cropId);
    return keep ? [keep] : [];
  });
  const fixedUnknown = cur.map((s, i) => slotOpts[i].length === 0 ? s.cropId : null);
  const unit = (c: CropRule, i: number) => {
    const slot = { ...cur[i], cropId: c.id };
    let v = slotBlockers(ctx, slot).length ? -1000 : 0;
    v += c.droughtTolerance * 12;
    if (finite(ctx.meanT)) v += clamp((c.heatStressAboveC - ctx.meanT) / 8, 0, 1) * 10;
    const sup = slotSupply(ctx, cur[i].season);
    if (sup != null) v += 20 * (1 - clamp(1 - sup / (WATER_RELIABILITY_BUFFER * waterNeedMm(c)), 0, 1));
    if (c.familiar) v += 2;
    return v;
  };
  const pair = (p: CropRule | null, c: CropRule | null) => {
    if (!p || !c) return 0;
    let v = 0;
    if (p.pestGroup === c.pestGroup) v -= 40;
    if (p.id === c.id) v -= 10;
    if (p.nitrogenFixing && !c.nitrogenFixing) v += 5;
    return v;
  };
  type Partial = { crops: (CropRule | null)[]; score: number; legumes: number; key: string };
  let beam: Partial[] = [{ crops: [], score: 0, legumes: 0, key: "" }];
  const W = 80;
  for (let i = 0; i < n; i++) {
    const next: Partial[] = [];
    for (const p of beam) {
      const prev = p.crops.length ? p.crops[p.crops.length - 1] : null;
      const opts: (CropRule | null)[] = slotOpts[i].length ? slotOpts[i] : [null];
      opts.forEach((c, k) => {
        let s = p.score + (c ? unit(c, i) + pair(prev, c) : 0);
        let legumes = p.legumes;
        if (c?.nitrogenFixing) { s += legumes === 0 ? 30 : legumes < 3 ? 5 : 0; legumes++; }
        next.push({ crops: [...p.crops, c], score: s, legumes, key: `${p.key}${String(k).padStart(2, "0")}` });
      });
    }
    next.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    beam = next.slice(0, W);
  }
  const final = beam.map((p) => {
    let s = p.score;
    if (n > 2) s += pair(p.crops[n - 1], p.crops[0]);
    if (n === 1 && p.crops[0]) s -= 40;
    s += new Set(p.crops.filter(Boolean).map((c) => c!.id)).size * 3;
    return { ...p, score: s };
  }).sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return final.map((p) => cur.map((s, i) => ({ season: s.season, yearOffset: s.yearOffset, cropId: p.crops[i]?.id ?? fixedUnknown[i] ?? s.cropId })));
}

// ───────────────────────────── public API ─────────────────────────────
export function evaluateRotations(
  farm: FarmProfile, climate: ClimateContext | null, soil: SoilInput | null, options?: EvaluateOptions,
): RotationEvaluation {
  const crops = options?.crops ?? CROPS;
  const current = (Array.isArray(farm?.rotation) ? farm.rotation : []).map((s) => ({
    season: typeof s?.season === "string" ? s.season : "", cropId: typeof s?.cropId === "string" ? s.cropId : "",
    yearOffset: finite(s?.yearOffset) ? s.yearOffset : 0,
  }));
  const ctx: Ctx = {
    farm, climate, soil, crops, area: effectiveArea(farm), budget: effectiveBudget(farm),
    meanT: finite(climate?.meanTemperatureC) ? (climate!.meanTemperatureC as number) : null,
    hasRain: finite(climate?.annualRainfallMm) && (climate!.annualRainfallMm as number) >= 0,
    weights: computeWeights(farm?.priorities ?? []), current,
  };
  const weights = ctx.weights;

  if (current.length === 0) {
    const msg = "The farm rotation is empty — add at least one season and crop on My Farm before plans can be compared.";
    const plans = PLAN_ORDER.map((id) => evaluatePlan(ctx, id, [], id === "current" ? [] : ["No alternative can be built without the farm's season slots."]));
    return { plans, recommendedId: null, recommendationReason: msg, weights, currency: "KES" };
  }

  const currentPlan = evaluatePlan(ctx, "current", current);
  const minSeq = generateMinimum(ctx);
  const minimum = minSeq
    ? evaluatePlan(ctx, "minimum", minSeq)
    : evaluatePlan(ctx, "minimum", current, ["No in-season alternative crop exists for these season names, so no minimum-change plan could be built."]);
  const worstBefore = issueVector(ctx, current).findIndex((v) => v > 0);
  if (minSeq && worstBefore >= 0) {
    const after = issueVector(ctx, minSeq)[worstBefore];
    const fixed = after < issueVector(ctx, current)[worstBefore];
    const text = fixed
      ? `Smallest change that addresses the current rotation's worst issue: ${ISSUE_NAMES[worstBefore]}${after === 0 ? "" : " (reduced, not removed)"}.`
      : `No 1–2 season change removes the worst issue (${ISSUE_NAMES[worstBefore]}); this is the best single change.`;
    minimum.reasons.unshift({ text, evidenceIds: ["farmer-rotation"], ruleIds: ["rule-minimum-change"] });
    if (fixed) minimum.benefits.unshift(text);
  } else if (minSeq) {
    minimum.reasons.unshift({ text: "The current rotation has no flagged issue; this is the best-scoring single-season change for comparison.", evidenceIds: ["farmer-rotation"], ruleIds: ["rule-minimum-change"] });
  }
  const taken = [current, minimum.seasons];
  const resSeq = resilienceCandidates(ctx);
  const distinct = resSeq.filter((s) => !taken.some((t) => sameSeq(s, t)));
  const feasibleFirst = distinct.find((s) => evaluatePlan(ctx, "resilience", s).feasible) ?? distinct[0];
  const resilience = feasibleFirst
    ? evaluatePlan(ctx, "resilience", feasibleFirst)
    : evaluatePlan(ctx, "resilience", current, ["No distinct resilience-oriented sequence could be built for these seasons (too few in-season crops)."]);

  resilience.reasons.unshift({ text: "Built by rule for the same season slots: favours drought- and heat-tolerant crops, includes a legume and avoids back-to-back crops from the same pest group.", evidenceIds: ["farmer-rotation"], ruleIds: ["rule-resilience", "rule-pest-cycle", "rule-legume"] });
  const plans = [currentPlan, minimum, resilience];
  const ranked = plans.filter((p) => p.feasible && p.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number) || a.changedSeasons - b.changedSeasons || PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
  const best = ranked[0] ?? null;
  const rejected = plans.filter((p) => !p.feasible).map((p) => p.title);
  let recommendationReason: string;
  if (!best) recommendationReason = `No plan passed every feasibility check (${rejected.join(", ")} rejected before ranking). Resolve the listed constraints first.`;
  else {
    const runner = ranked[1];
    recommendationReason = `${best.title} has the highest relative score (${best.score}/100) among feasible plans`
      + (runner ? `, ahead of ${runner.title} (${runner.score}/100)` : "")
      + (best.id === "current" ? "; keeping the current rotation is a legitimate choice." : ".")
      + (rejected.length ? ` Rejected before ranking: ${rejected.join(", ")}.` : "")
      + " Scores are relative estimates, not a guarantee.";
  }
  return { plans, recommendedId: best?.id ?? null, recommendationReason, weights, currency: "KES" };
}

/** Plain-language name of the worst issue in a sequence (for UI/explanations). */
export function describeWorstIssue(farm: FarmProfile, climate: ClimateContext | null, soil: SoilInput | null): string | null {
  const ctx: Ctx = {
    farm, climate, soil, crops: CROPS, area: effectiveArea(farm), budget: effectiveBudget(farm),
    meanT: finite(climate?.meanTemperatureC) ? (climate!.meanTemperatureC as number) : null,
    hasRain: finite(climate?.annualRainfallMm), weights: computeWeights(farm.priorities), current: farm.rotation ?? [],
  };
  const v = issueVector(ctx, ctx.current);
  const i = v.findIndex((x) => x > 0);
  return i < 0 ? null : ISSUE_NAMES[i];
}
