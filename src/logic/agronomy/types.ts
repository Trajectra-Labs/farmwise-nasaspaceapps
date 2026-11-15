// Moen · public types for the deterministic agronomy model. Narrow typed EXTENSIONS of the frozen
// contracts (PRD §4 allows feature-local extensions; src/contracts is never edited).
import type {
  ClimateContext, CropSeason, Evidence, FarmProfile, MetricSet, RotationPlan, ScenarioInputs, ScenarioResult, SoilInput,
} from "@fw/contracts";

export type PlanId = RotationPlan["id"];
export const PLAN_ORDER: readonly PlanId[] = ["current", "minimum", "resilience"] as const;

/** Where a rule/number came from. kind "assumption" = team assumption, must be labelled as such in UI. */
export type SourceRef = { id: string; title: string; url?: string; kind: "published" | "assumption" };
export type Range = { low: number; high: number };

export type CropFamily = "cereal" | "legume" | "root_tuber" | "vegetable" | "oilseed";
export type CropRule = {
  id: string; name: string; family: CropFamily;
  /** Season names (must match FarmProfile CropSeason.season strings) in which the crop can be grown. */
  seasons: string[];
  /** Seasonal crop water requirement, mm per season (FAO CROPWAT-style ranges). */
  waterNeedMm: Range;
  /** 1 (sensitive) … 5 (very tolerant). */
  droughtTolerance: 1 | 2 | 3 | 4 | 5;
  /** Mean seasonal temperature above which yield risk rises sharply, °C. */
  heatStressAboveC: number;
  nitrogenFixing: boolean;
  /** Pest/disease cycle group; same group in consecutive seasons = pest-cycle risk. */
  pestGroup: string;
  phRange: Range;
  yieldTPerHa: Range & { typical: number };
  priceKesPerT: Range;
  costKesPerHa: Range;
  soilEffect: string;
  marketNote?: string;
  /** e.g. not allowed / restricted market — a plan using a restricted crop cannot be "safe best". */
  restricted?: string | null;
  sources: SourceRef[];
  /** (Added) FAO-33 seasonal yield-response factor Ky; default 1.0 when absent. */
  ky?: number;
  /** (Added) Commonly grown locally — preferred by the minimum-change plan. */
  familiar?: boolean;
};

export type ScoreKey = "water" | "soil" | "cost" | "climate" | "change";
export type ScoreComponent = {
  key: ScoreKey; label: string; weight: number;
  /** 0–100 relative sub-score, or null when the inputs it needs are missing. */
  value: number | null;
  explanation: string;
};
export type FeasibilityCheck = { id: string; label: string; passed: boolean; blocking: boolean; detail: string };
export type ChangeSize = "none" | "small" | "large";
export type Reason = { text: string; evidenceIds: string[]; ruleIds: string[] };

export type EvaluatedPlan = RotationPlan & {
  title: string; summary: string;
  changeSize: ChangeSize; changedSeasons: number;
  checks: FeasibilityCheck[];
  components: ScoreComponent[];
  missingInfo: string[];
  /** Sum over the rotation of mid-range crop water need, mm per ha. */
  waterDemandMm: number | null;
  /** Total input cost range for the whole rotation for the farm area (or per ha when area unknown), KES. */
  costRangeKes: Range | null;
  costBasis: "farm" | "per_ha";
  budgetFit: "within" | "over" | "unknown";
  /** All evidence objects referenced by evidenceIds (climate, soil, farmer, model). */
  evidence: Evidence[];
  reasons: Reason[];
};

export type RotationEvaluation = {
  /** Always exactly 3 plans in PLAN_ORDER. */
  plans: EvaluatedPlan[];
  /** Highest-scoring FEASIBLE plan, or null if none feasible / no scores. Never an infeasible plan. */
  recommendedId: PlanId | null;
  recommendationReason: string;
  weights: Record<ScoreKey, number>;
  currency: "KES";
};

export type ScenarioPresetId = "typical" | "drier" | "hotter" | "costlier";
export type ScenarioPreset = { id: ScenarioPresetId; label: string; description: string; inputs: ScenarioInputs };
export type SliderLimit = { min: number; max: number; step: number };

export type ScenarioContext = {
  farm: FarmProfile; climate: ClimateContext | null; soil: SoilInput | null;
  /** The farmer's current rotation evaluated plan — the baseline for "Current vs Selected". */
  currentPlan: RotationPlan;
};
export type MetricRanges = {
  waterIndex: Range | null; yieldIndex: Range | null;
  estimatedCost: Range | null; estimatedRevenue: Range | null; estimatedNetReturn: Range | null;
};
export type DetailedScenarioResult = ScenarioResult & {
  planId: PlanId; inputs: ScenarioInputs;
  baselineRange: MetricRanges; selectedRange: MetricRanges;
  /** Seasonal water demand (mm/ha over the rotation) after temperature adjustment. */
  waterDemandMm: { baseline: number | null; selected: number | null };
  /** Water available from rainfall + irrigation under the scenario, mm/ha over the rotation. */
  waterSupplyMm: number | null;
  costBasis: "farm" | "per_ha";
};

/** (Added) Optional overrides for evaluateRotations — used by tests (e.g. a custom crop manifest). */
export type EvaluateOptions = { crops?: CropRule[] };

export type { CropSeason, MetricSet };
