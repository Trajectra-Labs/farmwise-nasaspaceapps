import { snapshotClimate } from './climate'
import { daysInMonth, normalizePower, type NormalizedClimate, type PowerResponse } from './normalize'
import { deriveInsights, deriveSeasons, RAINY_MONTH_MM, RELIABLE_SHARE, yearsReaching } from './insights'

/** Builds a climate whose monthly rainfall in mm is given by `mm(year, month)`. Null becomes the API fill value. */
function build(
  years: number[],
  mm: (year: number, month: number) => number | null,
  temps?: { max: number | null; min: number | null },
): NormalizedClimate {
  const rain: Record<string, number> = {}
  const tmax: Record<string, number> = {}
  const tmin: Record<string, number> = {}
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const key = `${y}${String(m).padStart(2, '0')}`
      const v = mm(y, m)
      rain[key] = v === null ? -999 : v / daysInMonth(y, m)
      if (temps) {
        tmax[key] = temps.max ?? -999
        tmin[key] = temps.min ?? -999
      }
    }
  }
  const raw: PowerResponse = {
    header: { fill_value: -999 },
    parameters: { PRECTOTCORR: { units: 'mm/day' }, T2M: { units: 'C' } },
    properties: { parameter: { PRECTOTCORR: rain, T2M: {}, T2M_MAX: tmax, T2M_MIN: tmin } },
  }
  return normalizePower(raw)
}

const YEARS = [2018, 2019, 2020, 2021, 2022]
const BANNED = /\b(will|should|forecast\w*|predict\w*|recommend\w*)\b/i

describe('constants', () => {
  it('uses 100 mm and 70 %', () => {
    expect(RAINY_MONTH_MM).toBe(100)
    expect(RELIABLE_SHARE).toBe(0.7)
  })
})

describe('Nakuru snapshot', () => {
  const result = deriveInsights(snapshotClimate)

  it('finds a long and a short rainy season', () => {
    expect(result.seasons.map((s) => [s.name, s.months, s.peakMonth, Math.round(s.peakMeanMm)])).toEqual([
      ['Long rains', [3, 4, 5], 4, 244],
      ['Short rains', [9, 10, 11, 12], 11, 210],
    ])
    expect(deriveSeasons(snapshotClimate)).toEqual(result.seasons)
  })

  it('counts years that reach 100 mm in March and April', () => {
    expect(yearsReaching(snapshotClimate, 4)).toEqual({ hit: 9, total: 10 })
    expect(yearsReaching(snapshotClimate, 3)).toEqual({ hit: 3, total: 10 })
  })

  it('returns four insights in a fixed order with links', () => {
    expect(result.insights.map((i) => i.id)).toEqual(['start-month', 'two-seasons', 'variability', 'temperature'])
    expect(result.insights.map((i) => i.link.to)).toEqual(['/rotation', '/rotation', '/scenarios', '/rotation'])
    expect(result.insights.map((i) => i.link.label)).toEqual([
      'Rotation Planner',
      'Rotation Planner',
      'Scenario Studio',
      'Rotation Planner',
    ])
  })

  it('start-month names April 9 of 10 against March 3 of 10', () => {
    const t = result.insights.find((i) => i.id === 'start-month')!
    const text = `${t.title} ${t.body}`
    expect(text).toContain('April')
    expect(text).toContain('9 of 10')
    expect(text).toContain('March')
    expect(text).toContain('3 of 10')
  })

  it('two-seasons names both ranges and peaks', () => {
    const t = result.insights.find((i) => i.id === 'two-seasons')!
    for (const s of ['Mar\u2013May', 'April', '244', 'Sep\u2013Dec', 'November', '210']) expect(t.body).toContain(s)
  })

  it('variability gives driest, wettest and CV', () => {
    expect(result.driestYear?.year).toBe(2014)
    expect(Math.round(result.driestYear!.totalMm)).toBe(914)
    expect(result.wettestYear?.year).toBe(2020)
    expect(Math.round(result.wettestYear!.totalMm)).toBe(2164)
    expect(result.annualCvPct).toBe(25)
    const t = result.insights.find((i) => i.id === 'variability')!
    for (const s of ['2014', '914 mm', '2020', '2,164 mm', '25%']) expect(t.body).toContain(s)
  })

  it('temperature gives the highest and lowest monthly means', () => {
    expect(result.maxTempC).toBeCloseTo(28.85, 2)
    expect(result.minTempC).toBeCloseTo(4.48, 2)
    const t = result.insights.find((i) => i.id === 'temperature')!
    expect(t.body).toContain('under 29 \u00b0C')
    expect(t.body).toContain('about 4.5 \u00b0C')
  })

  it('uses no forecast or advice wording', () => {
    for (const i of result.insights) expect(`${i.title} ${i.body}`).not.toMatch(BANNED)
  })
})

