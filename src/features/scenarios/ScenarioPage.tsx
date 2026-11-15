// Moen · S4 Scenario Studio. All state lives in the central store (useMoenData); the only local
// state here is UI-only (drawer open, last clicked preset for the "modified from" label).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ScenarioInputs } from "@fw/contracts";
import {
  Badge, Button, Card, EmptyState, ErrorState, Select, Skeleton, Slider, SourceBadge, TabPanel, Tabs, useToast,
} from "@fw/ui";
import { useMoenData } from "../rotation/moenStore";
import {
  DEFAULT_SCENARIO_INPUTS, SCENARIO_LIMITS, SCENARIO_PRESETS, clampScenarioInputs, cropName, formatScenarioSummary, matchPreset, runScenario,
} from "../../logic/agronomy";
import type { DetailedScenarioResult, EvaluatedPlan, PlanId, ScenarioPreset, ScenarioPresetId } from "../../logic/agronomy/types";
import { AssumptionsDrawer } from "./AssumptionsDrawer";
import { ScenarioCharts } from "./ScenarioCharts";
import { ScenarioInputsPanel } from "./ScenarioInputsPanel";
import { MetricTiles, ResultsTable } from "./ScenarioResults";
import { buildMetricRows, fmtDelta, fmtIrrigation, fmtPct, fmtTemp, fmtValue, deltaOf, sameInputs } from "./format";
import { copyText, downloadText } from "./share";
import "./scenarios.css";

const PRESETS: readonly ScenarioPreset[] = SCENARIO_PRESETS;
const TABS_ID = "scn-presets";

function presetById(id: ScenarioPresetId): ScenarioPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

