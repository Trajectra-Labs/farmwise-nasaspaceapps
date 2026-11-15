// Moen · Rotation Planner display helpers.
import { formatMm } from "../../logic/agronomy";
import type { ChangeSize, EvaluatedPlan } from "../../logic/agronomy/types";

/** Shared formatters from the model (single source of truth for KES / mm / number formatting). */
export { formatKes, formatKesRange, formatMm, formatNumber } from "../../logic/agronomy";

/** Water demand: "≈ 2,350 mm" (the model already rounds); null → "Unknown". */
export function waterText(mm: number | null | undefined): string {
  return mm == null || !Number.isFinite(mm) ? "Unknown" : `≈ ${formatMm(mm)}`;
}
export function scoreText(plan: Pick<EvaluatedPlan, "feasible" | "score">): string {
  if (!plan.feasible) return "Not scored — infeasible";
  if (plan.score == null) return "Not scored — missing information";
  return `${Math.round(plan.score)} / 100`;
}
export function changeText(size: ChangeSize, changed: number, total: number): string {
  if (size === "none" || changed === 0) return "No change";
  return `${size === "small" ? "Small" : "Large"} change · ${changed} of ${total} seasons`;
}
export const budgetFitText: Record<EvaluatedPlan["budgetFit"], string> = {
  within: "Within budget per season",
  over: "May exceed budget per season",
  unknown: "Budget not given",
};
export const confidenceText = (c: EvaluatedPlan["confidence"]) => `${c[0].toUpperCase()}${c.slice(1)} confidence`;
export const yearSeason = (yearOffset: number, season: string) => `Year ${yearOffset + 1} · ${season}`;
export const soilImplication = (p: EvaluatedPlan) =>
  p.components.find((c) => c.key === "soil")?.explanation ?? "Unknown — soil effect not assessed.";
export const topRisk = (p: EvaluatedPlan) => p.risks[0] ?? "No major risk flagged by the rules.";
/** Weights may be fractions (0–1) or percentages; always show a whole percent. */
export const weightPct = (w: number) => `${Math.round(w <= 1 ? w * 100 : w)}%`;