describe('missing data', () => {
  it('returns nothing for an empty climate', () => {
    const r = deriveInsights(normalizePower({}))
    expect(r.seasons).toEqual([])
    expect(r.insights).toEqual([])
    expect(r.driestYear).toBeNull()
    expect(r.wettestYear).toBeNull()
    expect(r.annualCvPct).toBeNull()
    expect(r.maxTempC).toBeNull()
    expect(r.minTempC).toBeNull()
    expect(yearsReaching(normalizePower({}), 4)).toEqual({ hit: 0, total: 0 })
  })

  it('does not count null months as hits', () => {
    const c = build(YEARS, (y, m) => (m === 4 ? (y < 2021 ? null : 150) : 20))
    expect(yearsReaching(c, 4)).toEqual({ hit: 2, total: 2 })
  })

  it('omits variability with fewer than 3 complete years', () => {
    const c = build([2020, 2021], () => 50)
    expect(deriveInsights(c).insights.find((i) => i.id === 'variability')).toBeUndefined()
    expect(deriveInsights(c).annualCvPct).toBeNull()
  })

  it('omits temperature when there are no temperature values', () => {
    const c = build(YEARS, () => 50)
    const r = deriveInsights(c)
    expect(r.maxTempC).toBeNull()
    expect(r.insights.find((i) => i.id === 'temperature')).toBeUndefined()
  })

  it('takes the extremes of the monthly values', () => {
    const c = build(YEARS, () => 50, { max: 30, min: 10 })
    const r = deriveInsights(c)
    expect(r.maxTempC).toBe(30)
    expect(r.minTempC).toBe(10)
  })
})

describe('season shapes', () => {
  it('one rainy run is "Rainy season" and gives no two-seasons insight', () => {
    const c = build(YEARS, (_y, m) => (m >= 4 && m <= 6 ? 150 : 20))
    const r = deriveInsights(c)
    expect(r.seasons).toHaveLength(1)
    expect(r.seasons[0]).toMatchObject({ name: 'Rainy season', months: [4, 5, 6] })
    expect(r.insights.find((i) => i.id === 'two-seasons')).toBeUndefined()
    const start = r.insights.find((i) => i.id === 'start-month')!
    expect(start.body).toContain('April')
    expect(start.body).toContain('5 of 5')
    expect(start.body).toContain('March')
    expect(start.body).toContain('0 of 5')
  })

  it('a single rainy month is not a season', () => {
    const c = build(YEARS, (_y, m) => (m === 7 ? 150 : 20))
    expect(deriveSeasons(c)).toEqual([])
  })

  it('a December to February run wraps over the year end', () => {
    const c = build(YEARS, (_y, m) => (m === 12 || m === 1 || m === 2 ? 150 : 20))
    const seasons = deriveSeasons(c)
    expect(seasons).toHaveLength(1)
    expect(seasons[0]).toMatchObject({ name: 'Rainy season', months: [12, 1, 2] })
    const start = deriveInsights(c).insights.find((i) => i.id === 'start-month')!
    expect(start.body).toContain('December')
    expect(start.body).toContain('November')
  })

  it('names two seasons by the higher peak and sorts them by first month', () => {
    // First run is the smaller one, so calendar order is Short then Long.
    const c = build(YEARS, (_y, m) => (m === 2 || m === 3 ? 110 : m >= 8 && m <= 10 ? 200 : 20))
    expect(deriveSeasons(c).map((s) => [s.name, s.months])).toEqual([
      ['Short rains', [2, 3]],
      ['Long rains', [8, 9, 10]],
    ])
  })

  it('copy has no forecast or advice wording', () => {
    const cs = [
      build(YEARS, (_y, m) => (m >= 4 && m <= 6 ? 150 : 20), { max: 31, min: 12 }),
      build(YEARS, (_y, m) => (m === 12 || m === 1 ? 150 : 20), { max: 25.5, min: 3 }),
    ]
    for (const c of cs) for (const i of deriveInsights(c).insights) expect(`${i.title} ${i.body}`).not.toMatch(BANNED)
  })
})
