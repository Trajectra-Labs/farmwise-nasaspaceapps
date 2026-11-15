/**
 * FarmWise central state store (single source of truth).
 *
 * One provider holds the farm profile, soil preset, active plan, scenario inputs, theme and
 * the last Plant Check observation. Everything is persisted to localStorage with schema
 * validation, so corrupted or partial saved data falls back to safe defaults instead of
 * crashing the app.
 *
 * Feature modules read `state` and call `actions`; the flat setters on the context value are
 * kept for the app shell, Dashboard, onboarding and My Farm.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type {
  FarmWiseState,
  FarmProfile,
  ScenarioInputs,
  PlantObservation,
  CropSeason,
  SoilInput,
  SourceKind,
} from '@/contracts/farmwise';
import { DEFAULT_STATE } from '@/contracts/farmwise';
import { canonicalSeason } from './seasons';

/** Farmer feedback on a Plant Check result. Stored beside the frozen contract state. */
export type PlantFeedback = {
  sampleId?: string;
  choice: 'confirm' | 'reject' | 'unsure';
  note: string;
  updatedAt: string;
  source: 'FARMER_REPORTED';
};

export type FarmWiseAppState = FarmWiseState & { plantFeedback: PlantFeedback | null };

const INITIAL_STATE: FarmWiseAppState = { ...DEFAULT_STATE, plantFeedback: null };

type PlanId = 'current' | 'minimum' | 'resilience';
type SoilPreset = 'dry' | 'normal' | 'wet';

