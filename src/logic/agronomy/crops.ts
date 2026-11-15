// Moen · crop rule manifest for the demonstration region: Nakuru County, Kenya (lat -0.30, lon 36.07),
// bimodal rainfall. Season strings MUST match FarmProfile CropSeason.season exactly.
//
// HONESTY: water-need ranges and yield-response factors (Ky) come from FAO guidance where a source is
// listed with kind "published". Everything else — prices, input costs, yields, pH ranges, pest groups,
// heat thresholds and the crops' season lists — are DEMONSTRATION ASSUMPTIONS (kind "assumption"),
// rounded and deliberately wide. They are not market quotes and not agronomic advice.
import type { CropRule, SourceRef } from "./types";

export const LONG_RAINS = "Long rains";
export const SHORT_RAINS = "Short rains";
/** Season names the manifest understands (≈Mar–Jul and ≈Oct–Jan in Nakuru). */
export const KNOWN_SEASONS: readonly string[] = [LONG_RAINS, SHORT_RAINS];

export const SOURCES = {
  faoCropInfo: {
    id: "src-fao-crop-info", kind: "published",
    title: "FAO Land & Water — Crop information (seasonal crop water need ranges, Ky)",
    url: "https://www.fao.org/land-water/databases-and-software/crop-information/en/",
  },
  fao56: {
    id: "src-fao-56", kind: "published",
    title: "FAO Irrigation and Drainage Paper 56 — Crop evapotranspiration (Allen et al., 1998)",
    url: "https://www.fao.org/3/x0490e/x0490e00.htm",
  },
  fao33: {
    id: "src-fao-33", kind: "published",
    title: "FAO Irrigation and Drainage Paper 33 — Yield response to water (Doorenbos & Kassam, 1979): seasonal Ky values",
  },
  fao66: {
    id: "src-fao-66", kind: "published",
    title: "FAO Irrigation and Drainage Paper 66 — Crop yield response to water (Steduto et al., 2012)",
    url: "https://www.fao.org/3/i2800e/i2800e.pdf",
  },
  econAssumption: {
    id: "asm-economics", kind: "assumption",
    title: "Team assumption: smallholder yields, farm-gate prices (KES/t) and input costs (KES/ha per season) for Nakuru — rounded, wide demonstration ranges, not market data",
  },
  agroAssumption: {
    id: "asm-agronomy", kind: "assumption",
    title: "Team assumption: season suitability, pH range, heat threshold and pest/disease group from general rotation principles — check locally",
  },
  waterAssumption: {
    id: "asm-water", kind: "assumption",
    title: "Team assumption: water need / Ky for crops not covered by the FAO crop information pages (informed by similar crops)",
  },
} satisfies Record<string, SourceRef>;

const S = SOURCES;

