import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import type { FarmWiseState, ScenarioInputs } from "@fw/contracts";
import { FarmWiseProvider, SAMPLE_FARM } from "@fw/core";
import { ToastProvider } from "@fw/ui";
import { DEFAULT_SCENARIO_INPUTS, SCENARIO_LIMITS, SCENARIO_PRESETS } from "../../../logic/agronomy";
import { ScenarioPage } from "..";

function renderPage(init: Partial<FarmWiseState> = {}) {
  return render(
    <FarmWiseProvider initialState={{ farm: SAMPLE_FARM, ...init }}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/scenarios"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/scenarios" element={<ScenarioPage />} />
            <Route path="/onboarding" element={<p>Onboarding route</p>} />
            <Route path="/rotation" element={<p>Rotation route</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </FarmWiseProvider>,
  );
}

/** Let pending promise-based state updates (climate context) settle inside act(). */
const flush = () => act(async () => { await Promise.resolve(); });

async function ready(init: Partial<FarmWiseState> = {}) {
  const utils = renderPage(init);
  await screen.findByRole("heading", { name: "Observed inputs" });
  return utils;
}

const slider = (name: string) => screen.getByRole("slider", { name }) as HTMLInputElement;
const metric = (key: string, which: "current" | "selected" | "delta" = "selected") => screen.getByTestId(`metric-${key}-${which}`).textContent ?? "";
const setSlider = (name: string, v: number) => fireEvent.change(slider(name), { target: { value: String(v) } });
const resultsText = () => document.querySelector(".scn-results")?.textContent ?? "";
const allValues = () => ["Rainfall change", "Temperature change", "Irrigation availability", "Input cost change"].map((n) => slider(n).value);

describe("Scenario Studio", () => {
  it("renders header, honest explainer, provenance and back link", async () => {
    await ready();
    expect(screen.getByRole("heading", { level: 1, name: "Scenario Studio" })).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_FARM.name)).toBeInTheDocument();
    expect(screen.getByText(/what-if estimates, not forecasts or guaranteed income/i)).toBeInTheDocument();
    expect(screen.getAllByText("NASA offline snapshot").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Simulated sensor").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Back to Rotation Planner/ }));
    expect(screen.getByText("Rotation route")).toBeInTheDocument();
  });

  it("S01 each preset tab changes the sliders and the results", async () => {
    await ready();
    const seen = new Set<string>();
    for (const p of SCENARIO_PRESETS) {
      fireEvent.click(screen.getByRole("tab", { name: p.label }));
      expect(screen.getByRole("tab", { name: p.label })).toHaveAttribute("aria-selected", "true");
      expect(Number(slider("Rainfall change").value)).toBe(p.inputs.rainfallDeltaPct);
      expect(Number(slider("Temperature change").value)).toBe(p.inputs.temperatureDeltaC);
      expect(Number(slider("Irrigation availability").value)).toBe(p.inputs.irrigationPct);
      expect(Number(slider("Input cost change").value)).toBe(p.inputs.inputCostDeltaPct);
      seen.add(document.querySelector(".scn-metrics")?.textContent ?? "");
    }
    expect(seen.size).toBe(SCENARIO_PRESETS.length);
  });

  it("S02 rainfall slider changes water results and marks the scenario custom", async () => {
    await ready();
    const before = metric("waterIndex");
    setSlider("Rainfall change", SCENARIO_LIMITS.rainfallDeltaPct.min);
    expect(metric("waterIndex")).not.toBe(before);
    expect(screen.getByText("Custom scenario")).toBeInTheDocument();
    expect(screen.getByTestId("scn-custom-label")).toHaveTextContent("Custom (modified from Typical)");
    expect(screen.getByRole("tab", { name: "Typical" })).toHaveAttribute("aria-selected", "true");
  });

  it("S03 temperature slider changes water demand and shows a signed value", async () => {
    await ready();
    const before = metric("waterDemand");
    setSlider("Temperature change", SCENARIO_LIMITS.temperatureDeltaC.max);
    expect(metric("waterDemand")).not.toBe(before);
    expect(slider("Temperature change")).toHaveAttribute("aria-valuetext", expect.stringMatching(/^\+/));
  });

  it("S04 irrigation slider changes water-dependent results on an irrigated farm", async () => {
    await ready();
    setSlider("Rainfall change", SCENARIO_LIMITS.rainfallDeltaPct.min);
    const before = metric("waterIndex");
    setSlider("Irrigation availability", SCENARIO_LIMITS.irrigationPct.min);
    expect(metric("waterIndex")).not.toBe(before);
  });

  it("S04 irrigation slider explains it has no effect on a rainfed farm", async () => {
    await ready({ farm: { ...SAMPLE_FARM, irrigation: "rainfed" } });
    expect(screen.getByText(/rainfed, so irrigation availability has no effect/i)).toBeInTheDocument();
    expect(slider("Irrigation availability")).toBeEnabled();
  });

  it("S05 input-cost slider changes cost and net return", async () => {
    await ready();
    const cost = metric("estimatedCost"), net = metric("estimatedNetReturn");
    setSlider("Input cost change", SCENARIO_LIMITS.inputCostDeltaPct.max);
    expect(metric("estimatedCost")).not.toBe(cost);
    expect(metric("estimatedNetReturn")).not.toBe(net);
  });

  it("S06 plan selector lists 3 plans and preserves the other inputs", async () => {
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Hotter" }));
    setSlider("Input cost change", 15);
    const values = allValues();
    const select = screen.getByLabelText("Compare current rotation with") as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    for (const o of Array.from(select.options)) {
      expect(o.textContent).toMatch(/feasible/);
      fireEvent.change(select, { target: { value: o.value } });
      expect(allValues()).toEqual(values);
      expect(screen.getByRole("list", { name: /crop sequence/ })).toBeInTheDocument();
    }
  });

  it("S07 charts have titles, legend, axis units and a summary", async () => {
    await ready();
    const figures = screen.getAllByRole("figure");
    expect(figures).toHaveLength(2);
    for (const f of figures) {
      expect(within(f).getByRole("list", { name: "Legend" })).toHaveTextContent(/hatched bar/);
      expect(within(f).getByText("Model estimate")).toBeInTheDocument();
      expect(f.querySelector(".fw-chart__summary")?.textContent).toMatch(/Current rotation/);
    }
    expect(screen.getByText(/Water and yield indices, before vs after/)).toBeInTheDocument();
    expect(screen.getByText(/Cost, revenue and net return, before vs after/)).toBeInTheDocument();
  });

  it("S08 assumptions drawer lists assumptions and formulas and returns focus", async () => {
    await ready();
    const btn = screen.getByRole("button", { name: "Assumptions" });
    btn.focus();
    fireEvent.click(btn);
    const drawer = screen.getByRole("dialog", { name: "Scenario assumptions" });
    expect(within(drawer).getByRole("heading", { name: "Assumptions used in this run" })).toBeInTheDocument();
    expect(within(drawer).getByRole("heading", { name: "Formulas" })).toBeInTheDocument();
    expect(within(drawer).getByText(/estimated revenue − estimated cost/)).toBeInTheDocument();
    expect(within(drawer).getAllByRole("listitem").length).toBeGreaterThan(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  it("S09 reset returns to the default inputs deterministically", async () => {
    await ready();
    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset).toBeDisabled();
    expect(reset).toHaveAccessibleDescription(/Typical scenario is already in use/);
    expect(screen.getByText(/Reset is off because/)).toBeVisible();
    const baseline = resultsText();
    fireEvent.click(screen.getByRole("tab", { name: "Drier" }));
    setSlider("Input cost change", 40);
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    const d: ScenarioInputs = DEFAULT_SCENARIO_INPUTS;
    expect(allValues()).toEqual([d.rainfallDeltaPct, d.temperatureDeltaC, d.irrigationPct, d.inputCostDeltaPct].map(String));
    expect(screen.getByText("Scenario reset to Typical")).toBeInTheDocument();
    expect(reset).toBeDisabled();
    expect(resultsText().replace("Scenario reset to Typical", "")).toBe(baseline);
  });

  it("S10 copy writes a usable summary to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Drier" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy summary" })); });
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toMatch(/Current rotation|current/i);
    expect(text).toMatch(/estimate/i);
    expect(text).toMatch(/Drier/);
    expect(await screen.findByText("Scenario summary copied")).toBeInTheDocument();
  });

  it("S10 copy failure shows an error toast", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);
    await ready();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy summary" })); });
    expect(await screen.findByText(/Copy failed/)).toBeInTheDocument();
  });

  it("S11 extremes never render NaN or Infinity", async () => {
    await ready();
    const L = SCENARIO_LIMITS;
    const combos: ScenarioInputs[] = [
      { rainfallDeltaPct: L.rainfallDeltaPct.min, temperatureDeltaC: L.temperatureDeltaC.max, irrigationPct: L.irrigationPct.min, inputCostDeltaPct: L.inputCostDeltaPct.max },
      { rainfallDeltaPct: L.rainfallDeltaPct.max, temperatureDeltaC: L.temperatureDeltaC.min, irrigationPct: L.irrigationPct.max, inputCostDeltaPct: L.inputCostDeltaPct.min },
    ];
    for (const c of combos) {
      setSlider("Rainfall change", c.rainfallDeltaPct);
      setSlider("Temperature change", c.temperatureDeltaC);
      setSlider("Irrigation availability", c.irrigationPct);
      setSlider("Input cost change", c.inputCostDeltaPct);
      expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("S11 out-of-range stored inputs are clamped, not propagated", async () => {
    await ready({ scenario: { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 } });
    setSlider("Input cost change", 10_000);
    expect(Number(slider("Input cost change").value)).toBeLessThanOrEqual(SCENARIO_LIMITS.inputCostDeltaPct.max);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("S12 uncertainty list and source labels stay visible", async () => {
    await ready();
    const unc = screen.getByRole("heading", { name: "Uncertainty" }).closest("section")!;
    expect(within(unc).getAllByRole("listitem").length).toBeGreaterThan(0);
    setSlider("Rainfall change", SCENARIO_LIMITS.rainfallDeltaPct.min);
    expect(within(unc).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model estimate").length).toBeGreaterThanOrEqual(6);
  });

  it("S13 the same inputs give identical output", async () => {
    await ready();
    setSlider("Rainfall change", -20);
    setSlider("Temperature change", 1.5);
    const first = resultsText();
    setSlider("Rainfall change", 10);
    setSlider("Temperature change", 0);
    expect(resultsText()).not.toBe(first);
    setSlider("Rainfall change", -20);
    setSlider("Temperature change", 1.5);
    expect(resultsText()).toBe(first);
  });

  it("S14 data table has a caption, header scopes and its own scroll region", async () => {
    await ready();
    const table = screen.getByRole("table");
    expect(table.querySelector("caption")).toHaveTextContent(/model estimates/);
    expect(table.querySelectorAll('th[scope="col"]').length).toBe(6);
    expect(table.querySelectorAll('th[scope="row"]').length).toBe(6);
    expect(screen.getByRole("region", { name: /data table/ })).toHaveAttribute("tabindex", "0");
  });

  it("shows an infeasible warning when the selected plan is not feasible", async () => {
    await ready({ farm: { ...SAMPLE_FARM, budget: 1000 } });
    const select = screen.getByLabelText("Compare current rotation with") as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toMatch(/not feasible/);
    expect(screen.getByText("Not feasible")).toBeInTheDocument();
    expect(screen.getByText(/not recommended/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("no farm shows an empty state linking to onboarding", async () => {
    renderPage({ farm: null });
    await flush();
    expect(screen.getByRole("heading", { name: "No farm set up yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set up your farm" }));
    expect(screen.getByText("Onboarding route")).toBeInTheDocument();
  });

  it("climate error shows Retry and Unknown instead of zeros", async () => {
    renderPage({ farm: { ...SAMPLE_FARM, lat: null, lon: null } });
    expect(await screen.findByRole("heading", { name: "Climate data unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getAllByText(/Unknown/).length).toBeGreaterThan(0);
    expect(metric("waterIndex")).toBe("Unknown");
    // Honest provenance: no NASA label or claim anywhere when climate failed to load.
    expect(screen.queryByText("NASA offline snapshot")).not.toBeInTheDocument();
    expect(screen.getByText(/no NASA values are used/)).toBeInTheDocument();
    const unc = screen.getByRole("heading", { name: "Uncertainty" }).closest("section")!;
    expect(unc.textContent).not.toMatch(/Rainfall comes from|NASA POWER offline snapshot/);
    expect(screen.queryByText(/historical NASA climate data/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    const drawer = screen.getByRole("dialog", { name: "Scenario assumptions" });
    expect(within(drawer).getByText(/no observed source was used/)).toBeInTheDocument();
    expect(within(drawer).queryByRole("link")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("climate loading shows skeletons", async () => {
    renderPage();
    expect(screen.getAllByRole("status", { name: /Loading climate data|Calculating scenario/ }).length).toBeGreaterThan(0);
    await screen.findByRole("heading", { name: "Observed inputs" });
  });
});
