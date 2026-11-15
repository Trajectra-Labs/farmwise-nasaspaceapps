// Moen · shared, pure model constants and helpers used by both evaluateRotations() and runScenario().
// Every constant below is a documented ASSUMPTION (see README.md) unless a source is named.
import type { ClimateContext, FarmProfile, SoilInput } from "@fw/contracts";
import type { CropRule, Range } from "./types";

/** Share of mean annual rainfall that falls (effectively) in each season. NASA snapshot monthly climatology
 * gives ≈0.50 (Mar–Jul) and ≈0.35 (Oct–Jan); rounded down ~10% as a crude effective-rainfall allowance. */
export const SEASON_RAIN_SHARE: Readonly<Record<string, number>> = { "Long rains": 0.45, "Short rains": 0.3 };
/** Used for season names not in the table above (flagged as an unknown season). */
export const UNKNOWN_SEASON_RAIN_SHARE = 0.3;
/** Irrigation water assumed available per season at 100 % availability, mm. */
export const IRRIGATION_MM_PER_SEASON: Readonly<Record<FarmProfile["irrigation"], number>> = { rainfed: 0, limited: 75, regular: 200 };
/** Crop water need (ET) rises ≈4 % per °C of warming (assumption, order of magnitude from FAO-56 Penman–Monteith sensitivity). */
export const ET_INCREASE_PER_DEG_C = 0.04;
/** Yield falls 10 % per °C that the mean season temperature exceeds the crop's heat-stress threshold (assumption). */
export const HEAT_YIELD_PENALTY_PER_DEG_C = 0.1;
/** Soil moisture reading → mm adjustment of available water: (moisture% − 25) × 3 mm, capped ±60 mm (assumption). */
export const MOISTURE_REF_PCT = 25;
export const MOISTURE_MM_PER_PCT = 3;
export const MOISTURE_ADJ_CAP_MM = 60;
/** Safety buffer for rainfall variability when scoring water reliability (annual rain varied ~±30 % in 2015–2024). */
export const WATER_RELIABILITY_BUFFER = 1.3;

export const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
export const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
export const mid = (r: Range) => (r.low + r.high) / 2;
export const roundTo = (v: number, step: number) => Math.round(v / step) * step;
/** Round KES to the nearest 1,000 (no false precision); normalises -0 to 0. */
export const roundKes = (v: number) => roundTo(v, 1000) + 0;

export function seasonShare(season: string): { share: number; known: boolean } {
  const s = SEASON_RAIN_SHARE[season];
  return s == null ? { share: UNKNOWN_SEASON_RAIN_SHARE, known: false } : { share: s, known: true };
}

/** Expected seasonal rainfall, mm; null when climate/annual rainfall is unknown. */
export function seasonRainMm(climate: ClimateContext | null, season: string, rainfallDeltaPct = 0): number | null {
  const annual = climate?.annualRainfallMm;
  if (!finite(annual) || annual < 0) return null;
  return Math.max(0, annual * seasonShare(season).share * (1 + rainfallDeltaPct / 100));
}

export function soilMoistureAdjMm(soil: SoilInput | null): number {
  const m = soil?.moisturePct;
  if (!finite(m)) return 0;
  return clamp((m - MOISTURE_REF_PCT) * MOISTURE_MM_PER_PCT, -MOISTURE_ADJ_CAP_MM, MOISTURE_ADJ_CAP_MM);
}

export function irrigationMm(farm: FarmProfile, irrigationPct = 100): number {
  const base = IRRIGATION_MM_PER_SEASON[farm.irrigation] ?? 0;
  return base * clamp(irrigationPct, 0, 100) / 100;
}

/** Farm area in ha, or null when unknown / non-positive / non-finite (costs then shown per ha). */
export function effectiveArea(farm: FarmProfile): number | null {
  const a = farm.areaHa;
  return finite(a) && a > 0 ? a : null;
}

export function effectiveBudget(farm: FarmProfile): number | null {
  const b = farm.budget;
  return finite(b) && b >= 0 ? b : null;
}

export function waterNeedMm(crop: CropRule, temperatureDeltaC = 0, which: "low" | "mid" | "high" = "mid"): number {
  const base = which === "mid" ? mid(crop.waterNeedMm) : crop.waterNeedMm[which];
  return Math.max(1, base * Math.max(0.5, 1 + ET_INCREASE_PER_DEG_C * temperatureDeltaC));
}

/** Water available to a crop in one season (rain + irrigation + soil-moisture adjustment), mm; null without climate. */
export function seasonSupplyMm(
  farm: FarmProfile, climate: ClimateContext | null, soil: SoilInput | null, season: string,
  rainfallDeltaPct = 0, irrigationPct = 100,
): number | null {
  const rain = seasonRainMm(climate, season, rainfallDeltaPct);
  if (rain == null) return null;
  return Math.max(0, rain + irrigationMm(farm, irrigationPct) + soilMoistureAdjMm(soil));
}

/** FAO-33 linear yield response: 1 − Ya/Ym = Ky (1 − ETa/ETm), clamped to [0, 1]. */
export function waterYieldRatio(crop: CropRule, supplyMm: number, needMm: number): number {
  const s = clamp(supplyMm / Math.max(1, needMm), 0, 1);
  return clamp(1 - (crop.ky ?? 1) * (1 - s), 0, 1);
}

export function heatYieldFactor(crop: CropRule, meanTempC: number | null): number {
  if (!finite(meanTempC)) return 1;
  return clamp(1 - Math.max(0, meanTempC - crop.heatStressAboveC) * HEAT_YIELD_PENALTY_PER_DEG_C, 0, 1);
}
