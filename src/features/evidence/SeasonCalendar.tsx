import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMonthRange, RAINY_MONTH_MM, type ClimateInsights, type Season } from '../../data/nasa/insights'
import type { NormalizedClimate } from '../../data/nasa/normalize'
import { AXIS, GRID, INITIAL, type Row } from './chartKit'
import { ChartCard } from './ClimateCharts'
import { formatDate, formatNumber, formatPeriod, UNKNOWN } from './format'

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const OTHER = 'Below 100 mm on average'

/** Season colours come from theme tokens, so both themes keep their contrast. */
const SEASON_COLOR: Record<Season['name'], string> = {
  'Long rains': 'var(--color-accent)',
  'Rainy season': 'var(--color-accent)',
  'Short rains': 'var(--color-success)',
}
const OTHER_COLOR = 'var(--color-text-2)'

type MonthRow = {
  month: number
  label: string
  season: string
  fill: string
  mean: number | null
  low: number | null
  high: number | null
  years: number
}

function seasonRows(climate: NormalizedClimate, seasons: Season[]): MonthRow[] {
  return SHORT.map((label, i) => {
    const month = i + 1
    const season = seasons.find((s) => s.months.includes(month))
    const values = climate.monthly.filter((p) => p.month === month && p.rainMm !== null).map((p) => p.rainMm as number)
    return {
      month,
      label,
      season: season ? season.name : OTHER,
      fill: season ? SEASON_COLOR[season.name] : OTHER_COLOR,
      mean: climate.climatology[i]?.meanRainMm ?? null,
      low: values.length ? Math.min(...values) : null,
      high: values.length ? Math.max(...values) : null,
      years: values.length,
    }
  })
}

type DotProps = { cx?: number; cy?: number; index?: number }

function HighDot({ cx, cy, index }: DotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={index} />
  return <circle key={index} cx={cx} cy={cy} r={4.5} fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth={1.5} />
}

function LowDot({ cx, cy, index }: DotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={index} />
  return <circle key={index} cx={cx} cy={cy} r={4} fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth={2} />
}

function makeTooltip(badgeLabel: string) {
  return function SeasonTooltip({ active, payload }: TooltipContentProps<number | string | readonly (number | string)[], string | number>) {
    const row = payload?.[0]?.payload as MonthRow | undefined
    if (!active || !row) return null
    return (
      <div className="ev-tooltip">
        <p>
          <strong>{row.label}</strong> · {row.season}
        </p>
        <p>Average: {row.mean === null ? UNKNOWN : `${formatNumber(row.mean, 0)} mm`}</p>
        <p>Driest year: {row.low === null ? UNKNOWN : `${formatNumber(row.low, 0)} mm`}</p>
        <p>Wettest year: {row.high === null ? UNKNOWN : `${formatNumber(row.high, 0)} mm`}</p>
        <p className="ev-unknown">{badgeLabel}</p>
      </div>
    )
  }
}

export type SeasonCalendarProps = { climate: NormalizedClimate; insights: ClimateInsights; retrievedAt: string }

/** Mean monthly rainfall as bars coloured by season, with the lowest and highest year of each month as markers. */
export function SeasonCalendar({ climate, insights, retrievedAt }: SeasonCalendarProps) {
  // Below ~480 px three-letter months collide; show initials (the data table keeps full names).
  const [narrow, setNarrow] = useState(false)
  const badgeLabel = `NASA snapshot \u00b7 ${formatDate(retrievedAt)}`
  const period = formatPeriod(climate.firstYear, climate.lastYear)
  const rows = seasonRows(climate, insights.seasons)
  const seasonText =
    insights.seasons.length === 0
      ? `No run of two or more months averages ${RAINY_MONTH_MM} mm or more, so no rainy season is marked.`
      : insights.seasons
          .map((s) => `${s.name}: ${formatMonthRange(s.months)}, peak ${SHORT[s.peakMonth - 1]} at about ${formatNumber(s.peakMeanMm, 0)} mm`)
          .join('. ')
  const summary = `Average rainfall for each calendar month, ${period}. ${seasonText}. Markers show the driest and wettest year for each month.`

  const tableRows: Row[] = rows.map((r) => ({
    key: String(r.month),
    cells: [
      r.label,
      r.season,
      r.mean === null ? null : formatNumber(r.mean, 0),
      r.low === null ? null : formatNumber(r.low, 0),
      r.high === null ? null : formatNumber(r.high, 0),
      `${r.years}`,
    ],
  }))

  const legend = (
    <ul className="ev-legend" aria-label="Chart legend">
      {insights.seasons.map((s) => (
        <li key={s.name + s.months[0]}>
          <span className="ev-chip" style={{ background: SEASON_COLOR[s.name] }} aria-hidden="true" />
          {s.name}, {formatMonthRange(s.months)}
        </li>
      ))}
      <li>
        <span className="ev-chip" style={{ background: OTHER_COLOR }} aria-hidden="true" />
        Other months (average below {RAINY_MONTH_MM} mm)
      </li>
      <li>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="var(--color-text)" />
        </svg>
        Wettest year
      </li>
      <li>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="2" />
        </svg>
        Driest year
      </li>
    </ul>
  )

  return (
    <ChartCard
      title="Typical year by season"
      badgeLabel={badgeLabel}
      caption={`NASA POWER monthly data, ${period}, offline snapshot retrieved ${formatDate(retrievedAt)}. Bars are the average of each calendar month over the years. A month is marked rainy when its average is ${RAINY_MONTH_MM} mm or more. Observed history on a grid cell, not a forecast.`}
      summary={summary}
      columns={['Month', 'Season', 'Average (mm)', 'Driest year (mm)', 'Wettest year (mm)', 'Years with data']}
      rows={tableRows}
      tableCaption="Average, lowest and highest monthly rainfall for each calendar month, NASA POWER PRECTOTCORR"
      legend={legend}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={INITIAL}
        onResize={(w) => setNarrow(w < 480)}
      >
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
          <XAxis
            dataKey="label"
            tick={AXIS}
            stroke={GRID}
            interval={0}
            tickFormatter={(v: string) => (narrow ? v.charAt(0) : v)}
          />
          <YAxis tick={AXIS} stroke={GRID} width={56} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', style: AXIS }} />
          <Tooltip content={makeTooltip(badgeLabel)} />
          <Bar dataKey="mean" name="Average" isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.month} fill={r.fill} />
            ))}
          </Bar>
          <Line dataKey="high" name="Wettest year" stroke="none" dot={HighDot} activeDot={false} legendType="none" isAnimationActive={false} connectNulls={false} />
          <Line dataKey="low" name="Driest year" stroke="none" dot={LowDot} activeDot={false} legendType="none" isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
