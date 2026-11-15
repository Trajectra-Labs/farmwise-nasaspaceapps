// Moen · the ONE seam between Moen's features and other owners' modules (central store, NASA
// context, simulated soil). No new shared state is created here: everything is read from and
// written to the central FarmWise store. At integration only the "@fw/*" aliases (and, if the
// real useFarmWise() shape differs, the mapping in this file) need to change.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClimateContext, FarmWiseState, ScenarioInputs, SoilInput } from "@fw/contracts";
import { useFarmWise } from "@fw/core";
import { getClimateContext } from "@fw/nasa";
import { getSimulatedReading } from "@fw/simulated";
import { evaluateRotations } from "../../logic/agronomy";
import type { PlanId, RotationEvaluation } from "../../logic/agronomy/types";

export type ClimateStatus = "loading" | "ready" | "error";

/**
 * The bundled NASA snapshot is synchronous, so the first render can already have its climate and
 * plans never flash an unscored, low-confidence state. A mocked or future async source returns a
 * promise (or throws); then the seed is ignored and the effect below loads it with a loading state.
 */
function seedClimate(farm: FarmWiseState["farm"]): ClimateContext | null {
  if (!farm) return null;
  try {
    const c = getClimateContext(farm) as unknown;
    return c && typeof (c as { then?: unknown }).then !== "function" ? (c as ClimateContext) : null;
  } catch {
    return null;
  }
}
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
  const [seed] = useState(() => seedClimate(farm));
  const skipFirstLoading = useRef(seed !== null);
  const [climate, setClimate] = useState<ClimateContext | null>(seed);
  /** Which coordinates the stored climate belongs to (REV-20). */
  const [climateKey, setClimateKey] = useState<string | null>(seed ? `${farm?.lat ?? null},${farm?.lon ?? null}` : null);
  const [climateStatus, setClimateStatus] = useState<ClimateStatus>(seed ? "ready" : "loading");
  const [climateError, setClimateError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Refetch only when the location changes (or on retry) — budget/irrigation/rotation edits must not
  // refetch or blank climate. The latest farm is read through a ref so the effect deps stay narrow.
  const farmRef = useRef(farm);
  useEffect(() => { farmRef.current = farm; });
  const lat = farm?.lat ?? null;
  const lon = farm?.lon ?? null;
  const hasFarm = farm != null;
  useEffect(() => {
    let alive = true;
    if (skipFirstLoading.current) skipFirstLoading.current = false;
    // The statuses below mirror an async source, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setClimateStatus("loading"); // keep the last good climate visible while refetching
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClimateError(null);
    Promise.resolve()
      .then(() => { if (!farmRef.current) throw new Error('No farm selected.'); return getClimateContext(farmRef.current); })
      .then((c) => { if (alive) { setClimate(c); setClimateKey(`${lat},${lon}`); setClimateStatus("ready"); } })
      .catch((e: unknown) => {
        if (!alive) return;
        setClimate(null);
        setClimateStatus("error");
        setClimateError(e instanceof Error ? e.message : "Climate context unavailable.");
      });
    return () => { alive = false; };
  }, [hasFarm, lat, lon, attempt]);

  const soil = useMemo<SoilInput | null>(() => {
    if (farm?.knownSoil && farm.knownSoil.source === "USER_SOIL_TEST") return farm.knownSoil;
    try { return getSimulatedReading(state.soilPreset); } catch { return null; }
  }, [farm?.knownSoil, state.soilPreset]);

  // Climate fetched for other coordinates is stale: never evaluate with it; show "loading" until the refetch lands.
  const stale = climate != null && climateKey !== `${lat},${lon}`;
  const usableClimate = stale || climateStatus === "error" ? null : climate;
  const exposedStatus: ClimateStatus = stale && climateStatus !== "error" ? "loading" : climateStatus;

  // Evaluate even while climate is loading/failed: the model degrades to "missing info" + lower confidence.
  // While refetching, the last good climate is still used (it is cleared only on error).
  const evaluation = useMemo(
    () => (farm ? evaluateRotations(farm, usableClimate, soil) : null),
    [farm, usableClimate, soil],
  );

  const retryClimate = useCallback(() => setAttempt((a) => a + 1), []);
  return {
    state, farm, climate: usableClimate, climateStatus: exposedStatus, climateError, retryClimate, soil, evaluation,
    activePlanId: state.activePlanId, setActivePlanId: actions.setActivePlanId,
    scenario: state.scenario, setScenario: actions.setScenario,
  };
}
