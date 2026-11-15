/**
 * Season context for the Dashboard header — Shaheem
 * Reads month ranges written in the farm's own season labels, e.g. "Short Rains (Oct–Dec)".
 * No agronomic inference is made.
 */
import type { FarmProfile } from '@/contracts/farmwise';
import { seasonLabel } from '@/core/seasons';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthIndex(abbr: string): number {
  return MONTHS.indexOf(abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase());
}

export function currentSeason(farm: FarmProfile, now: Date): string {
  const month = now.getMonth();
  const seen = new Set<string>();
  for (const s of farm.rotation) {
    if (seen.has(s.season)) continue;
    seen.add(s.season);
    const m = seasonLabel(s.season).match(/\(([A-Za-z]{3})\s*[–-]\s*([A-Za-z]{3})\)/);
    if (!m) continue;
    const start = monthIndex(m[1] ?? '');
    const end = monthIndex(m[2] ?? '');
    if (start < 0 || end < 0) continue;
    const inRange = start <= end ? month >= start && month <= end : month >= start || month <= end;
    if (inRange) return `In season: ${seasonLabel(s.season)}`;
  }
  return 'Between planted seasons';
}
