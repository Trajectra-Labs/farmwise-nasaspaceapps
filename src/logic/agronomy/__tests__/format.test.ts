import "./storagePolyfill";
import { describe, expect, it } from "vitest";
import {
  cropName, DEFAULT_SCENARIO_INPUTS, evaluateRotations, formatKes, formatRange, formatRotationSummary, formatScenarioSummary,
  rotationEvaluationToJSON, runScenario,
} from "..";
import { CLIMATE, SAMPLE_FARM, SOIL } from "./fixtures";

const ev = evaluateRotations(SAMPLE_FARM, CLIMATE, SOIL.normal);

describe("formatters", () => {
  it("formatKes / formatRange / cropName", () => {
    expect(formatKes(120000)).toBe("KES 120,000");
    expect(formatKes(-20000)).toBe("-KES 20,000");
    expect(formatKes(0)).toBe("KES 0");
    expect(formatKes(null)).toBe("Unknown");
    expect(formatKes(Number.NaN)).toBe("Unknown");
    expect(formatRange({ low: 90000, high: 150000 })).toBe("KES 90,000 – KES 150,000");
    expect(formatRange(null)).toBe("Unknown");
    expect(cropName("beans")).toBe("Common beans");
    expect(cropName("irish_potato")).toBe("Irish potato");
    expect(cropName("teff")).toMatch(/Teff \(unknown crop\)/);
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
