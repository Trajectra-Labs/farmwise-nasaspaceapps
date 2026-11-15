// HARNESS stand-in for Ted's getClimateContext(farm). Uses a REAL NASA POWER snapshot
// (harness/nasa/power-monthly-nakuru-2015-2024.raw.json, request URL inside). Offline snapshot,
// regional grid scale, historical only — not a forecast and not a field soil test.
import type { ClimateContext, FarmProfile } from "@fw/contracts";
import snap from "./snapshot.json";

type Month = { month: string; t2mC: number | null; precipMm: number | null };
const months = snap.months as Month[];
export const nasaSnapshotManifest = { requestUrl: snap.requestUrl, lat: snap.lat, lon: snap.lon, period: snap.period, retrievedAt: snap.retrievedAt, variables: snap.variables };

function annualStats() {
  const years = new Map<string, { p: number; n: number }>();
  for (const m of months) {
    if (m.precipMm == null) continue;
    const y = m.month.slice(0, 4);
    const cur = years.get(y) ?? { p: 0, n: 0 };
    years.set(y, { p: cur.p + m.precipMm, n: cur.n + 1 });
  }
  const complete = [...years.values()].filter((y) => y.n === 12);
  const rain = complete.length ? complete.reduce((a, y) => a + y.p, 0) / complete.length : null;
  const temps = months.map((m) => m.t2mC).filter((t): t is number => t != null);
  const temp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  return { rain: rain == null ? null : Math.round(rain), temp: temp == null ? null : Math.round(temp * 10) / 10 };
}

export async function getClimateContext(farm: FarmProfile | null): Promise<ClimateContext> {
  if (!farm || farm.lat == null || farm.lon == null) throw new Error("Farm location unknown — climate context unavailable.");
  const { rain, temp } = annualStats();
  return {
    locationId: `power-${snap.lat}_${snap.lon}`,
    observedPeriod: snap.period,
    snapshot: true,
    annualRainfallMm: rain,
    meanTemperatureC: temp,
    evidence: [
      { id: "nasa-power-prectotcorr-annual", source: "NASA_OFFLINE_SNAPSHOT", title: "Mean annual rainfall (PRECTOTCORR)", value: rain, unit: "mm/yr",
        period: snap.period, spatialScale: snap.spatialScale, url: snap.requestUrl, note: `Retrieved ${snap.retrievedAt}. Historical observation, not a forecast.` },
      { id: "nasa-power-t2m-mean", source: "NASA_OFFLINE_SNAPSHOT", title: "Mean air temperature at 2 m (T2M)", value: temp, unit: "°C",
        period: snap.period, spatialScale: snap.spatialScale, url: snap.requestUrl, note: `Retrieved ${snap.retrievedAt}.` },
    ],
  };
}
