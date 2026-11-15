import { MONTH_NAMES, type NormalizedClimate } from './normalize'

export type Season = {
  name: 'Long rains' | 'Short rains' | 'Rainy season'
  /** Calendar months (1 to 12) in order. A run over the year end looks like [12, 1, 2]. */
  months: number[]
  peakMonth: number
  peakMeanMm: number
}

export type InsightLink = { label: string; to: '/rotation' | '/scenarios' | '/' }

export type Insight = {
  id: 'start-month' | 'two-seasons' | 'variability' | 'temperature'
  title: string
  body: string
  link: InsightLink
}

export type ClimateInsights = {
  seasons: Season[]
  insights: Insight[]
  driestYear: { year: number; totalMm: number } | null
  wettestYear: { year: number; totalMm: number } | null
  annualCvPct: number | null
  maxTempC: number | null
  minTempC: number | null
}

/** A month counts as rainy when its mean over the years is at least this many mm. */
export const RAINY_MONTH_MM = 100
/** A month is a reliable start when at least this share of years reach RAINY_MONTH_MM in it. */
export const RELIABLE_SHARE = 0.7

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ROTATION: InsightLink = { label: 'Rotation Planner', to: '/rotation' }
const SCENARIOS: InsightLink = { label: 'Scenario Studio', to: '/scenarios' }

const prevMonth = (m: number) => (m === 1 ? 12 : m - 1)
const nextMonth = (m: number) => (m === 12 ? 1 : m + 1)
const monthName = (m: number) => MONTH_NAMES[m - 1] as string
const mm = (v: number) => Math.round(v).toLocaleString('en-GB')
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function monthMean(c: NormalizedClimate, month: number): number | null {
  return c.climatology.find((x) => x.month === month)?.meanRainMm ?? null
}

/** Contiguous runs of rainy months (mean >= RAINY_MONTH_MM), December wrapping to January, at least 2 months long. */
export function deriveSeasons(c: NormalizedClimate): Season[] {
  const rainy = (m: number) => {
    const v = monthMean(c, m)
    return v !== null && v >= RAINY_MONTH_MM
  }
  const runs: number[][] = []
  for (let m = 1; m <= 12; m++) {
    if (!rainy(m) || rainy(prevMonth(m))) continue // not the start of a run (or all 12 months are rainy)
    const run = [m]
    for (let n = nextMonth(m); rainy(n) && n !== m; n = nextMonth(n)) run.push(n)
    if (run.length >= 2) runs.push(run)
  }
  const stats = runs.map((months) => {
    const peakMonth = months.reduce((best, m) => ((monthMean(c, m) as number) > (monthMean(c, best) as number) ? m : best))
    return {
      months,
      peakMonth,
      peakMeanMm: monthMean(c, peakMonth) as number,
    }
  })
  const two = stats.length === 2
  // The season with the higher peak month is the long rains. (Comparing season totals would call a wider, flatter season long.)
  const longer = two && stats[0]!.peakMeanMm >= stats[1]!.peakMeanMm ? 0 : 1
  return stats
    .map(
      ({ months, peakMonth, peakMeanMm }, i): Season => ({
        name: two ? (i === longer ? 'Long rains' : 'Short rains') : 'Rainy season',
        months,
        peakMonth,
        peakMeanMm,
      }),
    )
    .sort((a, b) => a.months[0]! - b.months[0]!)
}

/** How many years reached `mm` in the month. Years with no value for the month are not counted at all, never as zero. */
export function yearsReaching(
  c: NormalizedClimate,
  month: number,
  threshold: number = RAINY_MONTH_MM,
): { hit: number; total: number } {
  const values = c.monthly.filter((p) => p.month === month && p.rainMm !== null).map((p) => p.rainMm as number)
  return { hit: values.filter((v) => v >= threshold).length, total: values.length }
}

export function formatMonthRange(months: number[]): string {
  return `${MONTH_SHORT[months[0]! - 1]}\u2013${MONTH_SHORT[months[months.length - 1]! - 1]}`
}

