import type { ClimateContext, FarmProfile } from '../../contracts/farmwise'
import rawSnapshot from './snapshots/power-monthly-nakuru-2014-2023.json'
import { powerManifest } from './manifest'
import { buildEvidence, formatPeriod, normalizePower, type NormalizedClimate, type PowerResponse } from './normalize'

/** Up to this distance the snapshot is used as is. */
export const SNAPSHOT_FAR_KM = 50
/** Beyond SNAPSHOT_FAR_KM and up to this distance the values are kept with a nearest-snapshot note. Beyond it, no values. */
export const SNAPSHOT_MAX_KM = 300

export const SPATIAL_SCALE =
  'About 0.5\u00b0 \u00d7 0.625\u00b0 grid cell (MERRA-2 based): an area average, not a measurement at one field'

/** The committed, unmodified API response, normalized once. */
export const snapshotClimate: NormalizedClimate = normalizePower(rawSnapshot as unknown as PowerResponse)

export const snapshotPoint = {
  lat: powerManifest.returned?.lat ?? powerManifest.requested.lat,
  lon: powerManifest.returned?.lon ?? powerManifest.requested.lon,
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export const snapshotEvidence = buildEvidence(snapshotClimate, {
  requestUrl: powerManifest.requestUrl,
  retrievedAt: powerManifest.retrievedAt,
  spatialScale: SPATIAL_SCALE,
})

function validCoord(v: number | null | undefined, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max
}

/** Regional NASA POWER context from the offline snapshot. Never zero-fills; unknown stays null. */
export function getClimateContext(farm: FarmProfile): ClimateContext {
  if (!validCoord(farm.lat, 90) || !validCoord(farm.lon, 180)) {
    return {
      locationId: farm.id,
      evidence: [
        {
          id: 'nasa-power-no-location',
          source: 'NASA_OFFLINE_SNAPSHOT',
          title: 'Regional climate',
          value: null,
          note: 'No location. Set your farm location to see the nearest NASA POWER snapshot.',
        },
      ],
      annualRainfallMm: null,
      meanTemperatureC: null,
      observedPeriod: 'No location',
      snapshot: true,
    }
  }
  const km = haversineKm(farm.lat, farm.lon, snapshotPoint.lat, snapshotPoint.lon)
  if (km > SNAPSHOT_MAX_KM) {
    return {
      locationId: farm.id,
      evidence: [
        {
          id: 'nasa-power-too-far',
          source: 'NASA_OFFLINE_SNAPSHOT',
          title: 'Regional climate',
          value: null,
          note: `No NASA snapshot near this location (${Math.round(km)} km from ${powerManifest.farmName}). Values are not shown so the plan is not scored with another region's climate.`,
        },
      ],
      annualRainfallMm: null,
      meanTemperatureC: null,
      observedPeriod: 'No nearby snapshot',
      snapshot: true,
    }
  }
  const evidence = [...snapshotEvidence]
  if (km > SNAPSHOT_FAR_KM) {
    evidence.push({
      id: 'nasa-power-distance',
      source: 'NASA_OFFLINE_SNAPSHOT',
      title: 'Distance to snapshot point',
      value: Math.round(km),
      unit: 'km',
      period: formatPeriod(snapshotClimate.firstYear, snapshotClimate.lastYear),
      url: powerManifest.requestUrl,
      note: `This is the nearest available snapshot, ${Math.round(km)} km from your location (${powerManifest.farmName}). It describes that region, not your field.`,
    })
  }
  return {
    locationId: farm.id,
    evidence,
    annualRainfallMm: snapshotEvidence[0]?.value as number | null,
    meanTemperatureC: snapshotEvidence[1]?.value as number | null,
    observedPeriod: formatPeriod(snapshotClimate.firstYear, snapshotClimate.lastYear),
    snapshot: true,
  }
}
