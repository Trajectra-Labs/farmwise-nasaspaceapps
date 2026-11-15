// Moen · Scenario Studio presentation helpers (pure, no React). Numbers come only from
// runScenario(); this file just turns them into honest, finite display strings.
import type { ScenarioInputs } from "@fw/contracts";
import type { DetailedScenarioResult, Range } from "../../logic/agronomy/types";
import { formatKes } from "../../logic/agronomy";

export const UNKNOWN = "Unknown";
const MINUS = "−";

export const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Signed number with a real minus sign; "±0" for zero. */
export function signed(v: number, digits = 0, unit = ""): string {
  const r = Number(v.toFixed(digits));
  const abs = Math.abs(r).toFixed(digits);
  if (r === 0) return `±${abs}${unit}`;
  return `${r > 0 ? "+" : MINUS}${abs}${unit}`;
}

export const fmtPct = (v: number) => signed(v, 0, "%");
export const fmtTemp = (v: number) => signed(v, 1, " °C");
export const fmtIrrigation = (v: number) => `${Math.round(v)}%`;

export type MetricKind = "mm" | "index" | "kes";
export type MetricKey = "waterDemand" | "waterIndex" | "yieldIndex" | "estimatedCost" | "estimatedRevenue" | "estimatedNetReturn";
export type MetricRow = {
  key: MetricKey; label: string; unit: string; kind: MetricKind;
  /** true when a higher number is better for the farmer (used only for the wording of the change). */
  higherIsBetter: boolean | null;
  baseline: number | null; selected: number | null;
  baselineRange: Range | null; selectedRange: Range | null;
  /** Selected plan under Typical (default) conditions; undefined when the scenario already is Typical. */
  typical?: number | null;
};

const clean = (v: number | null | undefined) => (isNum(v) ? v : null);
const cleanRange = (r: Range | null | undefined): Range | null => (r && isNum(r.low) && isNum(r.high) ? r : null);

export function buildMetricRows(result: DetailedScenarioResult, typical?: DetailedScenarioResult | null): MetricRow[] {
  const rows = rowsOf(result);
  if (!typical) return rows;
  const t = rowsOf(typical);
  return rows.map((r, i) => ({ ...r, typical: t[i].selected }));
}

function rowsOf(result: DetailedScenarioResult): MetricRow[] {
  const b = result.baseline, s = result.selected, br = result.baselineRange, sr = result.selectedRange;
  const perHa = result.costBasis === "per_ha";
  const kesUnit = perHa ? "KES per ha, whole rotation" : "KES, whole farm & rotation";
  return [
    { key: "waterDemand", label: "Water demand", unit: "mm over rotation", kind: "mm", higherIsBetter: false,
      baseline: clean(result.waterDemandMm.baseline), selected: clean(result.waterDemandMm.selected), baselineRange: null, selectedRange: null },
    { key: "waterIndex", label: "Water index", unit: "relative index, 0–100", kind: "index", higherIsBetter: true,
      baseline: clean(b.waterIndex), selected: clean(s.waterIndex), baselineRange: cleanRange(br.waterIndex), selectedRange: cleanRange(sr.waterIndex) },
    { key: "yieldIndex", label: "Yield index", unit: "relative index, 0–100", kind: "index", higherIsBetter: true,
      baseline: clean(b.yieldIndex), selected: clean(s.yieldIndex), baselineRange: cleanRange(br.yieldIndex), selectedRange: cleanRange(sr.yieldIndex) },
    { key: "estimatedCost", label: "Estimated cost", unit: kesUnit, kind: "kes", higherIsBetter: false,
      baseline: clean(b.estimatedCost), selected: clean(s.estimatedCost), baselineRange: cleanRange(br.estimatedCost), selectedRange: cleanRange(sr.estimatedCost) },
    { key: "estimatedRevenue", label: "Estimated revenue", unit: kesUnit, kind: "kes", higherIsBetter: true,
      baseline: clean(b.estimatedRevenue), selected: clean(s.estimatedRevenue), baselineRange: cleanRange(br.estimatedRevenue), selectedRange: cleanRange(sr.estimatedRevenue) },
    { key: "estimatedNetReturn", label: "Estimated net return", unit: kesUnit, kind: "kes", higherIsBetter: true,
      baseline: clean(b.estimatedNetReturn), selected: clean(s.estimatedNetReturn), baselineRange: cleanRange(br.estimatedNetReturn), selectedRange: cleanRange(sr.estimatedNetReturn) },
  ];
}

export function fmtValue(kind: MetricKind, v: number | null): string {
  if (!isNum(v)) return UNKNOWN;
  if (kind === "kes") return formatKes(v);
  if (kind === "mm") return `${Math.round(v).toLocaleString("en-US")} mm`;
  return String(Math.round(v));
}

export function fmtRangeOf(kind: MetricKind, r: Range | null): string | null {
  if (!r) return null;
  return `${fmtValue(kind, r.low)} – ${fmtValue(kind, r.high)}`;
}

export function deltaOf(row: MetricRow): number | null {
  return isNum(row.baseline) && isNum(row.selected) ? row.selected - row.baseline : null;
}

export function fmtDelta(kind: MetricKind, d: number | null): string {
  if (!isNum(d)) return UNKNOWN;
  if (kind === "kes") {
    const rounded = Math.round(d / 100) * 100;
    if (rounded === 0) return "±KES 0";
    return `${rounded > 0 ? "+" : MINUS}${formatKes(Math.abs(rounded))}`;
  }
  if (kind === "mm") return signed(d, 0, " mm");
  return signed(d, 0);
}

/** "better" / "worse" / "same" — used for a text cue next to the change (never colour alone). */
export function deltaDirection(row: MetricRow): "better" | "worse" | "same" | "unknown" {
  const d = deltaOf(row);
  if (!isNum(d) || row.higherIsBetter == null) return "unknown";
  const eps = row.kind === "kes" ? 50 : 0.5;
  if (Math.abs(d) < eps) return "same";
  return (d > 0) === row.higherIsBetter ? "better" : "worse";
}

export function sameInputs(a: ScenarioInputs, b: ScenarioInputs): boolean {
  return a.rainfallDeltaPct === b.rainfallDeltaPct && a.temperatureDeltaC === b.temperatureDeltaC
    && a.irrigationPct === b.irrigationPct && a.inputCostDeltaPct === b.inputCostDeltaPct;
}
