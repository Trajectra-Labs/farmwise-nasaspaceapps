import manifestJson from './snapshots/manifest.json'

/** Provenance manifest written by scripts/fetch-nasa-power.mjs next to the unmodified API response. */
export type PowerManifest = {
  dataset: string
  farmName: string
  requestUrl: string
  documentationUrl: string
  snapshotFile: string
  requested: { lat: number; lon: number }
  returned: { lat: number; lon: number; elevationM: number | null } | null
  period: { start: number; end: number; temporalResolution: string }
  parameters: Record<string, { units: string | null; longName: string | null }>
  fillValue: number | null
  retrievedAt: string
  apiVersion: string | null
  sourceText: string | null
  spatialResolutionNote: string
}

export const powerManifest: PowerManifest = manifestJson as PowerManifest

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
  power: PowerManifest
}

function unitsText(m: PowerManifest): string {
  return Object.entries(m.parameters)
    .map(([k, v]) => `${k} (${v.longName ?? k}): ${v.units ?? 'unknown'}`)
    .join('; ')
}

/** Exported manifest: one dataset, loaded from the committed snapshot. */
export const nasaSnapshotManifest: NasaSnapshotManifest = {
  status: 'loaded',
  datasets: [
    {
      id: 'nasa-power-monthly',
      name: powerManifest.dataset,
      url: powerManifest.requestUrl,
      coordinates: `${powerManifest.returned?.lat ?? powerManifest.requested.lat}, ${powerManifest.returned?.lon ?? powerManifest.requested.lon}`,
      period: `${powerManifest.period.start}\u2013${powerManifest.period.end}`,
      units: unitsText(powerManifest),
      retrievedAt: powerManifest.retrievedAt,
    },
  ],
  power: powerManifest,
}
