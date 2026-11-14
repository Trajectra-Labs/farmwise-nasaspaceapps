import type { NormalizedClimate } from '../../data/nasa/normalize'
import type { PowerManifest } from '../../data/nasa/manifest'
import { SPATIAL_SCALE } from '../../data/nasa/climate'
import { Badge, Card } from '../../ui'
import { UNUSED_SOURCES } from './unusedSources'
import { displayUnit, formatDate, formatNumber, formatPeriod } from './format'

export const POWER_SITE = 'https://power.larc.nasa.gov/'

const coordText = (lat: number, lon: number): string => `${lat}, ${lon}`

export function UnusedSources() {
  return (
    <Card title="Other NASA datasets: not used" headingLevel={3} className="ev-source ev-source--unused">
      <p className="ev-caption">
        FarmWise has not retrieved any of these, so no values from them appear anywhere in the app.
      </p>
      <ul className="ev-unused">
        {UNUSED_SOURCES.map((s) => (
          <li key={s.id} className="ev-unused__row">
            <div className="ev-unused__head">
              <strong>{s.name}</strong>
              <Badge label="Not used" />
            </div>
            <p className="ev-unused__text">{s.adds}</p>
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              {s.linkText}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export type SourceCardsProps = { climate: NormalizedClimate; manifest: PowerManifest }

export function SourceCards({ climate, manifest }: SourceCardsProps) {
  const retrieved = formatDate(manifest.retrievedAt)
  const period = formatPeriod(climate.firstYear, climate.lastYear)
  const returned = manifest.returned
  const gaps = climate.monthly.filter((p) => p.rainMm === null || p.t2m === null).length
  return (
    <div className="ev-stack">
      <Card title="NASA POWER" headingLevel={3} className="ev-source">
        <p className="ev-status ev-status--used">Used · offline snapshot retrieved {retrieved}</p>
        <div>
          <Badge source="NASA_OFFLINE_SNAPSHOT" />
        </div>
        <dl className="ev-dl">
          <dt>Dataset</dt>
          <dd>
            {manifest.dataset}
            {manifest.apiVersion ? `, API ${manifest.apiVersion}` : ''}
          </dd>
          <dt>Location</dt>
          <dd>
            {manifest.farmName}. Requested {coordText(manifest.requested.lat, manifest.requested.lon)}
            {returned ? `; grid point returned ${coordText(returned.lat, returned.lon)}` : ''} (latitude,
            longitude)
          </dd>
          <dt>Period</dt>
          <dd>
            {period}, {manifest.period.temporalResolution}
          </dd>
          <dt>Parameters</dt>
          <dd>
            <ul className="ev-list">
              {Object.entries(manifest.parameters).map(([code, p]) => (
                <li key={code}>
                  {code}: {p.longName ?? code}, {displayUnit(p.units)}
                  {code === 'PRECTOTCORR' ? ' (converted here to mm per month)' : ''}
                </li>
              ))}
            </ul>
          </dd>
          <dt>Grid scale</dt>
          <dd>{SPATIAL_SCALE}</dd>
          <dt>Missing values</dt>
          <dd>
            POWER marks a missing value as {manifest.fillValue ?? 'a fill value'}. FarmWise shows it as
            Unknown, never as zero. Months with a missing value in this snapshot: {formatNumber(gaps, 0)}.
          </dd>
        </dl>
        <ul className="ev-links">
          <li>
            <a href={manifest.requestUrl} target="_blank" rel="noopener noreferrer">
              Exact NASA POWER request used for this snapshot
            </a>
          </li>
          <li>
            <a href={manifest.documentationUrl} target="_blank" rel="noopener noreferrer">
              NASA POWER monthly API documentation
            </a>
          </li>
          <li>
            <a href={POWER_SITE} target="_blank" rel="noopener noreferrer">
              NASA POWER project site
            </a>
          </li>
        </ul>
      </Card>
    </div>
  )
}
