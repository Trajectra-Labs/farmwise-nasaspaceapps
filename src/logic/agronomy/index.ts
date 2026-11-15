// Moen · public barrel for the deterministic agronomy model.
export * from "./types";
export { CROPS, KNOWN_SEASONS, LONG_RAINS, SHORT_RAINS, SOURCES, getCrop, isKnownSeason, normaliseCropId } from "./crops";
export {
  SEASON_RAIN_SHARE, UNKNOWN_SEASON_RAIN_SHARE, IRRIGATION_MM_PER_SEASON, ET_INCREASE_PER_DEG_C, HEAT_YIELD_PENALTY_PER_DEG_C,
  MOISTURE_REF_PCT, MOISTURE_MM_PER_PCT, MOISTURE_ADJ_CAP_MM, WATER_RELIABILITY_BUFFER,
} from "./model";
export { evaluateRotations, computeWeights, describeWorstIssue, DEFAULT_WEIGHTS, PRIORITY_BOOST, slotLabel } from "./evaluate";
export {
  runScenario, clampScenarioInputs, matchPreset, DEFAULT_SCENARIO_INPUTS, SCENARIO_LIMITS, SCENARIO_PRESETS, SCENARIO_ASSUMPTIONS,
} from "./scenario";
export {
  formatRotationSummary, formatScenarioSummary, rotationEvaluationToJSON, cropName, formatKes, formatRange,
  sourceLabel, SOURCE_LABELS, DISCLAIMER,
} from "./format";
