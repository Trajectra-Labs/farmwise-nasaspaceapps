/** Display helpers. Unknown is shown as "Unknown", never as 0 or a blank. */
export const UNKNOWN = 'Unknown'

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return UNKNOWN
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatNumber(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatPeriod(first: number | null, last: number | null): string {
  if (first === null || last === null) return UNKNOWN
  return first === last ? String(first) : `${first}\u2013${last}`
}

/** The API reports temperature as "C". Show it as "\u00b0C". The raw value stays in the manifest. */
export function displayUnit(unit: string | null | undefined): string {
  if (unit === undefined || unit === null || unit === '') return 'unit not stated'
  return unit === 'C' ? '\u00b0C' : unit
}
