import { describe, expect, it, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { FarmWiseProvider, useFarmWise, STORAGE_KEY } from './store'
import { sanitizeState, sanitizeFarm } from './store'
import { SAMPLE_FARM } from './sampleFarm'
import { canonicalSeason, seasonLabel } from './seasons'

beforeEach(() => localStorage.clear())

describe('sanitizeState: corrupted or partial saved data', () => {
  it('returns safe defaults for non-objects', () => {
    for (const bad of [null, 'x', 42, [], undefined]) {
      const s = sanitizeState(bad)
      expect(s.farm).toBeNull()
      expect(s.soilPreset).toBe('normal')
      expect(s.activePlanId).toBe('current')
    }
  })

  it('drops an unusable farm but keeps other valid fields', () => {
    const s = sanitizeState({ farm: { name: 5 }, soilPreset: 'wet', theme: 'dark', scenario: { rainfallDeltaPct: -20 } })
    expect(s.farm).toBeNull()
    expect(s.soilPreset).toBe('wet')
    expect(s.theme).toBe('dark')
    expect(s.scenario).toEqual({ rainfallDeltaPct: -20, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 })
  })

  it('cleans fields inside a farm and never invents numbers', () => {
    const farm = sanitizeFarm({
      ...SAMPLE_FARM,
      lat: 'north',
      areaHa: Number.NaN,
      budget: '5',
      irrigation: 'flood',
      priorities: ['water', 'luck'],
      rotation: [{ season: 'Long Rains (Mar–Jun)', cropId: 'maize', yearOffset: 0 }, { cropId: 1 }],
    })!
    expect(farm.lat).toBeNull()
    expect(farm.areaHa).toBeNull()
    expect(farm.budget).toBeNull()
    expect(farm.irrigation).toBe('rainfed')
    expect(farm.priorities).toEqual(['water'])
    expect(farm.rotation).toEqual([{ season: 'Long rains', cropId: 'maize', yearOffset: 0 }])
  })
})

describe('seasons', () => {
  it('maps legacy spellings to the model vocabulary', () => {
    expect(canonicalSeason('Long Rains (Mar–Jun)')).toBe('Long rains')
    expect(canonicalSeason('short rains')).toBe('Short rains')
    expect(canonicalSeason('Dry season')).toBe('Dry season')
    expect(seasonLabel('Short rains')).toBe('Short rains (Oct–Dec)')
  })
})

function Probe() {
  const { state, actions } = useFarmWise()
  return (
    <div>
      <output data-testid="soil">{state.soilPreset}</output>
      <output data-testid="farm">{state.farm?.name ?? 'none'}</output>
      <button onClick={() => actions.setFarm(SAMPLE_FARM)}>set</button>
      <button onClick={() => actions.setSoilPreset('dry')}>dry</button>
      <button onClick={() => actions.updateFarm({ name: 'Renamed' })}>rename</button>
    </div>
  )
}

describe('FarmWiseProvider', () => {
  it('persists changes and restores them on the next load', () => {
    const first = render(<FarmWiseProvider><Probe /></FarmWiseProvider>)
    act(() => { screen.getByText('set').click() })
    act(() => { screen.getByText('dry').click() })
    act(() => { screen.getByText('rename').click() })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).farm.name).toBe('Renamed')
    first.unmount()
    render(<FarmWiseProvider><Probe /></FarmWiseProvider>)
    expect(screen.getByTestId('farm')).toHaveTextContent('Renamed')
    expect(screen.getByTestId('soil')).toHaveTextContent('dry')
  })

  it('survives corrupted JSON in storage', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    render(<FarmWiseProvider><Probe /></FarmWiseProvider>)
    expect(screen.getByTestId('farm')).toHaveTextContent('none')
  })
})
