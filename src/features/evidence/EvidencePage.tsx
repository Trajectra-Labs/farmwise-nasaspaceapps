import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { deriveInsights, formatMonthRange } from '../../data/nasa/insights'
import { powerManifest, type PowerManifest } from '../../data/nasa/manifest'
import { snapshotClimate } from '../../data/nasa/climate'
import type { NormalizedClimate } from '../../data/nasa/normalize'
import { Badge, EmptyState } from '../../ui'
import { ClimateCharts } from './ClimateCharts'
import { ClimateTabs } from './ClimateTabs'
import { HowToRead, Limitations } from './Explainers'
import { FieldSensors } from './FieldSensors'
import { InsightCards } from './InsightCards'
import { SeasonCalendar } from './SeasonCalendar'
import { SourceCards, UnusedSources } from './SourceCards'
import { formatDate, formatNumber, formatPeriod } from './format'
import './evidence.css'

export type EvidencePageProps = {
  /** Normalized snapshot. Defaults to the committed NASA POWER snapshot; tests may pass another one. */
  climate?: NormalizedClimate
  manifest?: PowerManifest
}

const NOT_AVAILABLE = 'Not available'

type StatProps = { label: string; value: string | null; unit?: string; detail: string }

function Stat({ label, value, unit, detail }: StatProps) {
  return (
    <div className="ev-stat">
      <dt>{label}</dt>
      <dd>
        <span className={value === null ? 'ev-stat__value ev-stat__value--unknown' : 'ev-stat__value'}>
          {value ?? NOT_AVAILABLE}
          {value !== null && unit ? <span className="ev-unit"> {unit}</span> : null}
        </span>
        <span className="ev-stat__detail">{detail}</span>
      </dd>
    </div>
  )
}

type TocEntry = { id: string; label: string; children?: TocEntry[] }

const TOC: TocEntry[] = [
  { id: 'ev-insights', label: 'What this means for your farm' },
  { id: 'ev-uses', label: 'Where FarmWise uses this' },
  { id: 'ev-climate', label: 'A typical year' },
  {
    id: 'ev-details',
    label: 'Details and sources',
    children: [
      { id: 'ev-sources', label: 'Data sources' },
      { id: 'ev-sensors', label: 'Field sensors' },
      { id: 'ev-unused', label: 'Other NASA datasets: not used' },
      { id: 'ev-read', label: 'How to read this' },
      { id: 'ev-limits', label: 'Limitations' },
    ],
  },
]

const USES: { label: string; to: '/rotation' | '/scenarios' | '/'; text: string }[] = [
  { label: 'Rotation Planner', to: '/rotation', text: 'Season timing and crop suitability' },
  { label: 'Scenario Studio', to: '/scenarios', text: 'The drier and wetter range of years' },
  { label: 'Dashboard', to: '/', text: 'Climate summary' },
]

/** A closed-by-default reference section. The h2 keeps the id for contents links and opens the section when linked. */
function Disclosure({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === `#${id}`)
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [id])
  return (
    <details className="ev-details" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      <div className="ev-details__body">
        <h2 id={id} className="ev-visually-hidden">
          {title}
        </h2>
        {children}
      </div>
    </details>
  )
}

