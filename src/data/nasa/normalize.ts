import type { Evidence } from '../../contracts/farmwise'

/** Subset of the NASA POWER monthly point response that we read. The stored file is the unmodified response. */
export type PowerResponse = {
  geometry?: { coordinates?: number[] }
  header?: { fill_value?: number; title?: string; api?: { version?: string } }
  parameters?: Record<string, { units?: string; longname?: string }>
  properties?: { parameter?: Record<string, Record<string, number | null | undefined>> }
}

export type MonthlyPoint = {
  /** YYYYMM key as delivered by POWER. */
  key: string
  year: number
  /** 1 to 12. */
  month: number
  /** Label such as "Mar 2019". */
  label: string
  t2m: number | null
  t2mMax: number | null
  t2mMin: number | null
  /** PRECTOTCORR as delivered (mm/day). */
  rainMmPerDay: number | null
  /** Monthly rainfall in mm = mm/day x days in month. Null when the daily mean is missing. */
  rainMm: number | null
}

export type AnnualRainfall = {
  year: number
  /** Sum of the 12 monthly mm values; null unless all 12 months are present. */
  totalMm: number | null
  monthsPresent: number
  /** Why the total is null, otherwise null. */
  reason: string | null
}

export type AnnualCrossCheck = {
  year: number
  /** POWER annual (YYYY13) mm/day value x days in year. */
  apiAnnualMm: number
  /** Our sum of monthly mm. */
  computedMm: number
  differenceMm: number
  differencePct: number
}

export type ClimatologyMonth = {
  month: number
  monthName: string
  meanRainMm: number | null
  yearsWithData: number
}

