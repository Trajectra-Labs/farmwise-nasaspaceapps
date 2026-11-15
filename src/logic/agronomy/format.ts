// Moen · plain-text / JSON formatters for copy, share and download. Deterministic (no dates, no locale).
import type { Evidence, FarmProfile, SourceKind } from "@fw/contracts";
import { getCrop } from "./crops";
import type { DetailedScenarioResult, EvaluatedPlan, MetricRanges, Range, RotationEvaluation } from "./types";

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

function group(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "KES 120,000"; negative → "-KES 20,000"; null/non-finite → "Unknown". Rounded to whole shillings. */
export function formatKes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Unknown";
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}KES ${group(r)}`;
}

/** "KES 90,000 – KES 150,000" (uses formatKes by default); null → "Unknown". */
export function formatRange(r: Range | null | undefined, fmt: (n: number) => string = formatKes): string {
  if (!r || !Number.isFinite(r.low) || !Number.isFinite(r.high)) return "Unknown";
  return r.low === r.high ? fmt(r.low) : `${fmt(r.low)} – ${fmt(r.high)}`;
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
    `  Input cost: ${formatRange(p.costRangeKes)}${p.costBasis === "per_ha" ? " per ha" : " for the farm"} over the rotation (Model estimate) · Budget fit: ${p.budgetFit}`,
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
  lines.push("", "Labels: NASA offline snapshot = historical regional climate, not a forecast; Simulated sensor = synthetic demo reading, not a soil test; Model estimate = FarmWise calculation from stated assumptions.");
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

function metricLines(r: DetailedScenarioResult): string[] {
  const per = r.costBasis === "per_ha" ? " (per ha)" : "";
  const row = (label: string, key: keyof MetricRanges, f: (n: number) => string) =>
    `  ${label}: Current ${val(r.baseline[key], f)} [${formatRange(r.baselineRange[key], f)}] → Selected ${val(r.selected[key], f)} [${formatRange(r.selectedRange[key], f)}]`;
  return [
    row("Water need met (index)", "waterIndex", idxFmt),
    row("Yield index", "yieldIndex", idxFmt),
    row(`Estimated input cost${per}`, "estimatedCost", formatKes),
    row(`Estimated revenue${per}`, "estimatedRevenue", formatKes),
    row(`Estimated net return${per}`, "estimatedNetReturn", formatKes),
    `  Crop water demand: Current ${val(r.waterDemandMm.baseline, (n) => `${n} mm`)} → Selected ${val(r.waterDemandMm.selected, (n) => `${n} mm`)}; water available ${val(r.waterSupplyMm, (n) => `${n} mm`)}`,
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
    "Labels: climate inputs are a NASA offline snapshot (historical, not a forecast); soil moisture is a Simulated sensor reading unless a farmer soil test was entered; all outputs are Model estimate values.",
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
