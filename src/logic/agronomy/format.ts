// Moen · plain-text / JSON formatters for copy, share and download. Deterministic (no dates, no locale).
import type { ClimateContext, Evidence, FarmProfile, SoilInput, SourceKind } from "@fw/contracts";
import { getCrop } from "./crops";
import type { ClimateProvenance, DataProvenance, DetailedScenarioResult, EvaluatedPlan, MetricRanges, Range, RotationEvaluation } from "./types";

export const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  NASA_OBSERVED: "NASA observed",
  NASA_OFFLINE_SNAPSHOT: "NASA offline snapshot",
  SIMULATED_IOT: "Simulated sensor",
  FARMER_REPORTED: "Farmer input",
  USER_SOIL_TEST: "Farmer soil test",
  DEMO_IMAGE: "Demo example",
  MODEL_ESTIMATE: "Model estimate",
};
export const sourceLabel = (s: SourceKind) => SOURCE_LABELS[s] ?? s;

/** Provenance of a climate context, read from its own evidence/snapshot flag/period (null when absent). */
export function climateProvenance(climate: ClimateContext | null | undefined): ClimateProvenance | null {
  if (!climate) return null;
  const ev = climate.evidence ?? [];
  const main = ev.find((e) => e.source.startsWith("NASA_")) ?? ev[0];
  const source = main?.source ?? null;
  return {
    source, label: source ? sourceLabel(source) : "Climate data (source not stated)",
    snapshot: !!climate.snapshot, period: climate.observedPeriod || "period not stated",
    spatialScale: main?.spatialScale ?? null,
  };
}

export function dataProvenance(climate: ClimateContext | null | undefined, soil: SoilInput | null | undefined): DataProvenance {
  return { climate: climateProvenance(climate), soil: soil?.source ?? null };
}

/** One honest sentence about the climate data actually used. */
export function describeClimateSource(p: ClimateProvenance | null): string {
  if (!p) return "No climate data was available, so rainfall- and temperature-based estimates are left unknown.";
  return `Climate inputs: ${p.label}${p.snapshot && p.source !== "NASA_OFFLINE_SNAPSHOT" ? " (offline snapshot)" : ""}, ${p.period}`
    + `${p.spatialScale ? " — regional grid scale, not your field" : ""}; historical observations, not a forecast.`;
}

const SOIL_EXPLAIN: Partial<Record<SourceKind, string>> = {
  SIMULATED_IOT: "Simulated sensor = synthetic demo soil reading, not a soil test",
  USER_SOIL_TEST: "Farmer soil test = soil values entered by the farmer",
};

/** Legend line listing only the provenance labels that were actually used. */
function labelLine(p: DataProvenance): string {
  const parts: string[] = [];
  if (p.climate) parts.push(`${p.climate.label}${p.climate.snapshot && p.climate.source !== "NASA_OFFLINE_SNAPSHOT" ? " (offline snapshot)" : ""} = historical climate (${p.climate.period}), not a forecast`);
  else parts.push("Climate: not available (water/yield estimates unknown)");
  if (p.soil && SOIL_EXPLAIN[p.soil]) parts.push(SOIL_EXPLAIN[p.soil] as string);
  else if (p.soil) parts.push(`${sourceLabel(p.soil)} soil values`);
  else parts.push("Soil: no reading used");
  parts.push("Model estimate = FarmWise calculation from stated assumptions");
  return `Labels: ${parts.join("; ")}.`;
}

export const DISCLAIMER = "FarmWise figures are estimates, not guaranteed income, and not agronomic advice or a soil test. Check locally before acting.";

/** Display name for a crop id; unknown ids are returned title-cased with "(unknown crop)". */
export function cropName(id: string): string {
  const c = getCrop(id ?? "");
  if (c) return c.name;
  const raw = (id ?? "").trim();
  if (!raw) return "No crop";
  const pretty = raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  return `${pretty} (unknown crop)`;
}

export const MINUS = "\u2212";

/** en-US grouping, minus sign U+2212; null/non-finite → "Unknown". "1,631"; formatNumber(16.64, 1) → "16.6". */
export function formatNumber(n: number | null | undefined, maxFractionDigits = 0): string {
  if (n == null || !Number.isFinite(n)) return "Unknown";
  const digits = Math.max(0, Math.min(20, Math.floor(maxFractionDigits)));
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  const s = Math.abs(r).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  return r < 0 ? `${MINUS}${s}` : s;
}

/** "KES 120,000"; negative → "−KES 20,000" (U+2212); null/non-finite → "Unknown". Whole shillings. */
export function formatKes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Unknown";
  const r = Math.round(n);
  return `${r < 0 ? MINUS : ""}KES ${formatNumber(Math.abs(r))}`;
}

