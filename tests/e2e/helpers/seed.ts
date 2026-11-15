/// <reference lib="dom" />
import type { Page } from '@playwright/test'

export const SAMPLE = {
  id: 'sample-nakuru-001',
  name: 'Nakuru Valley Demo Farm',
  lat: -0.3,
  lon: 36.07,
  areaHa: 2,
  irrigation: 'limited',
  rotation: [
    { season: 'Long rains', cropId: 'maize', yearOffset: 0 },
    { season: 'Short rains', cropId: 'maize', yearOffset: 0 },
    { season: 'Long rains', cropId: 'maize', yearOffset: 1 },
    { season: 'Short rains', cropId: 'beans', yearOffset: 1 },
  ],
  priorities: ['water', 'soil'],
  budget: 120000,
  notes: 'Sample farm for demonstration.',
}

export const STATE_KEY = 'farmwise_state_v3'

/** Seeds persisted FarmWise state before any page script runs. Pass farm: null for a first-time visitor. */
export async function seedState(
  page: Page,
  opts: { theme?: 'light' | 'dark'; farm?: typeof SAMPLE | null; soilPreset?: string; once?: boolean } = {},
) {
  const state = {
    farm: opts.farm === undefined ? SAMPLE : opts.farm,
    soilPreset: opts.soilPreset ?? 'normal',
    activePlanId: 'current',
    scenario: { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 },
    theme: opts.theme ?? 'light',
    lastPlantObservation: null,
    plantFeedback: null,
  }
  await page.addInitScript(
    ([key, value, once]) => {
      // once: seed a single time per tab so reloads inside a test keep the app's own changes.
      try {
        if (once && window.sessionStorage.getItem('fw-seeded')) return
        window.localStorage.setItem(key as string, value as string)
        window.sessionStorage.setItem('fw-seeded', '1')
      } catch {
        /* storage unavailable */
      }
    },
    [STATE_KEY, JSON.stringify(state), !!opts.once] as const,
  )
}
