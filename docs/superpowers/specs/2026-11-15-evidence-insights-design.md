# Evidence page: insights first (design)

**Owner:** Ted · **Approved:** 2026-11-15 (mockup "Your climate, Nakuru") · **Size:** small change

## Why
The Evidence page shows NASA POWER data but not what it means for a farm or where FarmWise uses it.
Judges and farmers should see the conclusions first and the reference material after.

## Goals
- Lead with plain-language findings computed from the snapshot, each linked to the FarmWise screen that uses it.
- Make the season pattern visible at a glance (season calendar).
- Keep every honesty rule: historical, regional grid average, not a forecast, provenance badge on every number.

## Non-goals / anti-goals
- No hand-written findings: if the snapshot changes, the findings change or disappear.
- No forecasts or advice ("you should plant on 12 April"). No AI-styled decoration (guidelines §11).
- Do not edit `src/contracts`, `src/app`, `src/ui`, or `src/styles` (Shaheem's), except adding `lucide-react` to dependencies.

## Approaches considered
1. **Insights first, each linked to where FarmWise uses it** (picked by Ted).
2. Keep the reference layout and add a "What this means" box: cheap, but it still buries the point.
3. A guided story/scroll page: heavy, and it hides the data tables judges look for.

## Design
1. **Header:** "Your climate, {farmName}", badge `NASA_OFFLINE_SNAPSHOT`, period line.
2. **Summary strip:** mean annual rain, range of annual totals (lowest–highest year), number of rainy seasons, mean temperature.
3. **"What this means for your farm":** up to 4 finding cards from `deriveInsights(climate)`. Each card has an icon,
   title, one-sentence evidence with real numbers, the label "Calculated from NASA snapshot", and a "Used in …" link.
   Rules (deterministic):
   - *Reliable start month:* in each rainy season, the first month in which ≥ 70% of years reach ≥ 100 mm, contrasted with the month
     before it. Nakuru: April 9/10 vs March 3/10.
   - *Seasons:* rainy months = climatology mean ≥ 100 mm; contiguous runs (Dec→Jan wraps) with ≥ 2 months form a season;
     the peak month of each. Nakuru: long rains Mar–May (peak Apr 244 mm), short rains Oct–Dec (peak Nov 210 mm).
   - *Year-to-year variability:* driest vs wettest complete year and the CV. Nakuru: 2014 914 mm vs 2020 2,164 mm, CV 25%.
   - *Temperature bounds:* highest T2M_MAX and lowest T2M_MIN. Nakuru: highs under 29 °C, coldest nights about 4.5 °C.
   - Any rule without enough data returns nothing (no card), never a guess.
4. **"Where FarmWise uses this":** a compact strip linking Rotation Planner (`/rotation`), Scenario Studio (`/scenarios`),
   Dashboard (`/`).
5. **Season calendar** (Recharts): mean monthly rain bars coloured by season (long rains, short rains, drier months),
   with markers for the driest and wettest year in each month. Tabs: Typical year · Every year (existing charts) · Temperature.
   Each keeps a data-table toggle.
6. **Reference sections** in `<details>` disclosures: Data sources, Field sensors, Other NASA datasets not used, How to
   read this, Limitations. Existing content is reused.

## Left to the builder
Exact CSS, icon choice (lucide-react), and the tab component, which must follow ARIA tabs.
