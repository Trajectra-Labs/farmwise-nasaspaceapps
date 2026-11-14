import type { FarmProfile } from '../../contracts/farmwise'
import { getClimateContext, haversineKm, nasaSnapshotManifest, SNAPSHOT_FAR_KM, SNAPSHOT_MAX_KM } from '.'

const base: FarmProfile = {
  id: 'f1',
  name: 'Test farm',
  lat: -0.3031,
  lon: 36.08,
  irrigation: 'rainfed',
  rotation: [],
  priorities: [],
  notes: '',
}

describe('getClimateContext', () => {
  it('returns snapshot values for a farm at the snapshot point', () => {
    const ctx = getClimateContext(base)
    expect(ctx.snapshot).toBe(true)
    expect(ctx.observedPeriod).toBe('2014\u20132023')
    expect(ctx.annualRainfallMm).toBeGreaterThan(500)
    expect(ctx.meanTemperatureC).toBeGreaterThan(5)
    expect(ctx.evidence.find((e) => e.id === 'nasa-power-distance')).toBeUndefined()
  })

  it('returns nulls and a "No location" note when lat/lon are null', () => {
    const ctx = getClimateContext({ ...base, lat: null, lon: null })
    expect(ctx.annualRainfallMm).toBeNull()
    expect(ctx.meanTemperatureC).toBeNull()
    expect(ctx.observedPeriod).toBe('No location')
    expect(ctx.evidence[0]?.note).toMatch(/No location/)
    expect(ctx.evidence[0]?.value).toBeNull()
  })

  it('tier 2: adds a nearest-snapshot note with distance for a far farm, keeping regional data', () => {
    const ctx = getClimateContext({ ...base, lat: -1.29, lon: 36.82 }) // Nairobi, ~ 150 km
    const d = ctx.evidence.find((e) => e.id === 'nasa-power-distance')
    expect(d?.note).toMatch(/nearest available snapshot/)
    expect(d?.unit).toBe('km')
    expect(Number(d?.value)).toBeGreaterThan(100)
    expect(ctx.annualRainfallMm).not.toBeNull()
  })

  it('exports the distance thresholds', () => {
    expect(SNAPSHOT_FAR_KM).toBe(50)
    expect(SNAPSHOT_MAX_KM).toBe(300)
  })

  it('tier 1: within 50 km has values and no distance note', () => {
    const ctx = getClimateContext({ ...base, lat: -0.3031 + 0.3, lon: 36.08 }) // ~33 km
    expect(haversineKm(-0.0031, 36.08, -0.3031, 36.08)).toBeLessThan(SNAPSHOT_FAR_KM)
    expect(ctx.annualRainfallMm).not.toBeNull()
    expect(ctx.evidence.find((e) => e.id === 'nasa-power-distance')).toBeUndefined()
  })

  it('tier 3: over 300 km returns null values and the explanatory note', () => {
    const ctx = getClimateContext({ ...base, name: 'Test farm', lat: -3.37, lon: 36.82 }) // Arusha area, ~ 350 km
    expect(haversineKm(-3.37, 36.82, -0.3031, 36.08)).toBeGreaterThan(SNAPSHOT_MAX_KM)
    expect(ctx.annualRainfallMm).toBeNull()
    expect(ctx.meanTemperatureC).toBeNull()
    expect(ctx.evidence).toHaveLength(1)
    expect(ctx.evidence[0]?.value).toBeNull()
    expect(ctx.evidence[0]?.note).toMatch(
      /^No NASA snapshot near this location \(\d+ km from .+\)\. Values are not shown so the plan is not scored with another region's climate\.$/,
    )
  })

  it('treats out-of-range coordinates as no location', () => {
    expect(getClimateContext({ ...base, lat: 95 }).observedPeriod).toBe('No location')
  })
})

describe('haversineKm', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(haversineKm(1, 1, 1, 1)).toBe(0)
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0)
  })
})

describe('nasaSnapshotManifest (E01, E07)', () => {
  it('lists the real dataset with url, coordinates, period, units and retrieval time', () => {
    const m = nasaSnapshotManifest
    expect(m.status).toBe('loaded')
    const d = m.datasets[0]!
    expect(d.url).toMatch(/^https:\/\/power\.larc\.nasa\.gov\/api\/temporal\/monthly\/point\?/)
    expect(d.url).toContain('PRECTOTCORR')
    expect(d.units).toContain('mm/day')
    expect(d.period).toBe('2014\u20132023')
    expect(Number.isNaN(Date.parse(d.retrievedAt))).toBe(false)
    expect(m.power.fillValue).toBe(-999)
  })
})
