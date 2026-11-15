// Moen · the ONE seam between Moen's features and other owners' modules (central store, NASA
// context, simulated soil). No new shared state is created here: everything is read from and
// written to the central FarmWise store. At integration only the "@fw/*" aliases (and, if the
// real useFarmWise() shape differs, the mapping in this file) need to change.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClimateContext, FarmWiseState, ScenarioInputs, SoilInput } from "@fw/contracts";
import { useFarmWise } from "@fw/core";
import { getClimateContext } from "@fw/nasa";
import { getSimulatedReading } from "@fw/simulated";
import { evaluateRotations } from "../../logic/agronomy";
import type { PlanId, RotationEvaluation } from "../../logic/agronomy/types";

export type ClimateStatus = "loading" | "ready" | "error";
export type MoenData = {
  state: FarmWiseState;
  farm: FarmWiseState["farm"];
  climate: ClimateContext | null;
  climateStatus: ClimateStatus;
  climateError: string | null;
  retryClimate: () => void;
  /** Farmer soil test if the farm has one, otherwise the simulated preset reading. */
  soil: SoilInput | null;
  evaluation: RotationEvaluation | null;
  activePlanId: PlanId;
  setActivePlanId: (id: PlanId) => void;
  scenario: ScenarioInputs;
  setScenario: (s: ScenarioInputs) => void;
};

export function useMoenData(): MoenData {
  const { state, actions } = useFarmWise();
  const farm = state.farm;
  const [climate, setClimate] = useState<ClimateContext | null>(null);
  const [climateStatus, setClimateStatus] = useState<ClimateStatus>("loading");
  const [climateError, setClimateError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setClimateStatus("loading");
    setClimateError(null);
    Promise.resolve()
      .then(() => getClimateContext(farm))
      .then((c) => { if (alive) { setClimate(c); setClimateStatus("ready"); } })
      .catch((e: unknown) => {
        if (!alive) return;
        setClimate(null);
        setClimateStatus("error");
        setClimateError(e instanceof Error ? e.message : "Climate context unavailable.");
      });
    return () => { alive = false; };
  }, [farm, attempt]);

  const soil = useMemo<SoilInput | null>(() => {
    if (farm?.knownSoil && farm.knownSoil.source === "USER_SOIL_TEST") return farm.knownSoil;
    try { return getSimulatedReading(state.soilPreset); } catch { return null; }
  }, [farm?.knownSoil, state.soilPreset]);

  // Evaluate even while climate is loading/failed: the model degrades to "missing info" + lower confidence.
  const evaluation = useMemo(
    () => (farm ? evaluateRotations(farm, climateStatus === "ready" ? climate : null, soil) : null),
    [farm, climate, climateStatus, soil],
  );

  const retryClimate = useCallback(() => setAttempt((a) => a + 1), []);
  return {
    state, farm, climate, climateStatus, climateError, retryClimate, soil, evaluation,
    activePlanId: state.activePlanId, setActivePlanId: actions.setActivePlanId,
    scenario: state.scenario, setScenario: actions.setScenario,
  };
}
