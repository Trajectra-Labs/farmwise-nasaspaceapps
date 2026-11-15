import { useId, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NormalizedClimate } from '../../data/nasa/normalize'
import { Badge, Button } from '../../ui'
import { AXIS, GRID, INITIAL, makeTooltip, S1, S2, S3, type Row } from './chartKit'
import { formatDate, formatNumber, formatPeriod, UNKNOWN } from './format'


type ChartCardProps = {
  title: string
  badgeLabel: string
  caption: string
  summary: string
  columns: string[]
  rows: Row[]
  tableCaption: string
  /** Text legend shown under the plot. */
  legend?: ReactNode
  children: ReactNode
}

/** Local ChartFrame-style wrapper: title, provenance badge, plot, summary, caption and a data table toggle. */
export function ChartCard({ title, badgeLabel, caption, summary, columns, rows, tableCaption, legend, children }: ChartCardProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <figure className="fw-card ev-chart" aria-labelledby={`${id}-t`}>
      <div className="fw-chart__header">
        <h3 id={`${id}-t`} className="fw-card__title">
          {title}
        </h3>
        <Badge label={badgeLabel} />
      </div>
      <div className="ev-chart__plot" role="img" aria-label={title} aria-describedby={`${id}-s`}>
        {children}
      </div>
      {legend}
      <p id={`${id}-s`} className="ev-chart__summary">
        <strong>Summary: </strong>
        {summary}
      </p>
      <figcaption className="ev-caption">{caption}</figcaption>
      <div className="ev-chart__actions">
        <Button
          variant="secondary"
          aria-expanded={open}
          aria-controls={`${id}-table`}
          aria-describedby={`${id}-t`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide data table' : 'Show data table'}
        </Button>
      </div>
      {open ? (
        <div
          id={`${id}-table`}
          className="ev-table-wrap"
          role="region"
          aria-label={`${title}: data table`}
          tabIndex={0}
        >
          <table className="ev-table">
            <caption>{tableCaption}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  {r.cells.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className={cell === null ? 'ev-unknown' : undefined}>
                        {cell ?? UNKNOWN}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  )
}

const monthLabel = (climate: NormalizedClimate) => (key: string) =>
  climate.monthly.find((p) => p.key === key)?.label ?? key

export type ClimateChartsProps = {
  climate: NormalizedClimate
  retrievedAt: string
  /** 'rain' = monthly and annual rainfall (every year). 'temperature' = monthly temperature. */
  view: 'rain' | 'temperature'
}

export function ClimateCharts({ climate, retrievedAt, view }: ClimateChartsProps) {
  const badgeLabel = `NASA snapshot \u00b7 ${formatDate(retrievedAt)}`
  const period = formatPeriod(climate.firstYear, climate.lastYear)
  const source = `NASA POWER monthly data, ${period}, offline snapshot retrieved ${formatDate(retrievedAt)}`
  const labelFor = monthLabel(climate)
  const januaries = climate.monthly.filter((p) => p.month === 1).map((p) => p.key)
  const missingRain = climate.monthly.filter((p) => p.rainMm === null).length
  const missingTemp = climate.monthly.filter((p) => p.t2m === null).length
  const gapNote = (n: number) =>
    n === 0 ? 'No months are missing.' : `${n} months are missing and appear as gaps, not zeros.`

  const rainRows: Row[] = climate.monthly.map((p) => ({
    key: p.key,
    cells: [
      p.label,
      p.rainMm === null ? null : formatNumber(p.rainMm, 0),
      p.rainMmPerDay === null ? null : formatNumber(p.rainMmPerDay, 2),
    ],
  }))
  const tempRows: Row[] = climate.monthly.map((p) => ({
    key: p.key,
    cells: [
      p.label,
      p.t2m === null ? null : formatNumber(p.t2m, 1),
      p.t2mMin === null ? null : formatNumber(p.t2mMin, 1),
      p.t2mMax === null ? null : formatNumber(p.t2mMax, 1),
    ],
  }))
  const annualRows: Row[] = climate.annual.map((a) => ({
    key: String(a.year),
    cells: [String(a.year), a.totalMm === null ? null : formatNumber(a.totalMm, 0), `${a.monthsPresent} of 12`],
  }))

  const monthlyData = climate.monthly.map((p) => ({ key: p.key, rain: p.rainMm, t2m: p.t2m, min: p.t2mMin, max: p.t2mMax }))
  const annualData = climate.annual.map((a) => ({ key: String(a.year), rain: a.totalMm }))

  const wet = climate.wettestMonth
  const dry = climate.driestMonth
  const rainSummary =
    wet && dry
      ? `Monthly rainfall, ${period}. On average ${wet.monthName} is the wettest month (${formatNumber(wet.meanRainMm, 0)} mm) and ${dry.monthName} the driest (${formatNumber(dry.meanRainMm, 0)} mm). ${gapNote(missingRain)}`
      : 'No monthly rainfall values are available in the snapshot.'
  const temps = climate.monthly.filter((p) => p.t2m !== null)
  const tempSummary =
    climate.meanTemperatureC === null || temps.length === 0
      ? 'No temperature values are available in the snapshot.'
      : `Monthly air temperature at 2 m, ${period}. The mean is ${formatNumber(climate.meanTemperatureC, 1)} \u00b0C across ${temps.length} months. ${gapNote(missingTemp)}`
  const annualSummary =
    climate.meanAnnualRainfallMm === null
      ? 'No complete year is available, so no annual totals are shown.'
      : `Yearly rainfall totals for complete years, ${period}. The mean is ${formatNumber(climate.meanAnnualRainfallMm, 0)} mm per year across ${climate.completeYears} complete years. Years with missing months show no total.`

  return (
    <div>
      {view === 'rain' ? (
        <>
      <ChartCard
        title="Monthly rainfall"
        badgeLabel={badgeLabel}
        caption={`${source}. Bars are observed history on a grid cell, converted from mm/day to mm per month.`}
        summary={rainSummary}
        columns={['Month', 'Rainfall (mm)', 'Daily mean (mm/day)']}
        rows={rainRows}
        tableCaption="Monthly rainfall from NASA POWER, PRECTOTCORR"
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
            <XAxis dataKey="key" ticks={januaries} tickFormatter={(k: string) => k.slice(0, 4)} tick={AXIS} stroke={GRID} />
            <YAxis tick={AXIS} stroke={GRID} width={56} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', style: AXIS }} />
            <Tooltip content={makeTooltip('mm', 0, badgeLabel, labelFor)} />
            <Bar dataKey="rain" name="Rainfall" fill={S1} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

        </>
      ) : null}
      {view === 'temperature' ? (
      <ChartCard
        title="Monthly temperature"
        badgeLabel={badgeLabel}
        caption={`${source}. Lines are observed history: T2M is the monthly mean; minimum and maximum are monthly means of daily lows and highs.`}
        summary={tempSummary}
        columns={['Month', 'Mean (\u00b0C)', 'Minimum (\u00b0C)', 'Maximum (\u00b0C)']}
        rows={tempRows}
        tableCaption="Monthly air temperature at 2 m from NASA POWER, T2M, T2M_MIN, T2M_MAX"
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <LineChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
            <XAxis dataKey="key" ticks={januaries} tickFormatter={(k: string) => k.slice(0, 4)} tick={AXIS} stroke={GRID} />
            <YAxis tick={AXIS} stroke={GRID} width={56} unit="" label={{ value: 'Temperature (\u00b0C)', angle: -90, position: 'insideLeft', style: AXIS }} />
            <Tooltip content={makeTooltip('\u00b0C', 1, badgeLabel, labelFor)} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span style={{ color: 'var(--color-text-2)' }}>{value}</span>}
            />
            <Line type="monotone" dataKey="max" name="Maximum" stroke={S3} strokeWidth={1.75} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="t2m" name="Mean" stroke={S1} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="min" name="Minimum" stroke={S2} strokeWidth={1.75} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      ) : null}
      {view === 'rain' ? (
      <ChartCard
        title="Annual rainfall"
        badgeLabel={badgeLabel}
        caption={`${source}. Totals are shown only for years with all 12 months of data.`}
        summary={annualSummary}
        columns={['Year', 'Rainfall (mm per year)', 'Months with data']}
        rows={annualRows}
        tableCaption="Annual rainfall totals from NASA POWER, complete years only"
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={annualData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
            <XAxis dataKey="key" tick={AXIS} stroke={GRID} />
            <YAxis tick={AXIS} stroke={GRID} width={56} label={{ value: 'Rainfall (mm per year)', angle: -90, position: 'insideLeft', style: AXIS }} />
            <Tooltip content={makeTooltip('mm', 0, badgeLabel, (l) => l)} />
            <Bar dataKey="rain" name="Rainfall" fill={S1} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      ) : null}
    </div>
  )
}