/** "+KES 1,000" / "−KES 1,000" / "KES 0"; null/non-finite → "Unknown". */
export function formatSignedKes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Unknown";
  const r = Math.round(n);
  return r > 0 ? `+${formatKes(r)}` : formatKes(r);
}

/** "KES 330,000 – 560,000" (currency once, en dash); any negative end → "−KES 260,000 to KES 1,332,000"; equal ends → "KES 330,000"; null → "Unknown". */
export function formatKesRange(r: Range | null | undefined): string {
  if (!r || !Number.isFinite(r.low) || !Number.isFinite(r.high)) return "Unknown";
  if (Math.round(r.low) < 0 || Math.round(r.high) < 0) return `${formatKes(r.low)} to ${formatKes(r.high)}`;
  const lo = formatNumber(Math.round(r.low)), hi = formatNumber(Math.round(r.high));
  return lo === hi ? `KES ${lo}` : `KES ${lo} \u2013 ${hi}`;
}

/** "1,631 mm"; null/non-finite → "Unknown". */
export function formatMm(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "Unknown" : `${formatNumber(n)} mm`;
}

/** Generic range (kept for compatibility): "KES 90,000 – KES 150,000" with formatKes; null → "Unknown".
 * Prefer formatKesRange for money. */
export function formatRange(r: Range | null | undefined, fmt: (n: number) => string = formatKes): string {
  if (!r || !Number.isFinite(r.low) || !Number.isFinite(r.high)) return "Unknown";
  return r.low === r.high ? fmt(r.low) : `${fmt(r.low)} \u2013 ${fmt(r.high)}`;
}

const idxFmt = (n: number) => `${Math.round(n)}/100`;
const val = (v: number | null | undefined, f: (n: number) => string) => (v == null || !Number.isFinite(v) ? "Unknown" : f(v));

function planBlock(p: EvaluatedPlan, recommended: boolean): string[] {
  const lines = [
    `${p.title}${recommended ? " (recommended)" : ""}`,
    `  Sequence: ${p.seasons.map((s) => `${s.season} y${s.yearOffset + 1}: ${cropName(s.cropId)}`).join(" → ") || "No seasons"}`,
    `  Feasible: ${p.feasible ? "yes" : "no — rejected before ranking"}`,
    `  Score: ${p.score == null ? "not ranked" : `${p.score}/100 (relative, Model estimate)`} · Confidence: ${p.confidence}`,
    `  Change: ${p.changeSize} (${p.changedSeasons} season${p.changedSeasons === 1 ? "" : "s"} changed)`,
    `  Input cost: ${formatKesRange(p.costRangeKes)}${p.costBasis === "per_ha" ? " per ha" : " for the farm"} over the rotation (Model estimate) · Budget fit: ${p.budgetFit}`,
  ];
  if (p.waterDemandMm != null) lines.push(`  Crop water need: ≈${p.waterDemandMm} mm over the rotation (Model estimate)`);
  for (const c of p.constraints) lines.push(`  Constraint: ${c}`);
  for (const r of p.risks) lines.push(`  Risk: ${r}`);
  for (const b of p.benefits) lines.push(`  Benefit: ${b}`);
  if (p.missingInfo.length) lines.push(`  Unknown: ${p.missingInfo.join("; ")}`);
  return lines;
}

function sourcesUsed(evidence: Evidence[]): string[] {
  const seen = new Map<string, Evidence>();
  for (const e of evidence) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].filter((e) => e.source !== "FARMER_REPORTED" && e.source !== "MODEL_ESTIMATE").map((e) =>
    `- ${e.title}: ${e.value ?? "unknown"}${e.unit ? ` ${e.unit}` : ""} [${sourceLabel(e.source)}]${e.period ? ` (${e.period})` : ""}`);
}

function provenanceFromEvidence(evidence: Evidence[]): DataProvenance {
  const nonClimate: SourceKind[] = ["FARMER_REPORTED", "MODEL_ESTIMATE", "SIMULATED_IOT", "USER_SOIL_TEST", "DEMO_IMAGE"];
  const clim = evidence.find((e) => !nonClimate.includes(e.source));
  const soil = evidence.find((e) => e.id.startsWith("soil-"));
  return {
    climate: clim ? { source: clim.source, label: sourceLabel(clim.source), snapshot: clim.source === "NASA_OFFLINE_SNAPSHOT", period: clim.period ?? "period not stated", spatialScale: clim.spatialScale ?? null } : null,
    soil: soil?.source ?? null,
  };
}

function isEvaluation(x: unknown): x is RotationEvaluation {
  return !!x && typeof x === "object" && Array.isArray((x as RotationEvaluation).plans);
}

