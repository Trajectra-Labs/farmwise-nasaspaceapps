import { describe, expect, it } from "vitest";
import {
  formatKesRange, formatMm, formatNumber, formatSignedKes,
  cropName, DEFAULT_SCENARIO_INPUTS, evaluateRotations, formatKes, formatRange, formatRotationSummary, formatScenarioSummary,
  rotationEvaluationToJSON, runScenario,
} from "..";
import { CLIMATE, SAMPLE_FARM, SOIL } from "./fixtures";

const ev = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);

describe("formatters", () => {
  it("formatKes / formatRange / cropName", () => {
    expect(formatKes(120000)).toBe("KES 120,000");
    expect(formatKes(-20000)).toBe("\u2212KES 20,000");
    expect(formatKes(0)).toBe("KES 0");
    expect(formatKes(null)).toBe("Unknown");
    expect(formatKes(Number.NaN)).toBe("Unknown");
    expect(formatRange({ low: 90000, high: 150000 })).toBe("KES 90,000 – KES 150,000");
    expect(formatRange(null)).toBe("Unknown");
    expect(cropName("beans")).toBe("Common beans");
    expect(cropName("irish_potato")).toBe("Irish potato");
    expect(cropName("teff")).toMatch(/Teff \(unknown crop\)/);
  });
  it("shared formatter set (REV-4)", () => {
    expect(formatKesRange({ low: 330000, high: 560000 })).toBe("KES 330,000 \u2013 560,000");
    expect(formatKesRange({ low: -116000, high: 1010000 })).toBe("KES \u2212116,000 \u2013 1,010,000");
    expect(formatKesRange({ low: 5000, high: 5000 })).toBe("KES 5,000");
    expect(formatKesRange(null)).toBe("Unknown");
    expect(formatSignedKes(1000)).toBe("+KES 1,000");
    expect(formatSignedKes(-1000)).toBe("\u2212KES 1,000");
    expect(formatSignedKes(0)).toBe("KES 0");
    expect(formatSignedKes(-0.4)).toBe("KES 0");
    expect(formatSignedKes(null)).toBe("Unknown");
    expect(formatNumber(1631)).toBe("1,631");
    expect(formatNumber(16.64, 1)).toBe("16.6");
    expect(formatNumber(-2.5, 1)).toBe("\u22122.5");
    expect(formatNumber(null)).toBe("Unknown");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Unknown");
    expect(formatMm(1631)).toBe("1,631 mm");
    expect(formatMm(undefined)).toBe("Unknown");
  });
  it("null climate: summaries make no NASA claim and say climate was unavailable (REV-2)", () => {
    const e = evaluateRotations(SAMPLE_FARM, null, SOIL.normal);
    const t = formatRotationSummary(e, SAMPLE_FARM.name);
    expect(t).not.toMatch(/NASA|2015/);
    expect(t).toMatch(/Climate: not available/);
    expect(t).toContain("Simulated sensor");
    const r = runScenario(e.plans[1], DEFAULT_SCENARIO_INPUTS, { farm: SAMPLE_FARM, climate: null, soil: null, currentPlan: e.plans[0] });
    const st = formatScenarioSummary(r, { planTitle: "Minimum change", farmName: SAMPLE_FARM.name, presetLabel: "Typical" });
    expect(st).not.toMatch(/NASA|2015/);
    expect(st).toMatch(/No climate data was available/);
    expect(st).toMatch(/Soil: no reading used/);
    expect(st).not.toContain("Simulated sensor");
  });
  it("climate labels come from the context's own evidence/period", () => {
    const observed = { ...CLIMATE, snapshot: false, observedPeriod: "1991-01 to 2020-12", evidence: CLIMATE.evidence.map((x) => ({ ...x, source: "NASA_OBSERVED" as const })) };
    const e = evaluateRotations(SAMPLE_FARM, observed, { ...SOIL.normal, source: "USER_SOIL_TEST" });
    const r = runScenario(e.plans[0], DEFAULT_SCENARIO_INPUTS, { farm: SAMPLE_FARM, climate: observed, soil: { ...SOIL.normal, source: "USER_SOIL_TEST" }, currentPlan: e.plans[0] });
    const st = formatScenarioSummary(r, { planTitle: "Current", farmName: "x", presetLabel: null });
    expect(st).toContain("NASA observed");
    expect(st).toContain("1991-01 to 2020-12");
    expect(st).not.toContain("offline snapshot");
    expect(st).toContain("Farmer soil test");
    expect(r.provenance).toEqual({ climate: expect.objectContaining({ source: "NASA_OBSERVED", snapshot: false, period: "1991-01 to 2020-12" }), soil: "USER_SOIL_TEST" });
  });
  it("rotation summary has provenance labels and honesty line (both call orders)", () => {
    const a = formatRotationSummary(ev, SAMPLE_FARM.name);
    const b = formatRotationSummary(SAMPLE_FARM, ev);
    expect(a).toBe(b);
    for (const s of ["NASA offline snapshot", "Simulated sensor", "Model estimate", "estimates, not guaranteed income", "KES", SAMPLE_FARM.name, "Current rotation", "Minimum change", "Resilience-oriented"]) expect(a).toContain(s);
    expect(a).not.toMatch(/NaN|Infinity|undefined/);
  });
  it("scenario summary has labels, inputs and disclaimer", () => {
    const r = runScenario(ev.plans[1], { ...DEFAULT_SCENARIO_INPUTS, rainfallDeltaPct: -30 }, { farm: SAMPLE_FARM, climate: CLIMATE, soil: SOIL.normal, currentPlan: ev.plans[0] });
    const t = formatScenarioSummary(r, { planTitle: "Minimum change", farmName: SAMPLE_FARM.name, presetLabel: "Drier" });
    for (const s of ["NASA offline snapshot", "Simulated sensor", "Model estimate", "estimates, not guaranteed income", "Drier", "rainfall -30 %", "Minimum change", "KES"]) expect(t).toContain(s);
    expect(t).not.toMatch(/NaN|Infinity|undefined/);
    const nullClimate = runScenario(ev.plans[1], DEFAULT_SCENARIO_INPUTS, { farm: SAMPLE_FARM, climate: null, soil: null, currentPlan: ev.plans[0] });
    expect(formatScenarioSummary(nullClimate, { planTitle: "x", farmName: "y", presetLabel: null })).toContain("Unknown");
  });
  it("JSON export parses, is deterministic and keeps the evaluation", () => {
    const j = rotationEvaluationToJSON(ev);
    expect(j).toBe(rotationEvaluationToJSON(ev));
    const parsed = JSON.parse(j);
    expect(parsed.plans).toHaveLength(3);
    expect(parsed.currency).toBe("KES");
    expect(parsed.disclaimer).toMatch(/not guaranteed income/);
    expect(JSON.parse(rotationEvaluationToJSON(SAMPLE_FARM, ev)).farm.name).toBe(SAMPLE_FARM.name);
  });
});
