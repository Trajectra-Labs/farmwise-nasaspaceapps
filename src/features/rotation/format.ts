// Moen · Rotation Planner display helpers. Rounding is deliberate (R10: no false precision).
import type { ChangeSize, EvaluatedPlan, Range } from "../../logic/agronomy/types";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Round KES to the nearest 1,000 (or 100 below 10,000) so estimates never look exact. */
export function roundKes(n: number): number {
  const step = Math.abs(n) >= 10_000 ? 1000 : 100;
  return Math.round(n / step) * step;
}
export const kes = (n: number) => `KES ${nf.format(roundKes(n))}`;
export function kesRange(r: Range | null | undefined): string {
  if (!r) return "Unknown";
  const lo = roundKes(r.low), hi = roundKes(r.high);
  return lo === hi ? `KES ≈ ${nf.format(lo)}` : `KES ${nf.format(lo)} – ${nf.format(hi)}`;
}
/** Water demand rounded to 10 mm. */
export function waterText(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return "Unknown";
  return `≈ ${nf.format(Math.round(mm / 10) * 10)} mm`;
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
  within: "Within budget",
  over: "Over budget",
  unknown: "Budget not given",
};
export const confidenceText = (c: EvaluatedPlan["confidence"]) => `${c[0].toUpperCase()}${c.slice(1)} confidence`;
export const yearSeason = (yearOffset: number, season: string) => `Year ${yearOffset + 1} · ${season}`;
export const soilImplication = (p: EvaluatedPlan) =>
  p.components.find((c) => c.key === "soil")?.explanation ?? "Unknown — soil effect not assessed.";
export const topRisk = (p: EvaluatedPlan) => p.risks[0] ?? "No major risk flagged by the rules.";
/** Weights may be fractions (0–1) or percentages; always show a whole percent. */
export const weightPct = (w: number) => `${Math.round(w <= 1 ? w * 100 : w)}%`;
