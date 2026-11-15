// FROZEN CONTRACT — verbatim copy of FarmWise PRD v3 §4.
// Owner: Shaheem (src/contracts/farmwise.ts). This harness copy exists only because the
// starter baseline was not available to Moen's workstream. Do not edit; replace with the
// real src/contracts/farmwise.ts at integration (it must be identical).
export type SourceKind =
  | "NASA_OBSERVED" | "NASA_OFFLINE_SNAPSHOT"
  | "SIMULATED_IOT" | "FARMER_REPORTED"
  | "USER_SOIL_TEST" | "DEMO_IMAGE" | "MODEL_ESTIMATE";

export type CropSeason = { season: string; cropId: string; yearOffset: number };

export type FarmProfile = {
  id: string; name: string; lat: number | null; lon: number | null;
  areaHa?: number | null; irrigation: "rainfed" | "limited" | "regular";
  rotation: CropSeason[]; priorities: ("water" | "cost" | "soil")[];
  budget?: number | null; notes: string; knownSoil?: SoilInput;
};

export type SoilInput = {
  ph?: number | null; n?: number | null; p?: number | null;
  k?: number | null; moisturePct?: number | null; source: SourceKind; timestamp?: string;
};

export type Evidence = {
  id: string; source: SourceKind; title: string;
  value: number | string | null; unit?: string; period?: string;
  spatialScale?: string; url?: string; note?: string;
};

export type RotationPlan = {
  id: "current" | "minimum" | "resilience";
  seasons: CropSeason[]; feasible: boolean; constraints: string[];
  benefits: string[]; risks: string[]; score: number | null;
  confidence: "low" | "medium" | "high"; evidenceIds: string[];
};

export type ScenarioInputs = {
  rainfallDeltaPct: number; temperatureDeltaC: number;
  irrigationPct: number; inputCostDeltaPct: number;
};

export type MetricSet = {
  waterIndex: number | null; yieldIndex: number | null;
  estimatedCost: number | null; estimatedRevenue: number | null;
  estimatedNetReturn: number | null; currency?: string;
};

export type ScenarioResult = {
  baseline: MetricSet; selected: MetricSet;
  uncertainty: string[]; assumptions: string[];
};

export type ClimateContext = {
  locationId: string; evidence: Evidence[];
  annualRainfallMm?: number | null; meanTemperatureC?: number | null;
  observedPeriod: string; snapshot: boolean;
};

export type PlantObservation = {
  sampleId?: string; visibleSigns: string[];
  possibleConcerns: string[]; certaintyNote: string; source: SourceKind;
};

export type FarmWiseState = {
  farm: FarmProfile | null; soilPreset: "dry" | "normal" | "wet";
  activePlanId: "current" | "minimum" | "resilience";
  scenario: ScenarioInputs; theme: "light" | "dark";
  lastPlantObservation?: PlantObservation | null;
};
