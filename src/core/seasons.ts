/**
 * Season and crop vocabulary shared by onboarding, My Farm, the Dashboard and the agronomy model.
 *
 * The agronomy model (src/logic/agronomy) keys everything on two canonical season names.
 * Anything stored or typed in older spellings, for example "Long Rains (Mar–Jun)", is mapped to
 * the canonical name so every screen evaluates the same rotation.
 */
import { CROPS, LONG_RAINS, SHORT_RAINS } from '@/logic/agronomy';

export { LONG_RAINS, SHORT_RAINS };

export const SEASON_OPTIONS: { value: string; label: string }[] = [
  { value: LONG_RAINS, label: 'Long rains (Mar–Jun)' },
  { value: SHORT_RAINS, label: 'Short rains (Oct–Dec)' },
];

export const CROP_OPTIONS: { value: string; label: string }[] = CROPS.map((c) => ({ value: c.id, label: c.name }));

/** Map any saved or typed season spelling to the canonical model name; unknown names pass through. */
export function canonicalSeason(season: string): string {
  const s = season.trim().toLowerCase();
  if (s.startsWith('long')) return LONG_RAINS;
  if (s.startsWith('short')) return SHORT_RAINS;
  return season;
}

/** Display label with the months in brackets, e.g. "Long rains (Mar–Jun)". */
export function seasonLabel(season: string): string {
  const canon = canonicalSeason(season);
  return SEASON_OPTIONS.find((o) => o.value === canon)?.label ?? season;
}

export function cropLabel(cropId: string): string {
  return CROPS.find((c) => c.id === cropId)?.name ?? cropId;
}
