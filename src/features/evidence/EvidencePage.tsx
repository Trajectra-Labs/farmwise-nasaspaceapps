import { powerManifest, type PowerManifest } from '../../data/nasa/manifest'
import { snapshotClimate } from '../../data/nasa/climate'
import type { NormalizedClimate } from '../../data/nasa/normalize'
import { Badge, Card, EmptyState } from '../../ui'
import { ClimateCharts } from './ClimateCharts'
import { HowToRead, Limitations } from './Explainers'
import { FieldSensors } from './FieldSensors'
import { SourceCards, UnusedSources } from './SourceCards'
import { formatDate, formatNumber, formatPeriod, UNKNOWN } from './format'
import './evidence.css'

export type EvidencePageProps = {
  /** Normalized snapshot. Defaults to the committed NASA POWER snapshot; tests may pass another one. */
  climate?: NormalizedClimate
  manifest?: PowerManifest
}

type FigureProps = {
  title: string
  value: string | null
  unit?: string
  detail: string
}

function Figure({ title, value, unit, detail }: FigureProps) {
  return (
    <Card title={title} headingLevel={3}>
      <p className={value === null ? 'ev-metric ev-metric--unknown' : 'ev-metric'}>
        {value ?? UNKNOWN}
        {value !== null && unit ? <span className="ev-unit"> {unit}</span> : null}
      </p>
      <p className="ev-caption">{detail}</p>
      <div>
        <Badge source="NASA_OFFLINE_SNAPSHOT" />
      </div>
    </Card>
  )
}

const TOC: { id: string; label: string }[] = [
  { id: 'ev-figures', label: 'Key figures' },
  { id: 'ev-climate', label: 'Climate history' },
  { id: 'ev-sources', label: 'Data sources' },
  { id: 'ev-sensors', label: 'Field sensors' },
  { id: 'ev-unused', label: 'Other NASA datasets: not used' },
  { id: 'ev-read', label: 'How to read this' },
  { id: 'ev-limits', label: 'Limitations' },
]

export function EvidencePage({ climate = snapshotClimate, manifest = powerManifest }: EvidencePageProps) {
  const period = formatPeriod(climate.firstYear, climate.lastYear)
  const retrieved = formatDate(manifest.retrievedAt)
  const where = `${manifest.farmName}, NASA POWER, ${period}, snapshot retrieved ${retrieved}`
  const wet = climate.wettestMonth
  const dry = climate.driestMonth
  const hasData = climate.monthly.length > 0

  return (
    <div className="ev-page">
      <h1>Data &amp; Evidence</h1>
      <p className="ev-lede">
        Where the climate numbers in FarmWise come from, how far they can be trusted, and what they
        do not tell you. The numbers describe a region in the past. They are not measurements from
        your field.
      </p>

      <div className="ev-layout">
        <nav className="ev-toc" aria-label="On this page">
          <p className="ev-toc__title">On this page</p>
          <ol>
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.label}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="ev-content">
        <section className="ev-section" aria-labelledby="ev-figures">
          <h2 id="ev-figures">Key figures</h2>
          <div className="ev-grid">
            <Figure
              title="Mean annual rainfall"
              value={climate.meanAnnualRainfallMm === null ? null : formatNumber(climate.meanAnnualRainfallMm, 0)}
              unit="mm per year"
              detail={
                climate.meanAnnualRainfallMm === null
                  ? `No complete year in ${period}, so no annual mean. ${where}.`
                  : `Mean of ${climate.completeYears} complete years, ${period}. Regional grid average, not your field. ${where}.`
              }
            />
            <Figure
              title="Mean air temperature"
              value={climate.meanTemperatureC === null ? null : formatNumber(climate.meanTemperatureC, 1)}
              unit={'\u00b0C'}
              detail={`Mean of monthly T2M values at 2 m above ground, ${period}. ${where}.`}
            />
            <Figure
              title="Wettest month on average"
              value={wet ? wet.monthName : null}
              detail={
                wet
                  ? `About ${formatNumber(wet.meanRainMm, 0)} mm, averaged over ${wet.yearsWithData} years, ${period}. ${where}.`
                  : `No monthly rainfall values. ${where}.`
              }
            />
            <Figure
              title="Driest month on average"
              value={dry ? dry.monthName : null}
              detail={
                dry
                  ? `About ${formatNumber(dry.meanRainMm, 0)} mm, averaged over ${dry.yearsWithData} years, ${period}. ${where}.`
                  : `No monthly rainfall values. ${where}.`
              }
            />
          </div>
        </section>

        <section className="ev-section" aria-labelledby="ev-climate">
          <h2 id="ev-climate">Climate history</h2>
          {hasData ? (
            <ClimateCharts climate={climate} retrievedAt={manifest.retrievedAt} />
          ) : (
            <EmptyState
              title="No climate data in the snapshot"
              description="The saved NASA POWER snapshot has no monthly values, so there is nothing to chart."
            />
          )}
        </section>

        <section className="ev-section" aria-labelledby="ev-sources">
          <h2 id="ev-sources">Data sources</h2>
          <SourceCards climate={climate} manifest={manifest} />
        </section>

        <section className="ev-section" aria-labelledby="ev-sensors">
          <h2 id="ev-sensors">Field sensors</h2>
          <FieldSensors />
        </section>

        <section className="ev-section" aria-labelledby="ev-unused">
          <h2 id="ev-unused">Other NASA datasets: not used</h2>
          <UnusedSources />
        </section>

        <section className="ev-section" aria-labelledby="ev-read">
          <h2 id="ev-read">How to read this</h2>
          <HowToRead />
        </section>

        <section className="ev-section" aria-labelledby="ev-limits">
          <h2 id="ev-limits">Limitations</h2>
          <Limitations />
        </section>
        </div>
      </div>
    </div>
  )
}
