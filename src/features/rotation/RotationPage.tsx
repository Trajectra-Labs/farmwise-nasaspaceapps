// Moen · S3 Rotation Planner. Reads/writes only through useMoenData() (central store).
import { useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorState, Skeleton, SourceBadge, useToast } from "@fw/ui";
import { PLAN_ORDER, type PlanId } from "../../logic/agronomy/types";
import { useMoenData } from "./moenStore";
import { PlanCard } from "./PlanCard";
import { PlanDetails } from "./PlanDetails";
import { WhyDrawer } from "./WhyDrawer";
import { CompareDialog } from "./CompareDialog";
import { copyText, downloadJson } from "./exportUtils";
import { evaluationJson, summaryText } from "./logicBridge";
import { kes } from "./format";
import "./rotation.css";

const IRRIGATION_TEXT = { rainfed: "Rainfed", limited: "Limited irrigation", regular: "Regular irrigation" } as const;

export function RotationPage() {
  const data = useMoenData();
  const { farm, evaluation, climate, climateStatus, climateError, retryClimate, soil, activePlanId, setActivePlanId } = data;
  const toast = useToast();
  const navigate = useNavigate();
  const [whyId, setWhyId] = useState<PlanId | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  if (!farm) {
    return (
      <div className="rot-page">
        <h1>Rotation Planner</h1>
        <EmptyState
          title="Set up a farm first"
          body="The planner compares crop rotations for your farm, so it needs your crop sequence, location and irrigation first."
          action={<Button variant="primary" onClick={() => navigate("/onboarding")}>Set up a farm first</Button>}
        />
      </div>
    );
  }

  const plans = evaluation?.plans ?? [];
  const active = plans.find((p) => p.id === activePlanId) ?? plans[0] ?? null;
  const whyPlan = plans.find((p) => p.id === whyId) ?? null;
  const currentSeasons = plans.find((p) => p.id === "current")?.seasons ?? farm.rotation;
  const hasBudget = farm.budget != null;
  const exportDisabled = !evaluation;

  const select = (id: PlanId) => setActivePlanId(id);

  const onGroupKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("role") !== "radio") return;
    const ids = plans.length ? plans.map((p) => p.id) : [...PLAN_ORDER];
    const i = ids.indexOf(target.dataset.radioId as PlanId);
    let next: PlanId | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next);
    groupRef.current?.querySelector<HTMLElement>(`[data-radio-id="${next}"]`)?.focus();
  };

  const keepCurrent = () => {
    select("current");
    const cur = plans.find((p) => p.id === "current");
    toast.show({
      tone: "success",
      title: cur && !cur.feasible
        ? "Keeping your current rotation. Note: it fails a check — see Details."
        : "Keeping your current rotation. That is a valid choice; no changes needed.",
    });
  };

  const useInScenarios = () => {
    if (!active) return;
    if (!active.feasible) {
      toast.show({ tone: "danger", title: `“${active.title}” is not feasible, so it was not sent to scenarios.` });
      return;
    }
    select(active.id);
    toast.show({ tone: "success", title: `Using “${active.title}” in Scenario Studio.` });
    navigate("/scenarios");
  };

  const onCopy = async () => {
    if (!evaluation) return;
    const ok = await copyText(summaryText(farm, evaluation));
    toast.show(ok ? { tone: "success", title: "Rotation summary copied to clipboard." } : { tone: "danger", title: "Could not copy. Your browser blocked clipboard access." });
  };
  const onDownload = () => {
    if (!evaluation) return;
    const ok = downloadJson(`farmwise-rotations-${farm.id}.json`, evaluationJson(farm, evaluation));
    toast.show(ok ? { tone: "success", title: `Downloaded farmwise-rotations-${farm.id}.json` } : { tone: "danger", title: "Download failed in this browser." });
  };

  const climateSource = climate?.snapshot ? "NASA_OFFLINE_SNAPSHOT" : "NASA_OBSERVED";

  return (
    <div className="rot-page">
      <header className="rot-header">
        <div className="rot-header__text">
          <p className="rot-eyebrow">{farm.name}</p>
          <h1>Rotation Planner</h1>
          <p className="fw-muted rot-lede">
            Three complete crop rotations for your farm: what you grow now, a minimum change and a more resilient option.
            Scores are relative model estimates from historical climate, soil readings and your inputs. They are not forecasts or guarantees.
          </p>
        </div>
        <div className="rot-header__actions" role="group" aria-label="Plan actions">
          <Button onClick={keepCurrent}>Keep my current rotation</Button>
          <Button onClick={() => setCompareOpen(true)} disabled={!evaluation} aria-haspopup="dialog">Compare all</Button>
          <Button onClick={onCopy} disabled={exportDisabled} aria-describedby={exportDisabled ? "rot-export-note" : undefined}>Copy summary</Button>
          <Button onClick={onDownload} disabled={exportDisabled} aria-describedby={exportDisabled ? "rot-export-note" : undefined}>Download JSON</Button>
          {exportDisabled ? <p id="rot-export-note" className="rot-small fw-muted">Export is available once plans have been evaluated.</p> : null}
        </div>
      </header>

      <section className="rot-prov" aria-labelledby="rot-prov-h">
        <h2 id="rot-prov-h" className="rot-prov__title">What these plans are based on</h2>
        <div className="rot-prov__items">
          <div className="rot-prov__item" data-testid="prov-climate">
            <span className="rot-label">Climate</span>
            {climateStatus === "loading" ? (
              <Skeleton width={180} height={20} label="Loading climate evidence" />
            ) : climate ? (
              <span className="rot-prov__val">
                <SourceBadge source={climateSource} />
                <span>{climate.annualRainfallMm != null ? `${Math.round(climate.annualRainfallMm)} mm/yr rain` : "Rain unknown"}
                  {climate.meanTemperatureC != null ? ` · ${Math.round(climate.meanTemperatureC * 10) / 10} °C mean` : ""}
                  {` · ${climate.observedPeriod}`}</span>
              </span>
            ) : <span className="rot-prov__val"><Badge tone="warn">Unavailable</Badge></span>}
          </div>
          <div className="rot-prov__item" data-testid="prov-soil">
            <span className="rot-label">Soil</span>
            {soil ? (
              <span className="rot-prov__val">
                <SourceBadge source={soil.source} />
                <span>
                  {soil.moisturePct != null ? `${Math.round(soil.moisturePct)}% moisture` : "Moisture unknown"}
                  {soil.ph != null ? ` · pH ${soil.ph.toFixed(1)}` : ""}
                  {soil.source === "SIMULATED_IOT" ? ` · ${data.state.soilPreset} preset` : ""}
                </span>
              </span>
            ) : <span className="rot-prov__val"><Badge tone="warn">Unknown</Badge></span>}
          </div>
          <div className="rot-prov__item" data-testid="prov-farmer">
            <span className="rot-label">Your inputs</span>
            <span className="rot-prov__val">
              <SourceBadge source="FARMER_REPORTED" />
              <span>
                {IRRIGATION_TEXT[farm.irrigation]}
                {` · ${farm.areaHa != null ? `${farm.areaHa} ha` : "area unknown"}`}
                {` · ${farm.budget != null ? `budget ${kes(farm.budget)}` : "no budget given"}`}
              </span>
            </span>
          </div>
        </div>
      </section>

      {climateStatus === "error" ? (
        <div className="rot-climate-error">
          <ErrorState
            title="Climate evidence could not load"
            body={`${climateError ?? "Climate context unavailable."} Plans below still show, but without climate data their confidence is lower.`}
            onRetry={retryClimate}
          />
        </div>
      ) : null}

      <section aria-labelledby="rot-plans-h" className="rot-plans">
        <div className="rot-row rot-plans__head">
          <h2 id="rot-plans-h">Your three plans</h2>
          {evaluation ? (
            <p className="fw-muted rot-small rot-plans__why">
              {evaluation.recommendedId ? evaluation.recommendationReason : `No plan is recommended: ${evaluation.recommendationReason}`}
            </p>
          ) : null}
        </div>
        {!evaluation ? (
          <div className="rot-grid" aria-busy="true">
            {PLAN_ORDER.map((id) => <Skeleton key={id} height={320} label="Loading plan" />)}
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex: the checked radio inside is focusable
          <div ref={groupRef} className="rot-grid" role="radiogroup" aria-label="Choose a rotation plan" onKeyDown={onGroupKey}>
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                selected={p.id === active?.id}
                recommended={p.id === evaluation.recommendedId && p.feasible}
                tabbable={p.id === active?.id}
                currentSeasons={currentSeasons}
                hasBudget={hasBudget}
                onSelect={() => select(p.id)}
                onWhy={() => setWhyId(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {evaluation && active ? (
        <PlanDetails
          plan={active}
          evaluation={evaluation}
          recommended={active.id === evaluation.recommendedId && active.feasible}
          onUse={useInScenarios}
          onWhy={() => setWhyId(active.id)}
        />
      ) : null}

      <WhyDrawer plan={whyPlan} open={whyId != null} onClose={() => setWhyId(null)} />
      {evaluation ? <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} evaluation={evaluation} /> : null}
    </div>
  );
}
