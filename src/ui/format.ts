/**
 * Shared display formatters — Shaheem
 * Presentation only: no rounding feeds back into stored data or calculations.
 */

/** "0.30° S, 36.10° E". Hemisphere letters replace the sign, so a value is never shown as "-0.3°N". */
export function formatLatLon(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat == null || lon == null) return 'Location not set';
  const ns = `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}`;
  const ew = `${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;
  return `${ns}, ${ew}`;
}