export function EvidencePage({ climate = snapshotClimate, manifest = powerManifest }: EvidencePageProps) {
  const period = formatPeriod(climate.firstYear, climate.lastYear)
  const retrieved = formatDate(manifest.retrievedAt)
  const hasData = climate.monthly.length > 0
  const insights = useMemo(() => deriveInsights(climate), [climate])
  const totals = climate.annual.filter((a) => a.totalMm !== null)
  const driest = totals.reduce<(typeof totals)[number] | null>((b, a) => (b === null || (a.totalMm as number) < (b.totalMm as number) ? a : b), null)
  const wettest = totals.reduce<(typeof totals)[number] | null>((b, a) => (b === null || (a.totalMm as number) > (b.totalMm as number) ? a : b), null)
  const hasRain = climate.climatology.some((c) => c.meanRainMm !== null)
  const seasonNames = insights.seasons.map((s) => `${s.name.toLowerCase()} ${formatMonthRange(s.months)}`)

  const tabs = [
    {
      id: 'typical',
      label: 'Typical year',
      panel: <SeasonCalendar climate={climate} insights={insights} retrievedAt={manifest.retrievedAt} />,
    },
    {
      id: 'years',
      label: 'Every year',
      panel: <ClimateCharts climate={climate} retrievedAt={manifest.retrievedAt} view="rain" />,
    },
    {
      id: 'temperature',
      label: 'Temperature',
      panel: <ClimateCharts climate={climate} retrievedAt={manifest.retrievedAt} view="temperature" />,
    },
  ]

  return (
    <div className="ev-page">
      <header className="ev-header">
        <h1 className="ev-eyebrow">Data &amp; Evidence</h1>
        <p className="ev-title">Your climate, {manifest.farmName}</p>
        <p className="ev-period">
          <Badge source="NASA_OFFLINE_SNAPSHOT" />
          <span>
            NASA POWER monthly data, {period}. Snapshot retrieved {retrieved}.
          </span>
        </p>
        <p className="ev-lede">
          This is past weather for the grid cell around your farm. It is a regional average, not a
          forecast and not a measurement from your field.
        </p>
      </header>

      <section className="ev-section" aria-label="Summary">
        <dl className="ev-stats">
          <Stat
            label="Mean annual rain"
            value={climate.meanAnnualRainfallMm === null ? null : formatNumber(climate.meanAnnualRainfallMm, 0)}
            unit="mm"
            detail={climate.meanAnnualRainfallMm === null ? 'No complete year in the snapshot' : `Mean of ${climate.completeYears} complete years`}
          />
          <Stat
            label="Driest to wettest year"
            value={driest && wettest ? `${formatNumber(driest.totalMm, 0)}\u2013${formatNumber(wettest.totalMm, 0)}` : null}
            unit="mm"
            detail={driest && wettest ? `${driest.year} driest, ${wettest.year} wettest` : 'No complete year in the snapshot'}
          />
          <Stat
            label="Rainy seasons"
            value={hasRain ? String(insights.seasons.length) : null}
            detail={
              !hasRain
                ? 'No rainfall values in the snapshot'
                : seasonNames.length
                  ? seasonNames.join(', ')
                  : 'No month run averages 100 mm or more'
            }
          />
          <Stat
            label="Mean temperature"
            value={climate.meanTemperatureC === null ? null : formatNumber(climate.meanTemperatureC, 1)}
            unit={'\u00b0C'}
            detail={climate.meanTemperatureC === null ? 'No temperature values in the snapshot' : 'Air at 2 m, mean of monthly values'}
          />
        </dl>
        <p className="ev-caption">
          All four figures: NASA POWER snapshot, {period}, regional grid average.
        </p>
      </section>

      <div className="ev-layout">
        <nav className="ev-toc" aria-label="On this page">
          <p className="ev-toc__title">On this page</p>
          <ol>
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.label}</a>
                {t.children ? (
                  <ol>
                    {t.children.map((c) => (
                      <li key={c.id}>
                        <a href={`#${c.id}`}>{c.label}</a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
        <div className="ev-content">
          <section className="ev-section" aria-labelledby="ev-insights">
            <h2 id="ev-insights">What this means for your farm</h2>
            {insights.insights.length > 0 ? (
              <InsightCards insights={insights.insights} />
            ) : (
              <EmptyState
                title="No findings to show"
                description="The snapshot does not have enough rainfall or temperature values to work out seasons or yearly differences."
              />
            )}
          </section>

          <section className="ev-section" aria-labelledby="ev-uses">
            <h2 id="ev-uses">Where FarmWise uses this</h2>
            <ul className="ev-uses">
              {USES.map((u) => (
                <li key={u.to}>
                  <Link to={u.to}>{u.label}</Link>
                  <span>{u.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ev-section" aria-labelledby="ev-climate">
            <h2 id="ev-climate">A typical year</h2>
            {hasData ? (
              <ClimateTabs tabs={tabs} label="Climate charts" />
            ) : (
              <EmptyState
                title="No climate data in the snapshot"
                description="The saved NASA POWER snapshot has no monthly values, so there is nothing to chart."
              />
            )}
          </section>

          <section className="ev-section" aria-labelledby="ev-details">
            <h2 id="ev-details">Details and sources</h2>
            <div className="ev-disclosures">
              <Disclosure id="ev-sources" title="Data sources">
                <SourceCards climate={climate} manifest={manifest} />
              </Disclosure>
              <Disclosure id="ev-sensors" title="Field sensors">
                <FieldSensors />
              </Disclosure>
              <Disclosure id="ev-unused" title="Other NASA datasets: not used">
                <UnusedSources />
              </Disclosure>
              <Disclosure id="ev-read" title="How to read this">
                <HowToRead />
              </Disclosure>
              <Disclosure id="ev-limits" title="Limitations">
                <Limitations />
              </Disclosure>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