type Action =
  | { type: 'SET_FARM'; farm: FarmProfile | null }
  | { type: 'UPDATE_FARM'; patch: Partial<FarmProfile> }
  | { type: 'SET_SOIL_PRESET'; preset: SoilPreset }
  | { type: 'SET_ACTIVE_PLAN'; planId: PlanId }
  | { type: 'SET_SCENARIO'; scenario: ScenarioInputs }
  | { type: 'RESET_SCENARIO' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_PLANT_OBSERVATION'; obs: PlantObservation | null }
  | { type: 'SET_PLANT_FEEDBACK'; feedback: PlantFeedback | null }
  | { type: 'RESET_ALL'; theme: 'light' | 'dark' };

function reducer(state: FarmWiseAppState, action: Action): FarmWiseAppState {
  switch (action.type) {
    case 'SET_FARM':
      // Changing the farm invalidates anything derived from the previous one.
      return { ...state, farm: action.farm, lastPlantObservation: action.farm ? state.lastPlantObservation : null };
    case 'UPDATE_FARM':
      return state.farm ? { ...state, farm: { ...state.farm, ...action.patch } } : state;
    case 'SET_SOIL_PRESET':
      return { ...state, soilPreset: action.preset };
    case 'SET_ACTIVE_PLAN':
      return { ...state, activePlanId: action.planId };
    case 'SET_SCENARIO':
      return { ...state, scenario: action.scenario };
    case 'RESET_SCENARIO':
      return { ...state, scenario: DEFAULT_STATE.scenario };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    case 'SET_PLANT_OBSERVATION':
      return { ...state, lastPlantObservation: action.obs };
    case 'SET_PLANT_FEEDBACK':
      return { ...state, plantFeedback: action.feedback };
    case 'RESET_ALL':
      return { ...INITIAL_STATE, theme: action.theme };
    default:
      return state;
  }
}

export const STORAGE_KEY = 'farmwise_state_v3';

const SOURCES: SourceKind[] = [
  'NASA_OBSERVED', 'NASA_OFFLINE_SNAPSHOT', 'SIMULATED_IOT', 'FARMER_REPORTED',
  'USER_SOIL_TEST', 'DEMO_IMAGE', 'MODEL_ESTIMATE',
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function sanitizeSoil(raw: unknown): SoilInput | undefined {
  if (!isObj(raw)) return undefined;
  const source = SOURCES.includes(raw.source as SourceKind) ? (raw.source as SourceKind) : 'FARMER_REPORTED';
  return {
    ph: numOrNull(raw.ph), n: numOrNull(raw.n), p: numOrNull(raw.p), k: numOrNull(raw.k),
    moisturePct: numOrNull(raw.moisturePct),
    source,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
  };
}

/** Returns a valid FarmProfile or null when the saved value is unusable. */
export function sanitizeFarm(raw: unknown): FarmProfile | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const rotation: CropSeason[] = Array.isArray(raw.rotation)
    ? raw.rotation.filter(
        (r): r is CropSeason =>
          isObj(r) && typeof r.season === 'string' && typeof r.cropId === 'string' && typeof r.yearOffset === 'number',
      ).map((r) => ({ ...r, season: canonicalSeason(r.season) }))
    : [];
  const priorities = Array.isArray(raw.priorities)
    ? (raw.priorities.filter((p) => p === 'water' || p === 'cost' || p === 'soil') as FarmProfile['priorities'])
    : [];
  const irrigation = raw.irrigation === 'limited' || raw.irrigation === 'regular' ? raw.irrigation : 'rainfed';
  const farm: FarmProfile = {
    id: raw.id,
    name: raw.name,
    lat: numOrNull(raw.lat),
    lon: numOrNull(raw.lon),
    areaHa: numOrNull(raw.areaHa),
    irrigation,
    rotation,
    priorities,
    budget: numOrNull(raw.budget),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
  const soil = sanitizeSoil(raw.knownSoil);
  if (soil) farm.knownSoil = soil;
  return farm;
}

function sanitizeScenario(raw: unknown): ScenarioInputs {
  if (!isObj(raw)) return DEFAULT_STATE.scenario;
  const d = DEFAULT_STATE.scenario;
  return {
    rainfallDeltaPct: numOrNull(raw.rainfallDeltaPct) ?? d.rainfallDeltaPct,
    temperatureDeltaC: numOrNull(raw.temperatureDeltaC) ?? d.temperatureDeltaC,
    irrigationPct: numOrNull(raw.irrigationPct) ?? d.irrigationPct,
    inputCostDeltaPct: numOrNull(raw.inputCostDeltaPct) ?? d.inputCostDeltaPct,
  };
}

function sanitizeObservation(raw: unknown): PlantObservation | null {
  if (!isObj(raw) || !Array.isArray(raw.visibleSigns) || !Array.isArray(raw.possibleConcerns)) return null;
  return {
    sampleId: typeof raw.sampleId === 'string' ? raw.sampleId : undefined,
    visibleSigns: raw.visibleSigns.filter((s): s is string => typeof s === 'string'),
    possibleConcerns: raw.possibleConcerns.filter((s): s is string => typeof s === 'string'),
    certaintyNote: typeof raw.certaintyNote === 'string' ? raw.certaintyNote : '',
    source: SOURCES.includes(raw.source as SourceKind) ? (raw.source as SourceKind) : 'FARMER_REPORTED',
  };
}

function sanitizeFeedback(raw: unknown): PlantFeedback | null {
  if (!isObj(raw)) return null;
  if (raw.choice !== 'confirm' && raw.choice !== 'reject' && raw.choice !== 'unsure') return null;
  return {
    sampleId: typeof raw.sampleId === 'string' ? raw.sampleId : undefined,
    choice: raw.choice,
    note: typeof raw.note === 'string' ? raw.note : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    source: 'FARMER_REPORTED',
  };
}

/** Validate anything read from storage. Never throws; unusable fields fall back to defaults. */
export function sanitizeState(parsed: unknown): FarmWiseAppState {
  if (!isObj(parsed)) return INITIAL_STATE;
  return {
    farm: sanitizeFarm(parsed.farm),
    soilPreset: parsed.soilPreset === 'dry' || parsed.soilPreset === 'wet' ? parsed.soilPreset : 'normal',
    activePlanId:
      parsed.activePlanId === 'minimum' || parsed.activePlanId === 'resilience' ? parsed.activePlanId : 'current',
    scenario: sanitizeScenario(parsed.scenario),
    theme: parsed.theme === 'dark' ? 'dark' : parsed.theme === 'light' ? 'light' : preferredTheme(),
    lastPlantObservation: sanitizeObservation(parsed.lastPlantObservation),
    plantFeedback: sanitizeFeedback(parsed.plantFeedback),
  };
}

function preferredTheme(): 'light' | 'dark' {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function loadFromStorage(): FarmWiseAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_STATE, theme: preferredTheme() };
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...INITIAL_STATE, theme: preferredTheme() };
  }
}

function saveToStorage(state: FarmWiseAppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota); the app keeps working in memory.
  }
}

