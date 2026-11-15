/**
 * Dashboard page tests — Shaheem
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FarmWiseProvider } from '@/core/store'
import DashboardPage from './DashboardPage'
import { currentSeason } from './season'
import { SAMPLE_FARM } from '@/core/sampleFarm'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <FarmWiseProvider>{children}</FarmWiseProvider>
    </MemoryRouter>
  )
}

function renderWithFarm(overrides: Partial<typeof SAMPLE_FARM> = {}, soilPreset = 'normal') {
  localStorage.setItem('farmwise_state_v3', JSON.stringify({
    farm: { ...SAMPLE_FARM, ...overrides },
    soilPreset,
    activePlanId: 'minimum',
    scenario: { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 },
    theme: 'light',
    lastPlantObservation: null,
  }))
  return render(<DashboardPage />, { wrapper: Wrapper })
}

beforeEach(() => localStorage.clear())

describe('DashboardPage', () => {
  it('D01: renders the farm name as the page heading', () => {
    renderWithFarm()
    expect(screen.getByRole('heading', { level: 1, name: 'Nakuru Valley Demo Farm' })).toBeInTheDocument()
  })

  it('D02: shows NASA provenance with period and retrieval date', () => {
    renderWithFarm()
    const strip = screen.getByLabelText('Data sources')
    expect(within(strip).getByText(/NASA POWER monthly, 2014–2023, retrieved 2026-11-14/)).toBeInTheDocument()
    expect(within(strip).getByText(/Last loaded/)).toBeInTheDocument()
  })

  it('shows a recommended next step derived from the plans', () => {
    renderWithFarm()
    const reco = screen.getByRole('heading', { name: /Consider the resilience plan|scores highest|Review your plan/ })
    expect(reco).toBeInTheDocument()
    expect(screen.getByText('Recommended next step')).toBeInTheDocument()
  })

  it('shows the four key indicators with source labels', () => {
    renderWithFarm()
    expect(screen.getByText('Selected plan score')).toBeInTheDocument()
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('Mean annual rainfall')).toBeInTheDocument()
    expect(screen.getAllByText('Soil moisture').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1481')).toBeInTheDocument() // NASA POWER mean annual rainfall, Nakuru snapshot
  })

  it('shows the selected rotation as an ordered sequence', () => {
    renderWithFarm()
    const list = screen.getByRole('list', { name: 'Crop sequence by season' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
  })

  it('D03: soil card reflects the preset', () => {
    renderWithFarm({}, 'dry')
    expect(screen.getAllByText(/Dry preset/).length).toBeGreaterThanOrEqual(2) // KPI footer + soil card
    expect(screen.getAllByText('18').length).toBeGreaterThanOrEqual(1) // dry-preset moisture
    expect(screen.getByText('Soil pH')).toBeInTheDocument()
  })

  it('D07: "Why this score?" lists readable evidence, not internal IDs', () => {
    renderWithFarm()
    fireEvent.click(screen.getByRole('button', { name: 'Why this score?' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByText(/Mean annual rainfall/).length).toBeGreaterThan(0)
    expect(within(dialog).queryByText('nasa-power-annual-rainfall')).not.toBeInTheDocument()
  })

  it('D08: missing location shows "Location not set", never a zero', () => {
    renderWithFarm({ lat: null, lon: null, areaHa: null })
    expect(screen.getByText('Location not set')).toBeInTheDocument()
    expect(screen.queryByText(/0\.00°/)).not.toBeInTheDocument()
  })

  it('renders no emoji characters', () => {
    const { container } = renderWithFarm()
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('currentSeason', () => {
  it('matches the farm season whose month range includes today', () => {
    expect(currentSeason(SAMPLE_FARM, new Date(2026, 10, 14))).toBe('In season: Short rains (Oct–Dec)')
    expect(currentSeason(SAMPLE_FARM, new Date(2026, 3, 1))).toBe('In season: Long rains (Mar–Jun)')
  })

  it('reports a gap between seasons', () => {
    expect(currentSeason(SAMPLE_FARM, new Date(2026, 7, 1))).toBe('Between planted seasons')
  })
})
