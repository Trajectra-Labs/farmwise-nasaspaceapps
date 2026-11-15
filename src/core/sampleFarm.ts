/**
 * FarmWise sample farm fixture.
 *
 * A fictional demonstration farm in Nakuru County, Kenya. The farm details are invented for the
 * demo (FARMER_REPORTED examples, not a real household); only the climate context for this
 * location comes from NASA POWER (see src/data/nasa). Budget is in Kenyan shillings, the
 * currency used by the agronomy model.
 *
 * The current practice is maize in three of four seasons, so the rotation comparison has
 * something real to improve: a legume break and a more drought-tolerant crop mix.
 */
import type { FarmProfile } from '@/contracts/farmwise';

export const SAMPLE_FARM: FarmProfile = {
  id: 'sample-nakuru-001',
  name: 'Nakuru Valley Demo Farm',
  lat: -0.3,
  lon: 36.07,
  areaHa: 2,
  irrigation: 'limited',
  rotation: [
    { season: 'Long rains', cropId: 'maize', yearOffset: 0 },
    { season: 'Short rains', cropId: 'maize', yearOffset: 0 },
    { season: 'Long rains', cropId: 'maize', yearOffset: 1 },
    { season: 'Short rains', cropId: 'beans', yearOffset: 1 },
  ],
  priorities: ['water', 'soil'],
  budget: 120000,
  notes:
    'Sample farm for demonstration. Smallholder in Nakuru County, mostly rainfed with limited borehole irrigation. Values are FARMER_REPORTED examples, not a real household.',
};