export type NormalizedClimate = {
  monthly: MonthlyPoint[]
  annual: AnnualRainfall[]
  crossChecks: AnnualCrossCheck[]
  climatology: ClimatologyMonth[]
  firstYear: number | null
  lastYear: number | null
  units: { temperature: string | null; rainfallDaily: string | null; rainfallMonthly: 'mm' }
  longNames: Record<string, string>
  fillValue: number
  completeYears: number
  meanAnnualRainfallMm: number | null
  meanTemperatureC: number | null
  wettestMonth: ClimatologyMonth | null
  driestMonth: ClimatologyMonth | null
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Maps the fill value, non-numbers and non-finite numbers to null. Never to 0. */
export function cleanValue(value: unknown, fillValue: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value === fillValue) return null
  return value
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Parses a YYYYMM key. Returns null for annual (YYYY13) and malformed keys. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function normalizePower(raw: PowerResponse): NormalizedClimate {
  const fillValue = raw.header?.fill_value ?? -999
  const param = raw.properties?.parameter ?? {}
  const t2m = param.T2M ?? {}
  const t2mMax = param.T2M_MAX ?? {}
  const t2mMin = param.T2M_MIN ?? {}
  const rain = param.PRECTOTCORR ?? {}

  const keys = new Set<string>()
  for (const series of [t2m, t2mMax, t2mMin, rain]) {
    for (const k of Object.keys(series)) if (parseMonthKey(k)) keys.add(k)
  }

  const monthly: MonthlyPoint[] = [...keys].sort().map((key) => {
    const { year, month } = parseMonthKey(key)!
    const perDay = cleanValue(rain[key], fillValue)
    return {
      key,
      year,
      month,
      label: `${MONTH_SHORT[month - 1]} ${year}`,
      t2m: cleanValue(t2m[key], fillValue),
      t2mMax: cleanValue(t2mMax[key], fillValue),
      t2mMin: cleanValue(t2mMin[key], fillValue),
      rainMmPerDay: perDay,
      rainMm: perDay === null ? null : perDay * daysInMonth(year, month),
    }
  })

  const years = [...new Set(monthly.map((p) => p.year))].sort((a, b) => a - b)
  const annual: AnnualRainfall[] = years.map((year) => {
    const pts = monthly.filter((p) => p.year === year)
    const present = pts.filter((p) => p.rainMm !== null)
    const complete = pts.length === 12 && present.length === 12
    return {
      year,
      totalMm: complete ? present.reduce((s, p) => s + (p.rainMm as number), 0) : null,
      monthsPresent: present.length,
      reason: complete
        ? null
        : `Only ${present.length} of 12 months have rainfall values, so no annual total is shown.`,
    }
  })

  const crossChecks: AnnualCrossCheck[] = []
  for (const a of annual) {
    const api = cleanValue(rain[`${a.year}13`], fillValue)
    if (api === null || a.totalMm === null) continue
    const apiAnnualMm = api * (isLeapYear(a.year) ? 366 : 365)
    const diff = a.totalMm - apiAnnualMm
    crossChecks.push({
      year: a.year,
      apiAnnualMm,
      computedMm: a.totalMm,
      differenceMm: diff,
      differencePct: apiAnnualMm === 0 ? 0 : (diff / apiAnnualMm) * 100,
    })
  }

  const climatology: ClimatologyMonth[] = MONTH_NAMES.map((monthName, i) => {
    const vals = monthly.filter((p) => p.month === i + 1 && p.rainMm !== null).map((p) => p.rainMm as number)
    return { month: i + 1, monthName, meanRainMm: mean(vals), yearsWithData: vals.length }
  })
  const withData = climatology.filter((c) => c.meanRainMm !== null)
  const wettest = withData.reduce<ClimatologyMonth | null>(
    (best, c) => (best === null || (c.meanRainMm as number) > (best.meanRainMm as number) ? c : best),
    null,
  )
  const driest = withData.reduce<ClimatologyMonth | null>(
    (best, c) => (best === null || (c.meanRainMm as number) < (best.meanRainMm as number) ? c : best),
    null,
  )

  const completeTotals = annual.filter((a) => a.totalMm !== null).map((a) => a.totalMm as number)
  const meanT = mean(monthly.filter((p) => p.t2m !== null).map((p) => p.t2m as number))

  return {
    monthly,
    annual,
    crossChecks,
    climatology,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    units: {
      temperature: raw.parameters?.T2M?.units ?? null,
      rainfallDaily: raw.parameters?.PRECTOTCORR?.units ?? null,
      rainfallMonthly: 'mm',
    },
    longNames: Object.fromEntries(
      Object.entries(raw.parameters ?? {}).map(([k, v]) => [k, v.longname ?? k]),
    ),
    fillValue,
    completeYears: completeTotals.length,
    meanAnnualRainfallMm: mean(completeTotals),
    meanTemperatureC: meanT,
    wettestMonth: wettest,
    driestMonth: driest,
  }
}

export type EvidenceOptions = {
  requestUrl: string
  retrievedAt: string
  spatialScale: string
}

export function formatPeriod(first: number | null, last: number | null): string {
  if (first === null || last === null) return 'Unknown'
  return first === last ? String(first) : `${first}\u2013${last}`
}

const RAIN_NOTE =
  'POWER gives PRECTOTCORR as a monthly mean in mm/day. FarmWise multiplies it by the days in each month to get mm per month, then adds the 12 months of a year.'

/** Builds Evidence objects (contract type) from the normalized snapshot. Nothing here is invented: missing means null. */
export function buildEvidence(n: NormalizedClimate, opts: EvidenceOptions): Evidence[] {
  const period = formatPeriod(n.firstYear, n.lastYear)
  const base = { source: 'NASA_OFFLINE_SNAPSHOT' as const, period, spatialScale: opts.spatialScale, url: opts.requestUrl }
  const retrieved = `Offline snapshot retrieved ${opts.retrievedAt.slice(0, 10)}.`
  const wet = n.wettestMonth
  const dry = n.driestMonth
  return [
    {
      ...base,
      id: 'nasa-power-annual-rainfall',
      title: 'Mean annual rainfall',
      value: n.meanAnnualRainfallMm === null ? null : round(n.meanAnnualRainfallMm, 0),
      unit: 'mm per year',
      note:
        n.meanAnnualRainfallMm === null
          ? `Unknown: no complete year in the snapshot. ${retrieved}`
          : `${RAIN_NOTE} Mean of ${n.completeYears} complete years; incomplete years are left out. Historical, regional, not a forecast. ${retrieved}`,
    },
    {
      ...base,
      id: 'nasa-power-mean-temperature',
      title: 'Mean air temperature at 2 m',
      value: n.meanTemperatureC === null ? null : round(n.meanTemperatureC, 1),
      unit: n.units.temperature === 'C' ? '\u00b0C' : (n.units.temperature ?? undefined),
      note:
        n.meanTemperatureC === null
          ? `Unknown: no temperature values in the snapshot. ${retrieved}`
          : `Average of monthly T2M values; months with a missing value are skipped. ${retrieved}`,
    },
    {
      ...base,
      id: 'nasa-power-wettest-month',
      title: 'Wettest month on average',
      value: wet ? wet.monthName : null,
      unit: undefined,
      note: wet
        ? `Mean ${round(wet.meanRainMm as number, 0)} mm over ${wet.yearsWithData} years. ${RAIN_NOTE} ${retrieved}`
        : `Unknown: no monthly rainfall values. ${retrieved}`,
    },
    {
      ...base,
      id: 'nasa-power-driest-month',
      title: 'Driest month on average',
      value: dry ? dry.monthName : null,
      unit: undefined,
      note: dry
        ? `Mean ${round(dry.meanRainMm as number, 0)} mm over ${dry.yearsWithData} years. ${RAIN_NOTE} ${retrieved}`
        : `Unknown: no monthly rainfall values. ${retrieved}`,
    },
  ]
}
