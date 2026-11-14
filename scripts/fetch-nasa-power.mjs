#!/usr/bin/env node
// Fetches a monthly NASA POWER point series and stores the UNMODIFIED response plus a provenance manifest.
// Usage: node scripts/fetch-nasa-power.mjs [--lat -0.3031] [--lon 36.0800] [--name "..."] [--start 2014] [--end 2023]
// If the request fails, the script exits non-zero and writes nothing. It never generates values.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PARAMETERS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR']

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const [k, inline] = a.slice(2).split('=')
    out[k] = inline ?? argv[++i]
  }
  return out
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const args = parseArgs(process.argv.slice(2))
const name = args.name ?? 'Nakuru demo farm, Kenya'
const lat = Number(args.lat ?? -0.3031)
const lon = Number(args.lon ?? 36.08)
const start = Number(args.start ?? 2014)
const end = Number(args.end ?? 2023)

if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('--lat must be between -90 and 90')
if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('--lon must be between -180 and 180')
if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
  throw new Error('--start and --end must be years with start <= end')
}

const url =
  'https://power.larc.nasa.gov/api/temporal/monthly/point' +
  `?parameters=${PARAMETERS.join(',')}&community=AG&latitude=${lat}&longitude=${lon}` +
  `&start=${start}&end=${end}&format=JSON`

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src', 'data', 'nasa', 'snapshots')
const baseName = `power-monthly-${slug(name.split(',')[0].replace(/ demo farm/i, ''))}-${start}-${end}`

console.log(`Requesting ${url}`)
const retrievedAt = new Date().toISOString()
const res = await fetch(url, { headers: { accept: 'application/json' } })
const rawText = await res.text()
if (!res.ok) {
  console.error(`NASA POWER request failed: HTTP ${res.status}\n${rawText.slice(0, 500)}`)
  process.exit(1)
}
let data
try {
  data = JSON.parse(rawText)
} catch {
  console.error('NASA POWER response was not valid JSON; nothing written.')
  process.exit(1)
}
const series = data?.properties?.parameter
if (!series || PARAMETERS.some((p) => !series[p])) {
  console.error('NASA POWER response is missing expected parameters; nothing written.')
  process.exit(1)
}

const coords = data?.geometry?.coordinates // GeoJSON order: [lon, lat, elevation]
const meta = data?.properties?.parameter ? data.header : undefined
const manifest = {
  dataset: 'NASA POWER monthly point data (AG community)',
  farmName: name,
  requestUrl: url,
  documentationUrl: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
  snapshotFile: `${baseName}.json`,
  requested: { lat, lon },
  returned: Array.isArray(coords)
    ? { lon: coords[0], lat: coords[1], elevationM: coords[2] ?? null }
    : null,
  period: { start, end, temporalResolution: 'monthly' },
  parameters: Object.fromEntries(
    PARAMETERS.map((p) => [
      p,
      {
        units: data?.parameters?.[p]?.units ?? null,
        longName: data?.parameters?.[p]?.longname ?? null,
      },
    ]),
  ),
  fillValue: meta?.fill_value ?? null,
  retrievedAt,
  apiVersion: meta?.api?.version ?? null,
  sourceText: meta?.title ?? null,
  responseHeader: meta ?? null,
  messages: data?.messages ?? [],
  spatialResolutionNote:
    'NASA POWER documentation (https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/) states the primary meteorological source is a 1/2 degree latitude by 5/8 degree longitude grid from GMAO MERRA-2. The response header lists the sources as MERRA2 and POWER. Values are grid-cell averages, not measurements at the farm. Precipitation here is PRECTOTCORR (bias-corrected); POWER documents the higher-resolution GPM IMERG product (0.1 degree) as separate parameters, which this snapshot does not use.',
}

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, `${baseName}.json`), rawText.endsWith('\n') ? rawText : `${rawText}\n`)
await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${join(outDir, baseName)}.json and manifest.json (retrieved ${retrievedAt})`)