export type FarmWiseActions = {
  setFarm: (farm: FarmProfile | null) => void;
  updateFarm: (patch: Partial<FarmProfile>) => void;
  setSoilPreset: (preset: SoilPreset) => void;
  setActivePlanId: (planId: PlanId) => void;
  setScenario: (scenario: ScenarioInputs) => void;
  resetScenario: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setPlantObservation: (obs: PlantObservation | null) => void;
  setPlantFeedback: (feedback: PlantFeedback | null) => void;
  resetAll: () => void;
};

type FarmWiseContextType = {
  state: FarmWiseAppState;
  actions: FarmWiseActions;
  dispatch: React.Dispatch<Action>;
  // Flat aliases used by the shell, Dashboard, onboarding and My Farm.
  setFarm: FarmWiseActions['setFarm'];
  clearFarm: () => void;
  setSoilPreset: FarmWiseActions['setSoilPreset'];
  setActivePlan: FarmWiseActions['setActivePlanId'];
  setScenario: FarmWiseActions['setScenario'];
  resetScenario: () => void;
  toggleTheme: () => void;
  setTheme: FarmWiseActions['setTheme'];
  setPlantObservation: FarmWiseActions['setPlantObservation'];
};

const FarmWiseContext = createContext<FarmWiseContextType | null>(null);

export function FarmWiseProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  /** Test/demo hook: start from this state instead of localStorage. */
  initialState?: Partial<FarmWiseAppState>;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, () =>
    initialState ? { ...INITIAL_STATE, ...initialState } : loadFromStorage(),
  );

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const setFarm = useCallback((farm: FarmProfile | null) => dispatch({ type: 'SET_FARM', farm }), []);
  const updateFarm = useCallback((patch: Partial<FarmProfile>) => dispatch({ type: 'UPDATE_FARM', patch }), []);
  const setSoilPreset = useCallback((preset: SoilPreset) => dispatch({ type: 'SET_SOIL_PRESET', preset }), []);
  const setActivePlanId = useCallback((planId: PlanId) => dispatch({ type: 'SET_ACTIVE_PLAN', planId }), []);
  const setScenario = useCallback((scenario: ScenarioInputs) => dispatch({ type: 'SET_SCENARIO', scenario }), []);
  const resetScenario = useCallback(() => dispatch({ type: 'RESET_SCENARIO' }), []);
  const toggleTheme = useCallback(() => dispatch({ type: 'TOGGLE_THEME' }), []);
  const setTheme = useCallback((theme: 'light' | 'dark') => dispatch({ type: 'SET_THEME', theme }), []);
  const setPlantObservation = useCallback((obs: PlantObservation | null) => dispatch({ type: 'SET_PLANT_OBSERVATION', obs }), []);
  const setPlantFeedback = useCallback((feedback: PlantFeedback | null) => dispatch({ type: 'SET_PLANT_FEEDBACK', feedback }), []);
  const clearFarm = useCallback(() => dispatch({ type: 'SET_FARM', farm: null }), []);

  const themeNow = state.theme;
  const resetAll = useCallback(() => dispatch({ type: 'RESET_ALL', theme: themeNow }), [themeNow]);

  const actions = useMemo<FarmWiseActions>(
    () => ({
      setFarm, updateFarm, setSoilPreset, setActivePlanId, setScenario, resetScenario,
      setTheme, setPlantObservation, setPlantFeedback, resetAll,
    }),
    [setFarm, updateFarm, setSoilPreset, setActivePlanId, setScenario, resetScenario, setTheme, setPlantObservation, setPlantFeedback, resetAll],
  );

  const value = useMemo<FarmWiseContextType>(
    () => ({
      state, actions, dispatch,
      setFarm, clearFarm, setSoilPreset, setActivePlan: setActivePlanId,
      setScenario, resetScenario, toggleTheme, setTheme, setPlantObservation,
    }),
    [state, actions, setFarm, clearFarm, setSoilPreset, setActivePlanId, setScenario, resetScenario, toggleTheme, setTheme, setPlantObservation],
  );

  return <FarmWiseContext.Provider value={value}>{children}</FarmWiseContext.Provider>;
}

export function useFarmWise() {
  const ctx = useContext(FarmWiseContext);
  if (!ctx) throw new Error('useFarmWise must be used inside FarmWiseProvider');
  return ctx;
}