function startMonthInsight(c: NormalizedClimate, season: Season | undefined): Insight | null {
  if (!season) return null
  const first = season.months[0]!
  for (const m of [prevMonth(first), ...season.months]) {
    const now = yearsReaching(c, m)
    if (now.total === 0 || now.hit / now.total < RELIABLE_SHARE) continue
    const before = yearsReaching(c, prevMonth(m))
    if (before.total === 0 || before.hit / before.total >= RELIABLE_SHARE) return null
    const name = monthName(m)
    return {
      id: 'start-month',
      title: `${name} is the first month most years reach ${RAINY_MONTH_MM} mm`,
      body: `In the ${season.name.toLowerCase()} (${formatMonthRange(season.months)}), ${name} reached ${RAINY_MONTH_MM} mm in ${now.hit} of ${now.total} years. ${monthName(prevMonth(m))} did in ${before.hit} of ${before.total}.`,
      link: ROTATION,
    }
  }
  return null
}

function twoSeasonsInsight(seasons: Season[]): Insight | null {
  if (seasons.length !== 2) return null
  const part = (s: Season) =>
    `${s.name.toLowerCase()} in ${formatMonthRange(s.months)} (peak ${monthName(s.peakMonth)}, about ${mm(s.peakMeanMm)} mm)`
  return {
    id: 'two-seasons',
    title: 'Two rainy seasons a year',
    body: `The ${part(seasons[0]!)} and the ${part(seasons[1]!)}. A month counts as rainy when its average is ${RAINY_MONTH_MM} mm or more.`,
    link: ROTATION,
  }
}

function variability(c: NormalizedClimate) {
  const totals = c.annual.filter((a) => a.totalMm !== null).map((a) => ({ year: a.year, totalMm: a.totalMm as number }))
  if (totals.length < 3) return { driest: null, wettest: null, cv: null }
  const driest = totals.reduce((b, t) => (t.totalMm < b.totalMm ? t : b))
  const wettest = totals.reduce((b, t) => (t.totalMm > b.totalMm ? t : b))
  const avg = mean(totals.map((t) => t.totalMm))
  const sd = Math.sqrt(mean(totals.map((t) => (t.totalMm - avg) ** 2)))
  return { driest, wettest, cv: avg > 0 ? Math.round((sd / avg) * 100) : null }
}

function round1(v: number): string {
  return (Math.round(v * 10) / 10).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function temperatureInsight(max: number | null, min: number | null): Insight | null {
  if (max === null || min === null) return null
  const high = Number.isInteger(max) ? `about ${max} \u00b0C` : `under ${Math.ceil(max)} \u00b0C`
  return {
    id: 'temperature',
    title: 'Temperature range over the period',
    body: `Monthly average daily highs stayed ${high}. Monthly average daily lows went down to about ${round1(min)} \u00b0C.`,
    link: ROTATION,
  }
}

/** Plain-language findings computed from the snapshot. A rule without enough data returns nothing. Nulls are never zeros. */
export function deriveInsights(c: NormalizedClimate): ClimateInsights {
  const seasons = deriveSeasons(c)
  const v = variability(c)
  const maxes = c.monthly.filter((p) => p.t2mMax !== null).map((p) => p.t2mMax as number)
  const mins = c.monthly.filter((p) => p.t2mMin !== null).map((p) => p.t2mMin as number)
  const maxTempC = maxes.length ? Math.max(...maxes) : null
  const minTempC = mins.length ? Math.min(...mins) : null

  const variabilityInsight: Insight | null =
    v.driest && v.wettest && v.cv !== null
      ? {
          id: 'variability',
          title: `Yearly rainfall ranged from ${mm(v.driest.totalMm)} to ${mm(v.wettest.totalMm)} mm`,
          body: `The driest complete year was ${v.driest.year} with ${mm(v.driest.totalMm)} mm and the wettest was ${v.wettest.year} with ${mm(v.wettest.totalMm)} mm. Yearly totals differ from the average by about ${v.cv}% (coefficient of variation).`,
          link: SCENARIOS,
        }
      : null

  const insights = [
    startMonthInsight(c, seasons[0]),
    twoSeasonsInsight(seasons),
    variabilityInsight,
    temperatureInsight(maxTempC, minTempC),
  ].filter((i): i is Insight => i !== null)

  return {
    seasons,
    insights,
    driestYear: v.driest,
    wettestYear: v.wettest,
    annualCvPct: v.cv,
    maxTempC,
    minTempC,
  }
}
