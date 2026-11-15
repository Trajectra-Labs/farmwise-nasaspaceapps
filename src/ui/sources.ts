/**
 * Plain-language labels for every provenance kind — Shaheem
 * Used by SourceBadge and by explanations such as the Dashboard data legend.
 */
import type { SourceKind } from '@/contracts/farmwise';

export type SourceVariant = 'nasa' | 'simulated' | 'user' | 'estimate';

export const SOURCE_LABELS: Record<SourceKind, { label: string; variant: SourceVariant; description: string }> = {
  NASA_OBSERVED: { label: 'NASA observed', variant: 'nasa', description: 'Measured or reanalysed by NASA and retrieved live.' },
  NASA_OFFLINE_SNAPSHOT: { label: 'NASA offline snapshot', variant: 'nasa', description: 'Real NASA POWER history stored with the app. Regional, not field-level, and not a forecast.' },
  SIMULATED_IOT: { label: 'Simulated sensor', variant: 'simulated', description: 'Synthetic sensor reading for the demo. No real hardware is connected.' },
  FARMER_REPORTED: { label: 'Farmer input', variant: 'user', description: 'Entered or confirmed by the farmer.' },
  USER_SOIL_TEST: { label: 'User soil test', variant: 'user', description: 'Laboratory soil-test value entered by the farmer.' },
  DEMO_IMAGE: { label: 'Demo example', variant: 'estimate', description: 'Documented example used for demonstration, not a diagnosis.' },
  MODEL_ESTIMATE: { label: 'Model estimate', variant: 'estimate', description: 'Calculated by FarmWise from stated assumptions. Not a guarantee.' },
};

export function sourceDescription(source: SourceKind): { label: string; description: string } {
  const s = SOURCE_LABELS[source];
  return { label: s?.label ?? source, description: s?.description ?? '' };
}
