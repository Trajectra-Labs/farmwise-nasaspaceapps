import raw from './snapshots/power-monthly-nakuru-2014-2023.json'
import { buildEvidence, cleanValue, daysInMonth, normalizePower, parseMonthKey, type PowerResponse } from './normalize'

function synthetic(rain: Record<string, number>, t2m: Record<string, number> = {}): PowerResponse {
  return {
    header: { fill_value: -999 },
    parameters: { PRECTOTCORR: { units: 'mm/day' }, T2M: { units: 'C' } },
    properties: { parameter: { PRECTOTCORR: rain, T2M: t2m, T2M_MAX: {}, T2M_MIN: {} } },
  }
}

function fullYear(year: number, perDay: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${year}${String(i + 1).padStart(2, '0')}`, perDay]))
}

describe('month keys', () => {
  it('parses YYYYMM and skips the YYYY13 annual key', () => {
    expect(parseMonthKey('201903')).toEqual({ year: 2019, month: 3 })
    expect(parseMonthKey('201913')).toBeNull()
    expect(parseMonthKey('2019')).toBeNull()
  })
})

describe('fill values', () => {
  it('maps -999 and missing to null, never 0', () => {
    expect(cleanValue(-999, -999)).toBeNull()
    expect(cleanValue(undefined, -999)).toBeNull()
    expect(cleanValue(null, -999)).toBeNull()
    expect(cleanValue(0, -999)).toBe(0)
    const n = normalizePower(synthetic({ '202001': -999, '202002': 1 }, { '202001': -999 }))
    expect(n.monthly[0]?.rainMm).toBeNull()
    expect(n.monthly[0]?.t2m).toBeNull()
    expect(n.monthly[1]?.rainMm).toBe(29)
  })
})

describe('mm/day to mm per month', () => {
  it('multiplies by days in month, including leap February', () => {
    expect(daysInMonth(2020, 2)).toBe(29)
    expect(daysInMonth(2021, 2)).toBe(28)
    const n = normalizePower(synthetic({ '202002': 2, '202102': 2, '202104': 1 }))
    expect(n.monthly.map((p) => p.rainMm)).toEqual([58, 56, 30])
  })

  it('sums a complete year', () => {
    const n = normalizePower(synthetic(fullYear(2021, 1)))
    expect(n.annual[0]?.totalMm).toBe(365)
    expect(n.meanAnnualRainfallMm).toBe(365)
    expect(n.completeYears).toBe(1)
  })
})

describe('incomplete years', () => {
  it('give a null total with a reason and are left out of the mean', () => {
    const rain = { ...fullYear(2020, 1), ...fullYear(2021, 1), '202105': -999 }
    const n = normalizePower(synthetic(rain))
    const y2021 = n.annual.find((a) => a.year === 2021)
    expect(y2021?.totalMm).toBeNull()
    expect(y2021?.reason).toMatch(/11 of 12/)
    expect(n.meanAnnualRainfallMm).toBe(366)
    expect(n.completeYears).toBe(1)
  })

  it('has no mean when no year is complete', () => {
    const n = normalizePower(synthetic({ '202001': 1 }))
    expect(n.meanAnnualRainfallMm).toBeNull()
    expect(n.meanTemperatureC).toBeNull()
  })
})

describe('real Nakuru snapshot', () => {
  const n = normalizePower(raw as unknown as PowerResponse)
  it('has 120 monthly points for 2014-2023 and units from the response', () => {
    expect(n.monthly).toHaveLength(120)
    expect(n.firstYear).toBe(2014)
    expect(n.lastYear).toBe(2023)
    expect(n.units.rainfallDaily).toBe('mm/day')
    expect(n.units.temperature).toBe('C')
    expect(n.completeYears).toBe(10)
  })
  it('converted annual totals agree with the API annual (YYYY13) value within 1 %', () => {
    expect(n.crossChecks).toHaveLength(10)
    for (const c of n.crossChecks) expect(Math.abs(c.differencePct)).toBeLessThan(1)
  })
})

describe('buildEvidence (E01)', () => {
  const n = normalizePower(raw as unknown as PowerResponse)
  const ev = buildEvidence(n, { requestUrl: 'https://power.larc.nasa.gov/x', retrievedAt: '2026-11-14T22:16:30.311Z', spatialScale: 'grid' })
  it('carries source, unit, period, scale, url and a note on every item', () => {
    expect(ev.length).toBeGreaterThanOrEqual(4)
    for (const e of ev) {
      expect(e.source).toBe('NASA_OFFLINE_SNAPSHOT')
      expect(e.period).toBe('2014\u20132023')
      expect(e.spatialScale).toBe('grid')
      expect(e.url).toMatch(/^https:\/\/power\.larc\.nasa\.gov\//)
      expect(e.note).toBeTruthy()
    }
    const rain = ev.find((e) => e.id === 'nasa-power-annual-rainfall')
    expect(rain?.unit).toBe('mm per year')
    expect(typeof rain?.value).toBe('number')
    expect(rain?.note).toMatch(/mm\/day/)
    expect(rain?.note).toMatch(/days in each month/)
  })
  it('uses null, not zero, when there is no data', () => {
    const empty = buildEvidence(normalizePower(synthetic({})), { requestUrl: 'u', retrievedAt: '2026-01-01T00:00:00Z', spatialScale: 's' })
    for (const e of empty) expect(e.value).toBeNull()
  })
})
