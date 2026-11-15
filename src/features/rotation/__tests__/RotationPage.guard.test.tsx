// R05 guard: even if the model ever returned an infeasible recommendedId, the UI must not present it
// as recommended, must not score it, and must not let it be sent to scenarios.
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EvaluatedPlan, RotationEvaluation } from "../../../logic/agronomy/types";
import { card, radioFor, renderRotation, waitForPlans } from "./helpers";

function plan(id: EvaluatedPlan["id"], feasible: boolean, score: number | null): EvaluatedPlan {
  return {
    id, title: `${id} plan`, summary: `${id} summary`, feasible, score, confidence: "medium",
    seasons: [
      { season: "Long rains", cropId: "maize", yearOffset: 0 },
      { season: "Short rains", cropId: id === "current" ? "maize" : "beans", yearOffset: 0 },
    ],
    constraints: feasible ? [] : ["Blocked by a restricted crop"], benefits: ["b"], risks: ["r"], evidenceIds: [],
    changeSize: id === "current" ? "none" : "small", changedSeasons: id === "current" ? 0 : 1,
    checks: [{ id: "c1", label: "Restricted crops", passed: feasible, blocking: true, detail: feasible ? "ok" : "restricted crop" }],
    components: [{ key: "water", label: "Water", weight: 1, value: feasible ? 60 : null, explanation: "x" }],
    missingInfo: [], waterDemandMm: 1234, costRangeKes: { low: 81234, high: 120499 }, costBasis: "farm", budgetFit: "within",
    evidence: [], reasons: [],
  };
}
const EVAL: RotationEvaluation = {
  plans: [plan("current", true, 55), plan("minimum", true, 60), plan("resilience", false, 90)],
  recommendedId: "resilience", // deliberately wrong
  recommendationReason: "test",
  weights: { water: 0.3, soil: 0.25, cost: 0.2, climate: 0.15, change: 0.1 },
  currency: "KES",
};

vi.mock("../../../logic/agronomy", async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return { ...real, evaluateRotations: () => EVAL };
});

describe("Rotation Planner recommendation guard", () => {
  it("R05: an infeasible plan never shows Recommended, is not scored and cannot be used in scenarios", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const res = card("resilience");
    expect(within(res).getByText("Not feasible")).toBeInTheDocument();
    expect(within(res).queryByTestId("recommended-badge")).toBeNull();
    expect(within(res).getByTestId("score-resilience")).toHaveTextContent("Not scored — infeasible");
    expect(screen.queryAllByTestId("recommended-badge")).toHaveLength(0);
    await user.click(radioFor("resilience"));
    const details = screen.getByTestId("plan-details");
    expect(within(details).queryByText("Recommended")).toBeNull();
    const use = within(details).getByRole("button", { name: "Use in scenarios" });
    expect(use).toBeDisabled();
    expect(use).toHaveAccessibleDescription(/turned off for this plan/);
    // weights shown as percentages; costs rounded to thousands (R10)
    expect(within(details).getByRole("cell", { name: "30%" })).toBeInTheDocument();
    expect(res).toHaveTextContent("KES 81,000 – 120,000");
    expect(res).toHaveTextContent("≈ 1,230 mm");
  });
});
