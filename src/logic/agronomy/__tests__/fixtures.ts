// Test fixtures: deterministic stand-ins (shapes match harness getClimateContext / getSimulatedReading).
import type { ClimateContext, FarmProfile, SoilInput } from "@fw/contracts";

export const CLIMATE: ClimateContext = {
  locationId: "power--0.3_36.07", observedPeriod: "2015-01 to 2024-12", snapshot: true,
  annualRainfallMm: 1631, meanTemperatureC: 16.6,
  evidence: [
    { id: "nasa-power-prectotcorr-annual", source: "NASA_OFFLINE_SNAPSHOT", title: "Mean annual rainfall (PRECTOTCORR)", value: 1631, unit: "mm/yr", period: "2015-01 to 2024-12" },
    { id: "nasa-power-t2m-mean", source: "NASA_OFFLINE_SNAPSHOT", title: "Mean air temperature at 2 m (T2M)", value: 16.6, unit: "°C", period: "2015-01 to 2024-12" },
  ],
};
const TS = "2026-11-01T06:00:00Z";
export const SOIL: Record<"dry" | "normal" | "wet", SoilInput> = {
  dry: { ph: 6.1, n: 18, p: 12, k: 140, moisturePct: 11, source: "SIMULATED_IOT", timestamp: TS },
  normal: { ph: 6.3, n: 28, p: 18, k: 165, moisturePct: 24, source: "SIMULATED_IOT", timestamp: TS },
  wet: { ph: 6.0, n: 22, p: 15, k: 150, moisturePct: 38, source: "SIMULATED_IOT", timestamp: TS },
};
export const SAMPLE_FARM: FarmProfile = {
  id: "sample-nakuru-01", name: "Sample farm · Nakuru (demo)", lat: -0.3, lon: 36.07, areaHa: 2, irrigation: "limited",
  rotation: [
    { season: "Long rains", cropId: "maize", yearOffset: 0 },
    { season: "Short rains", cropId: "maize", yearOffset: 0 },
    { season: "Long rains", cropId: "maize", yearOffset: 1 },
    { season: "Short rains", cropId: "beans", yearOffset: 1 },
  ],
  priorities: ["water", "soil"], budget: 120000, notes: "test",
};
export const farmWith = (patch: Partial<FarmProfile>): FarmProfile => ({ ...SAMPLE_FARM, ...patch });
export const rot = (...crops: string[]) => crops.map((cropId, i) => ({ season: i % 2 === 0 ? "Long rains" : "Short rains", cropId, yearOffset: Math.floor(i / 2) }));