function PlanSequence({ plan }: { plan: EvaluatedPlan }) {
  return (
    <ol className="scn-seq" aria-label={`${plan.title} crop sequence`}>
      {plan.seasons.map((s, i) => (
        <li key={`${s.yearOffset}-${s.season}-${i}`} className="scn-seq__item">
          <span className="scn-seq__when">Year {s.yearOffset + 1} · {s.season}</span>
          <span className="scn-seq__crop">{cropName(s.cropId)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ScenarioPage() {
  const { farm, climate, climateStatus, climateError, retryClimate, soil, evaluation, activePlanId, setActivePlanId, scenario, setScenario } = useMoenData();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const matched = matchPreset(scenario);
  const [lastPreset, setLastPreset] = useState<ScenarioPresetId>(matched ?? "typical");
  if (matched && matched !== lastPreset) setLastPreset(matched);
  const tabValue: ScenarioPresetId = matched ?? lastPreset;

  const plans = evaluation?.plans ?? [];
  const currentPlan = plans.find((p) => p.id === "current") ?? null;
  const selectedPlan = plans.find((p) => p.id === activePlanId) ?? currentPlan;
  const climateReady = climateStatus === "ready";

  const computed = useMemo<{ result: DetailedScenarioResult | null; typical: DetailedScenarioResult | null; error: string | null }>(() => {
    if (!farm || !selectedPlan || !currentPlan) return { result: null, typical: null, error: null };
    try {
      const ctx = { farm, climate: climateReady ? climate : null, soil, currentPlan };
      const result = runScenario(selectedPlan, scenario, ctx);
      const typical = sameInputs(result.inputs, DEFAULT_SCENARIO_INPUTS) ? null : runScenario(selectedPlan, DEFAULT_SCENARIO_INPUTS, ctx);
      return { result, typical, error: null };
    } catch (e) {
      return { result: null, typical: null, error: e instanceof Error ? e.message : "The scenario could not be calculated." };
    }
  }, [farm, selectedPlan, currentPlan, scenario, climate, climateReady, soil]);
  const result = computed.result;
  const rows = useMemo(() => (result ? buildMetricRows(result, computed.typical) : []), [result, computed.typical]);

  if (!farm) {
    return (
      <div className="scn-page">
        <h1>Scenario Studio</h1>
        <EmptyState title="No farm set up yet"
          body="Scenario Studio needs your farm’s crops, location and irrigation before it can estimate anything."
          action={<Link to="/onboarding" className="fw-btn fw-btn--primary">Set up your farm</Link>} />
      </div>
    );
  }

  const atDefault = sameInputs(scenario, DEFAULT_SCENARIO_INPUTS);
  const presetLabel = matched ? presetById(matched).label : `Custom (modified from ${presetById(lastPreset).label})`;
  const planTitle = selectedPlan?.title ?? "Selected plan";
  const currentLabel = "Current rotation";
  const comparingSelf = selectedPlan?.id === "current";
  const selectedLabel = comparingSelf ? "Current rotation (selected)" : planTitle;
  const limits = SCENARIO_LIMITS;
  const rainfed = farm.irrigation === "rainfed";

  const update = (patch: Partial<ScenarioInputs>) => setScenario(clampScenarioInputs({ ...scenario, ...patch }));
  const choosePreset = (id: string) => {
    const p = presetById(id as ScenarioPresetId);
    setLastPreset(p.id);
    setScenario(clampScenarioInputs({ ...p.inputs }));
  };
  const reset = () => {
    setLastPreset("typical");
    setScenario({ ...DEFAULT_SCENARIO_INPUTS });
    toast.show({ title: "Scenario reset to Typical", tone: "info" });
    window.setTimeout(() => document.getElementById(`${TABS_ID}-tab-typical`)?.focus(), 0);
  };
  const summaryText = () => (result ? formatScenarioSummary(result, { planTitle, farmName: farm.name, presetLabel }) : "");
  const copy = async () => {
    const text = summaryText();
    if (!text) { toast.show({ title: "Nothing to copy yet", tone: "danger" }); return; }
    const ok = await copyText(text);
    toast.show(ok ? { title: "Scenario summary copied", tone: "success" } : { title: "Copy failed. Use Download .txt instead.", tone: "danger" });
  };
  const download = () => {
    const text = summaryText();
    const ok = text ? downloadText(`farmwise-scenario-${selectedPlan?.id ?? "plan"}.txt`, text) : false;
    toast.show(ok ? { title: "Summary downloaded", tone: "success" } : { title: "Download is not available in this browser", tone: "danger" });
  };

  const net = rows.find((r) => r.key === "estimatedNetReturn");
  const liveText = net ? `${selectedLabel}: estimated net return ${fmtValue(net.kind, net.selected)}, change vs current ${fmtDelta(net.kind, deltaOf(net))}.` : "";

  return (
    <div className="scn-page">
      <header className="scn-header">
        <div className="scn-header__text">
          <p className="scn-eyebrow">{farm.name}</p>
          <h1>Scenario Studio</h1>
          <p className="scn-explainer">
            Explore what-if estimates for your rotation under different rainfall, temperature, irrigation and cost conditions.
            These are <strong>what-if estimates, not forecasts or guaranteed income</strong>: they come from a simple model built on
            historical NASA climate data, simulated soil readings and typical crop figures.
          </p>
        </div>
        <div className="scn-actions" role="group" aria-label="Scenario actions">
          <Link to="/rotation" className="fw-btn fw-btn--ghost">← Back to Rotation Planner</Link>
          <Button onClick={() => setDrawerOpen(true)}>Assumptions</Button>
          <Button onClick={reset} disabled={atDefault} title={atDefault ? "Already at the Typical scenario" : undefined}>Reset</Button>
          <Button onClick={copy} disabled={!result}>Copy summary</Button>
          <Button onClick={download} disabled={!result}>Download .txt</Button>
        </div>
      </header>

      <div className="scn-layout">
        <Card className="scn-controls" aria-labelledby="scn-controls-h">
          <h2 id="scn-controls-h">Scenario</h2>
          <Select<PlanId> label="Compare current rotation with" value={selectedPlan?.id ?? activePlanId}
            onChange={(v) => setActivePlanId(v)} disabled={plans.length === 0}
            options={plans.map((p) => ({ value: p.id, label: `${p.title} (${p.feasible ? "feasible" : "not feasible"})` }))} />
          {selectedPlan ? <PlanSequence plan={selectedPlan} /> : null}
          {selectedPlan && !selectedPlan.feasible ? (
            <div className="scn-warning" role="note">
              <Badge tone="danger">Not feasible</Badge>
              <p>This plan failed a feasibility check{selectedPlan.constraints[0] ? `: ${selectedPlan.constraints[0]}` : "."} Its numbers are shown for comparison only and it is not recommended.</p>
            </div>
          ) : null}

          <div className="scn-presets">
            <h3 className="scn-subhead">Preset</h3>
            <Tabs idBase={TABS_ID} ariaLabel="Scenario presets" value={tabValue} onChange={choosePreset}
              items={PRESETS.map((p) => ({ id: p.id, label: p.label }))} />
            <TabPanel idBase={TABS_ID} activeId={tabValue}>
              <div className="scn-preset-status">
                {matched ? (
                  <p className="scn-preset-desc">{presetById(matched).description}</p>
                ) : (
                  <p className="scn-preset-desc">
                    <Badge tone="warn">Custom scenario</Badge>{" "}
                    <span data-testid="scn-custom-label">Custom (modified from {presetById(lastPreset).label})</span>
                  </p>
                )}
              </div>
              <div className="scn-sliders">
                <Slider name="rainfallDeltaPct" label="Rainfall change" value={scenario.rainfallDeltaPct}
                  min={limits.rainfallDeltaPct.min} max={limits.rainfallDeltaPct.max} step={limits.rainfallDeltaPct.step}
                  formatValue={fmtPct} description="Change to the historical seasonal rainfall."
                  onChange={(v) => update({ rainfallDeltaPct: v })} />
                <Slider name="temperatureDeltaC" label="Temperature change" value={scenario.temperatureDeltaC}
                  min={limits.temperatureDeltaC.min} max={limits.temperatureDeltaC.max} step={limits.temperatureDeltaC.step}
                  formatValue={fmtTemp} description="Added to the historical mean temperature."
                  onChange={(v) => update({ temperatureDeltaC: v })} />
                <Slider name="irrigationPct" label="Irrigation availability" value={scenario.irrigationPct}
                  min={limits.irrigationPct.min} max={limits.irrigationPct.max} step={limits.irrigationPct.step}
                  formatValue={fmtIrrigation}
                  description={rainfed
                    ? "This farm is rainfed, so irrigation availability has no effect on the results."
                    : "Share of your usual irrigation water that is available."}
                  onChange={(v) => update({ irrigationPct: v })} />
                <Slider name="inputCostDeltaPct" label="Input cost change" value={scenario.inputCostDeltaPct}
                  min={limits.inputCostDeltaPct.min} max={limits.inputCostDeltaPct.max} step={limits.inputCostDeltaPct.step}
                  formatValue={fmtPct} description="Seed, fertiliser and labour prices vs typical."
                  onChange={(v) => update({ inputCostDeltaPct: v })} />
              </div>
            </TabPanel>
          </div>
        </Card>

        <div className="scn-results">
          <p className="fw-sr-only" aria-live="polite">{liveText}</p>
          {climateStatus === "error" ? (
            <ErrorState title="Climate data unavailable"
              body={`${climateError ?? "The NASA climate snapshot could not be loaded."} Water and yield results are shown as Unknown until it loads.`}
              onRetry={retryClimate} />
          ) : null}

          <Card aria-labelledby="scn-inputs-h">
            <h2 id="scn-inputs-h">Inputs: observed vs scenario</h2>
            {climateStatus === "loading" ? (
              <div className="scn-skeletons"><Skeleton height={20} label="Loading climate data" /><Skeleton height={120} label="Loading climate data" /></div>
            ) : (
              <ScenarioInputsPanel climate={climateReady ? climate : null} soil={soil} farm={farm} inputs={scenario}
                waterSupplyMm={result?.waterSupplyMm ?? null} />
            )}
          </Card>

          <Card aria-labelledby="scn-results-h">
            <div className="scn-card-head">
              <h2 id="scn-results-h">Current rotation vs {comparingSelf ? "itself" : planTitle}</h2>
              <SourceBadge source="MODEL_ESTIMATE" />
            </div>
            <p className="scn-scenario-line">
              Scenario: <strong>{presetLabel}</strong> · rainfall {fmtPct(scenario.rainfallDeltaPct)} · temperature {fmtTemp(scenario.temperatureDeltaC)} ·
              irrigation {fmtIrrigation(scenario.irrigationPct)} · input costs {fmtPct(scenario.inputCostDeltaPct)}.
              Both plans are estimated under the same scenario.
            </p>
            {comparingSelf ? (
              <p className="scn-hint">The current rotation is selected, so every change is zero. Choose another plan above to compare.</p>
            ) : null}
            {climateStatus === "loading" ? (
              <div className="scn-skeletons"><Skeleton height={96} label="Calculating scenario" /><Skeleton height={96} label="Calculating scenario" /></div>
            ) : computed.error ? (
              <ErrorState title="Scenario could not be calculated" body={computed.error} />
            ) : result ? (
              <MetricTiles rows={rows} currentLabel={currentLabel} selectedLabel={selectedLabel} />
            ) : (
              <EmptyState title="No plans to compare" body="Rotation plans are not available for this farm yet." />
            )}
          </Card>

          <Card aria-labelledby="scn-unc-h" className="scn-uncertainty">
            <div className="scn-card-head">
              <h2 id="scn-unc-h">Uncertainty</h2>
              <SourceBadge source="MODEL_ESTIMATE" />
            </div>
            <ul className="scn-list">
              {(result?.uncertainty.length ? result.uncertainty : ["No result is available, so every value is Unknown."]).map((u) => <li key={u}>{u}</li>)}
            </ul>
          </Card>

          {result && climateStatus !== "loading" ? (
            <>
              <Card aria-labelledby="scn-chart-h">
                <h2 id="scn-chart-h" className="fw-sr-only">Charts</h2>
                <ScenarioCharts rows={rows} currentLabel={currentLabel} selectedLabel={selectedLabel} />
              </Card>
              <Card aria-labelledby="scn-table-h">
                <h2 id="scn-table-h">Numbers</h2>
                <ResultsTable rows={rows} currentLabel={currentLabel} selectedLabel={selectedLabel} />
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <AssumptionsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} result={result} planTitle={planTitle}
        sources={climateReady && climate ? climate.evidence.filter((e) => e.url).map((e) => ({ title: `NASA POWER: ${e.title}`, url: e.url as string, period: e.period })) : []} />
    </div>
  );
}