/** Clipboard text for the three rotation plans. Accepts (evaluation, farmName) or (farm, evaluation). */
export function formatRotationSummary(evaluation: RotationEvaluation, farmName: string): string;
export function formatRotationSummary(farm: FarmProfile, evaluation: RotationEvaluation): string;
export function formatRotationSummary(a: RotationEvaluation | FarmProfile, b: string | RotationEvaluation): string {
  const evaluation = isEvaluation(a) ? a : (b as RotationEvaluation);
  const farmName = isEvaluation(a) ? String(b ?? "") : (a as FarmProfile)?.name ?? "";
  const lines = [`FarmWise rotation comparison — ${farmName || "Unnamed farm"}`, ""];
  const rec = evaluation.recommendedId;
  lines.push(`Recommendation: ${rec ? evaluation.plans.find((p) => p.id === rec)?.title : "none (no feasible plan)"}`);
  lines.push(evaluation.recommendationReason, "");
  for (const p of evaluation.plans) lines.push(...planBlock(p, p.id === rec), "");
  const w = evaluation.weights;
  lines.push(`Score weights: water ${w.water}, soil ${w.soil}, cost ${w.cost}, climate ${w.climate}, change ${w.change}. Currency: ${evaluation.currency}.`);
  const src = sourcesUsed(evaluation.plans.flatMap((p) => p.evidence));
  if (src.length) lines.push("", "Data used:", ...src);
  lines.push("", labelLine(evaluation.provenance ?? provenanceFromEvidence(evaluation.plans.flatMap((p) => p.evidence))));
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

function metricLines(r: DetailedScenarioResult): string[] {
  const per = r.costBasis === "per_ha" ? " (per ha)" : "";
  const row = (label: string, key: keyof MetricRanges, f: (n: number) => string) => {
    const rf = (x: Range | null) => (f === formatKes ? formatKesRange(x) : formatRange(x, f));
    return `  ${label}: Current ${val(r.baseline[key], f)} [${rf(r.baselineRange[key])}] → Selected ${val(r.selected[key], f)} [${rf(r.selectedRange[key])}]`;
  };
  return [
    row("Water need met (index)", "waterIndex", idxFmt),
    row("Yield index", "yieldIndex", idxFmt),
    row(`Estimated input cost${per}`, "estimatedCost", formatKes),
    row(`Estimated revenue${per}`, "estimatedRevenue", formatKes),
    row(`Estimated net return${per}`, "estimatedNetReturn", formatKes),
    `  Crop water demand: Current ${formatMm(r.waterDemandMm.baseline)} → Selected ${formatMm(r.waterDemandMm.selected)}; water available ${formatMm(r.waterSupplyMm)}`,
  ];
}

export function formatScenarioSummary(
  result: DetailedScenarioResult, opts: { planTitle: string; farmName: string; presetLabel: string | null },
): string {
  const i = result.inputs;
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const lines = [
    `FarmWise scenario — ${opts.farmName || "Unnamed farm"}`,
    `Selected plan: ${opts.planTitle} · compared with the current rotation`,
    `Scenario: ${opts.presetLabel ?? "Custom"} — rainfall ${sign(i.rainfallDeltaPct)} %, temperature ${sign(i.temperatureDeltaC)} °C, irrigation ${i.irrigationPct} % of normal, input costs ${sign(i.inputCostDeltaPct)} %`,
    "",
    "Results (Model estimate; point value [low – high range]):",
    ...metricLines(result),
    "",
    "Uncertainty:", ...result.uncertainty.map((u) => `- ${u}`),
    "", "Assumptions:", ...result.assumptions.map((a) => `- ${a}`),
    "",
    describeClimateSource(result.provenance?.climate ?? null),
    labelLine(result.provenance ?? { climate: null, soil: null }),
    DISCLAIMER,
  ];
  return lines.join("\n");
}

/** Pretty JSON for download. Accepts (evaluation) or (farm, evaluation). Deterministic: no timestamp. */
export function rotationEvaluationToJSON(evaluation: RotationEvaluation): string;
export function rotationEvaluationToJSON(farm: FarmProfile, evaluation: RotationEvaluation): string;
export function rotationEvaluationToJSON(a: RotationEvaluation | FarmProfile, b?: RotationEvaluation): string {
  const evaluation = isEvaluation(a) ? a : (b as RotationEvaluation);
  const farm = isEvaluation(a) ? null : (a as FarmProfile);
  return JSON.stringify({
    generator: "FarmWise rotation model (deterministic demo)",
    disclaimer: DISCLAIMER,
    farm: farm ? { id: farm.id, name: farm.name, areaHa: farm.areaHa ?? null, irrigation: farm.irrigation, budget: farm.budget ?? null, priorities: farm.priorities } : undefined,
    sourceLabels: SOURCE_LABELS,
    ...evaluation,
  }, null, 2);
}
