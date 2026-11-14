import type { ClimateContext, FarmProfile } from '../../contracts/farmwise'

export type NasaSnapshotManifest = {
  status: 'not_loaded' | 'loaded'
  datasets: {
    id: string
    name: string
    url: string
    coordinates: string
    period: string
    units: string
    retrievedAt: string
  }[]
}

/** Placeholder: no real NASA POWER snapshot is committed yet, so no datasets are listed. */
export const nasaSnapshotManifest: NasaSnapshotManifest = { status: 'not_loaded', datasets: [] }

/** Placeholder: returns no numbers (null, never zero) until a real snapshot is loaded. */
export function getClimateContext(farm: FarmProfile): ClimateContext {
  return {
    locationId: farm.id,
    evidence: [],
    annualRainfallMm: null,
    meanTemperatureC: null,
    observedPeriod: 'Not loaded',
    snapshot: true,
  }
}
