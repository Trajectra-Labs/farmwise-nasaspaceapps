import type { FarmProfile } from '../../contracts/farmwise'
import { getClimateContext, nasaSnapshotManifest } from '.'

const farm: FarmProfile = {
  id: 'f1',
  name: 'Test farm',
  lat: -1.29,
  lon: 36.82,
  irrigation: 'rainfed',
  rotation: [],
  priorities: [],
  notes: '',
}

describe('getClimateContext', () => {
  it('returns nulls, not zeros, while no snapshot is loaded', () => {
    const ctx = getClimateContext(farm)
    expect(ctx.annualRainfallMm).toBeNull()
    expect(ctx.meanTemperatureC).toBeNull()
    expect(ctx.evidence).toEqual([])
    expect(ctx.observedPeriod).toBe('Not loaded')
    expect(ctx.snapshot).toBe(true)
  })

  it('manifest says not loaded with no datasets', () => {
    expect(nasaSnapshotManifest).toEqual({ status: 'not_loaded', datasets: [] })
  })
})