/** Extra, optional manifest fields used by the model (narrow extension; see types.ts). */
export const CROPS: CropRule[] = [
  {
    id: "maize", name: "Maize", family: "cereal", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 500, high: 800 }, ky: 1.25, droughtTolerance: 2, heatStressAboveC: 28,
    nitrogenFixing: false, pestGroup: "cereal_stemborer", phRange: { low: 5.5, high: 7.5 },
    yieldTPerHa: { low: 1.5, high: 4.5, typical: 2.5 }, priceKesPerT: { low: 30000, high: 50000 },
    costKesPerHa: { low: 45000, high: 75000 }, familiar: true,
    soilEffect: "Heavy nitrogen user; continuous maize builds stem-borer and maize lethal necrosis pressure.",
    marketNote: "Staple with a broad local market; price swings at harvest.", restricted: null,
    sources: [S.faoCropInfo, S.fao33, S.econAssumption, S.agroAssumption],
  },
  {
    id: "beans", name: "Common beans", family: "legume", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 300, high: 500 }, ky: 1.15, droughtTolerance: 2, heatStressAboveC: 24,
    nitrogenFixing: true, pestGroup: "grain_legume", phRange: { low: 5.5, high: 7.0 },
    yieldTPerHa: { low: 0.4, high: 1.2, typical: 0.7 }, priceKesPerT: { low: 80000, high: 130000 },
    costKesPerHa: { low: 30000, high: 55000 }, familiar: true,
    soilEffect: "Fixes some nitrogen and breaks cereal pest cycles; sensitive to waterlogging.",
    marketNote: "Strong local demand.", restricted: null,
    sources: [S.faoCropInfo, S.fao33, S.econAssumption, S.agroAssumption],
  },
  {
    id: "sorghum", name: "Sorghum", family: "cereal", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 450, high: 650 }, ky: 0.9, droughtTolerance: 4, heatStressAboveC: 32,
    nitrogenFixing: false, pestGroup: "cereal_stemborer", phRange: { low: 5.5, high: 8.0 },
    yieldTPerHa: { low: 0.8, high: 2.5, typical: 1.4 }, priceKesPerT: { low: 30000, high: 50000 },
    costKesPerHa: { low: 25000, high: 45000 },
    soilEffect: "Drought-tolerant cereal; shares stem-borer pests with maize.",
    marketNote: "Smaller market; bird damage and buyer contracts matter.", restricted: null,
    sources: [S.faoCropInfo, S.fao33, S.econAssumption, S.agroAssumption],
  },
  {
    id: "finger_millet", name: "Finger millet", family: "cereal", seasons: [LONG_RAINS],
    waterNeedMm: { low: 350, high: 550 }, ky: 0.9, droughtTolerance: 4, heatStressAboveC: 30,
    nitrogenFixing: false, pestGroup: "small_millet", phRange: { low: 5.0, high: 7.5 },
    yieldTPerHa: { low: 0.6, high: 1.8, typical: 1.0 }, priceKesPerT: { low: 70000, high: 120000 },
    costKesPerHa: { low: 25000, high: 45000 },
    soilEffect: "Long-season, hardy cereal with different pests from maize; labour-intensive weeding.",
    marketNote: "Niche but well-priced market.", restricted: null,
    sources: [S.waterAssumption, S.econAssumption, S.agroAssumption],
  },
  {
    id: "irish_potato", name: "Irish potato", family: "root_tuber", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 500, high: 700 }, ky: 1.1, droughtTolerance: 2, heatStressAboveC: 21,
    nitrogenFixing: false, pestGroup: "solanaceae", phRange: { low: 4.8, high: 6.5 },
    yieldTPerHa: { low: 8, high: 20, typical: 12 }, priceKesPerT: { low: 15000, high: 35000 },
    costKesPerHa: { low: 120000, high: 200000 }, familiar: true,
    soilEffect: "High-input crop; repeated potato builds bacterial wilt and late blight risk.",
    marketNote: "Good highland market but volatile prices and high seed/input cost.", restricted: null,
    sources: [S.faoCropInfo, S.fao33, S.econAssumption, S.agroAssumption],
  },
  {
    id: "sweet_potato", name: "Sweet potato", family: "root_tuber", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 400, high: 650 }, ky: 1.0, droughtTolerance: 4, heatStressAboveC: 30,
    nitrogenFixing: false, pestGroup: "sweetpotato_weevil", phRange: { low: 5.0, high: 7.0 },
    yieldTPerHa: { low: 6, high: 15, typical: 9 }, priceKesPerT: { low: 15000, high: 30000 },
    costKesPerHa: { low: 40000, high: 70000 },
    soilEffect: "Good ground cover; vines can be used as fodder.",
    marketNote: "Local market; bulky to transport.", restricted: null,
    sources: [S.waterAssumption, S.econAssumption, S.agroAssumption],
  },
  {
    id: "soybean", name: "Soybean", family: "legume", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 450, high: 700 }, ky: 0.85, droughtTolerance: 3, heatStressAboveC: 28,
    nitrogenFixing: true, pestGroup: "grain_legume", phRange: { low: 6.0, high: 7.0 },
    yieldTPerHa: { low: 0.8, high: 2.0, typical: 1.2 }, priceKesPerT: { low: 55000, high: 85000 },
    costKesPerHa: { low: 35000, high: 60000 },
    soilEffect: "Fixes nitrogen when well nodulated (inoculant recommended).",
    marketNote: "Feed/processor market; check buyers before planting.", restricted: null,
    sources: [S.faoCropInfo, S.fao33, S.econAssumption, S.agroAssumption],
  },
  {
    id: "cowpea", name: "Cowpea", family: "legume", seasons: [LONG_RAINS, SHORT_RAINS],
    waterNeedMm: { low: 300, high: 450 }, ky: 0.9, droughtTolerance: 5, heatStressAboveC: 32,
    nitrogenFixing: true, pestGroup: "grain_legume", phRange: { low: 5.5, high: 7.5 },
    yieldTPerHa: { low: 0.4, high: 1.2, typical: 0.7 }, priceKesPerT: { low: 70000, high: 110000 },
    costKesPerHa: { low: 25000, high: 45000 },
    soilEffect: "Very drought-tolerant legume; fixes nitrogen; leaves are also eaten.",
    marketNote: "Smaller market in Nakuru than beans.", restricted: null,
    sources: [S.waterAssumption, S.econAssumption, S.agroAssumption],
  },
];

const BY_ID = new Map(CROPS.map((c) => [c.id, c]));
/** Common aliases a farmer profile may use. */
const ALIASES: Record<string, string> = {
  bean: "beans", common_beans: "beans", "common-beans": "beans", potato: "irish_potato", potatoes: "irish_potato",
  "irish-potato": "irish_potato", "sweet-potato": "sweet_potato", millet: "finger_millet", "finger-millet": "finger_millet",
  soy: "soybean", soya: "soybean", soybeans: "soybean", cowpeas: "cowpea",
};

export function normaliseCropId(id: string): string {
  const k = (id ?? "").trim().toLowerCase();
  return ALIASES[k] ?? k;
}

/** Looks up a crop in the given manifest (default CROPS); undefined for unknown/empty ids. */
export function getCrop(id: string, crops: readonly CropRule[] = CROPS): CropRule | undefined {
  const k = normaliseCropId(id);
  if (!k) return undefined;
  if (crops === CROPS) return BY_ID.get(k);
  return crops.find((c) => c.id === k);
}

export function isKnownSeason(season: string, crops: readonly CropRule[] = CROPS): boolean {
  return crops.some((c) => c.seasons.includes(season));
}
