// Moen · the only place the Rotation Planner touches presentation helpers from src/logic/agronomy.
import type { FarmProfile } from "@fw/contracts";
import { cropName, formatRotationSummary, rotationEvaluationToJSON, SOURCES } from "../../logic/agronomy";
import type { RotationEvaluation, SourceRef } from "../../logic/agronomy/types";

export function cropLabel(cropId: string): string {
  try {
    return cropName(cropId) || cropId;
  } catch {
    return cropId;
  }
}

export function summaryText(farm: FarmProfile, evaluation: RotationEvaluation): string {
  return formatRotationSummary(farm, evaluation);
}

export function evaluationJson(farm: FarmProfile, evaluation: RotationEvaluation): string {
  return rotationEvaluationToJSON(farm, evaluation);
}

const SOURCE_BY_ID = new Map<string, SourceRef>(Object.values(SOURCES as Record<string, SourceRef>).map((s) => [s.id, s]));

/**
 * Resolve a reason's rule id to a citation. Published FAO/agronomy sources come from the model's
 * SOURCES manifest; internal "rule-*" ids are FarmWise model rules and are labelled as assumptions.
 */
export function ruleSource(id: string): SourceRef {
  const known = SOURCE_BY_ID.get(id);
  if (known) return known;
  const name = id.replace(/^rule-/, "").replace(/[-_]+/g, " ");
  return { id, kind: "assumption", title: `FarmWise model rule: ${name} (team assumption, see model notes)` };
}
