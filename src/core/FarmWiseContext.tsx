import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { FarmWiseState } from '../contracts/farmwise'

// Placeholder - owned by Genemor. Minimal read-only context with defaults; no actions or persistence yet.
export const defaultFarmWiseState: FarmWiseState = {
  farm: null,
  soilPreset: 'normal',
  activePlanId: 'current',
  scenario: {
    rainfallDeltaPct: 0,
    temperatureDeltaC: 0,
    irrigationPct: 100,
    inputCostDeltaPct: 0,
  },
  theme: 'light',
  lastPlantObservation: null,
}

const FarmWiseContext = createContext<FarmWiseState | null>(null)

export function FarmWiseProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: Partial<FarmWiseState>
}) {
  const value = useMemo<FarmWiseState>(
    () => ({ ...defaultFarmWiseState, ...initialState }),
    [initialState],
  )
  return <FarmWiseContext.Provider value={value}>{children}</FarmWiseContext.Provider>
}

export function useFarmWise(): FarmWiseState {
  const ctx = useContext(FarmWiseContext)
  if (!ctx) throw new Error('useFarmWise must be used inside <FarmWiseProvider>')
  return ctx
}
