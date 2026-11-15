// HARNESS stand-in for Genemor's src/core (FarmWiseProvider / useFarmWise). Moen's features
// access it ONLY through src/features/rotation/moenStore.ts so integration touches one file.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FarmProfile, FarmWiseState, ScenarioInputs } from "@fw/contracts";

export const SAMPLE_FARM: FarmProfile = {
  id: "sample-nakuru-01",
  name: "Sample farm · Nakuru (demo)",
  lat: -0.3, lon: 36.07, areaHa: 2,
  irrigation: "limited",
  rotation: [
    { season: "Long rains", cropId: "maize", yearOffset: 0 },
    { season: "Short rains", cropId: "maize", yearOffset: 0 },
    { season: "Long rains", cropId: "maize", yearOffset: 1 },
    { season: "Short rains", cropId: "beans", yearOffset: 1 },
  ],
  priorities: ["water", "soil"],
  budget: 120000,
  notes: "Sample farm for demonstration. Values are FARMER_REPORTED examples, not a real household.",
};
export const DEFAULT_SCENARIO: ScenarioInputs = { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 };
const DEFAULT_STATE: FarmWiseState = { farm: SAMPLE_FARM, soilPreset: "normal", activePlanId: "current", scenario: DEFAULT_SCENARIO, theme: "light", lastPlantObservation: null };
const KEY = "farmwise:harness:v1";

function load(): FarmWiseState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<FarmWiseState>;
    return { ...DEFAULT_STATE, ...parsed, scenario: { ...DEFAULT_SCENARIO, ...(parsed.scenario ?? {}) } };
  } catch { return DEFAULT_STATE; }
}

export type FarmWiseActions = {
  setFarm: (farm: FarmProfile | null) => void;
  updateFarm: (patch: Partial<FarmProfile>) => void;
  setSoilPreset: (p: FarmWiseState["soilPreset"]) => void;
  setActivePlanId: (id: FarmWiseState["activePlanId"]) => void;
  setScenario: (s: ScenarioInputs) => void;
  setTheme: (t: FarmWiseState["theme"]) => void;
  resetAll: () => void;
};
type Ctx = { state: FarmWiseState; actions: FarmWiseActions };
const FarmWiseCtx = createContext<Ctx | null>(null);

export function FarmWiseProvider({ children, initialState }: { children: ReactNode; initialState?: Partial<FarmWiseState> }) {
  const [state, setState] = useState<FarmWiseState>(() => (initialState ? { ...DEFAULT_STATE, ...initialState } : load()));
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }, [state]);
  useEffect(() => { document.documentElement.dataset.theme = state.theme; }, [state.theme]);
  const patch = useCallback((p: Partial<FarmWiseState>) => setState((s) => ({ ...s, ...p })), []);
  const actions = useMemo<FarmWiseActions>(() => ({
    setFarm: (farm) => patch({ farm }),
    updateFarm: (p) => setState((s) => (s.farm ? { ...s, farm: { ...s.farm, ...p } } : s)),
    setSoilPreset: (soilPreset) => patch({ soilPreset }),
    setActivePlanId: (activePlanId) => patch({ activePlanId }),
    setScenario: (scenario) => patch({ scenario }),
    setTheme: (theme) => patch({ theme }),
    resetAll: () => setState(DEFAULT_STATE),
  }), [patch]);
  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <FarmWiseCtx.Provider value={value}>{children}</FarmWiseCtx.Provider>;
}

export function useFarmWise(): Ctx {
  const ctx = useContext(FarmWiseCtx);
  if (!ctx) throw new Error("useFarmWise must be used within FarmWiseProvider");
  return ctx;
}
