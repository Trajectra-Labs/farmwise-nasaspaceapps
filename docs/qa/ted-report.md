# Ted workstream report: NASA data, farm map, Evidence page

Branch: `ted/evidence`. Status: implemented. `pnpm qa` passes (typecheck, lint, 53 tests, build).

## Data provenance (real, retrieved, unmodified)

| Item | Value |
|---|---|
| Dataset | NASA POWER monthly point data, community AG, API v2.10.0 ("NASA/POWER Source Native Resolution Monthly and Annual") |
| Exact request URL | `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR&community=AG&latitude=-0.3031&longitude=36.08&start=2014&end=2023&format=JSON` |
| Retrieved at | 2026-11-14T22:16:30.311Z (second run; the first run at 22:15:47Z was replaced after I corrected the grid note) |
| Requested point | lat -0.3031, lon 36.08 (Nakuru demo farm, Kenya) |
| Point returned by API | lat -0.303, lon 36.08, elevation 2338.05 m |
| Period | 2014 to 2023, monthly (120 months plus YYYY13 annual values) |
| Parameters and units (from the response) | T2M "Temperature at 2 Meters" C; T2M_MAX "Temperature at 2 Meters Maximum" C; T2M_MIN "Temperature at 2 Meters Minimum" C; PRECTOTCORR "Precipitation Corrected" mm/day |
| Fill value | -999 (none occur in this snapshot; the code maps it and any missing key to null) |
| Response sources | MERRA2, POWER |
| Files | `src/data/nasa/snapshots/power-monthly-nakuru-2014-2023.json` (raw response, unmodified), `src/data/nasa/snapshots/manifest.json` |
| Re-fetch | `pnpm data:nasa` (flags `--lat --lon --name --start --end`) |

Grid scale: the response does not state it. NASA POWER's documentation (https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/) states the primary meteorological source is a 1/2 degree latitude by 5/8 degree longitude grid from GMAO MERRA-2. I did not find a documented separate grid for PRECTOTCORR, so the app quotes the MERRA-2 grid. My first draft called PRECTOTCORR an IMERG blend; the docs and response header do not support that, so I removed it.

## Rainfall unit conversion check

PRECTOTCORR monthly is mm/day. Monthly mm = value x days in month (leap years handled). Annual total = sum of 12 months, only when all 12 are present.

Cross-check against the API annual value (YYYY13 mm/day x days in year):

| Year | Sum of months (mm) | API annual x days (mm) | Difference |
|---|---|---|---|
| 2014 | 914.5 | 916.1 | -0.18 % |
| 2015 | 1405.8 | 1405.2 | +0.04 % |
| 2016 | 1156.8 | 1156.6 | +0.02 % |
| 2017 | 1237.9 | 1237.4 | +0.05 % |
| 2018 | 1928.6 | 1927.2 | +0.07 % |
| 2019 | 1746.7 | 1748.3 | -0.10 % |
| 2020 | 2164.0 | 2163.1 | +0.05 % |
| 2021 | 1329.5 | 1328.6 | +0.07 % |
| 2022 | 1229.6 | 1230.0 | -0.03 % |
| 2023 | 1699.5 | 1700.9 | -0.09 % |

Largest difference 0.18 %, consistent with the API rounding its annual mean to 2 decimals. A unit test asserts every year is within 1 %.

Derived figures shown: mean annual rainfall 1,481 mm (10 complete years), mean T2M 15.5 °C, wettest month April (about 244 mm), driest February (about 48 mm). These are regional grid values, not field measurements.

## Test ID results

"Pass" means an automated test or a check I ran this session passed. Nothing is marked pass without a run.

| ID | Result | Evidence |
|---|---|---|
| E01 NASA source gives URL/location/period/variable/units | Pass | `normalize.test.ts` (Evidence fields), `nasa.test.ts` (manifest), `EvidencePage.test.tsx` (NASA card) |
| E02 Observed chart shows real historical series | Pass | Three charts render from the snapshot; data table row counts asserted (120 months, 10 years). Visual check in Chrome at 1440 px. |
| E03 Unused products not shown as connected | Pass | Test: SMAP, GPM IMERG, MODIS, Landsat, ECOSTRESS cards say "Not used" and contain no digits |
| E04 Source links valid and descriptive | Pass for format; not link-crawled in CI | Test: https, `target=_blank`, `rel` has noopener, at least 3 words, not "here". I fetched the 6 outbound URLs once with curl (200); `modis.gsfc.nasa.gov` did not respond so the MODIS card links to the Earthdata MODIS page instead. |
| E05 Score weights and confidence explained | Partial | Score vs confidence definitions shown (generic, as requested). Score weights are not explained because the rotation model is Moen's and not in this branch. |
| E06 Satellite vs soil-sensor scale explained | Pass | Test on the scale card |
| E07 Offline traceable snapshot works | Pass | Charts and cards read only the bundled JSON. Production build contains no runtime NASA request. Not tested with the network physically disabled. |
| E08 Missing dates do not become zero rainfall | Pass | Normalizer and page tests: missing shows "Unknown", incomplete year has no total |
| E09 Map/graph works when tiles unavailable | Pass (unit level) | Tile-failure and offline notices tested with a stubbed map; charts need no network. Not tested against a truly blocked tile server in a browser. |
| E10 Disease risk not a diagnosis | Pass | Test asserts "does not diagnose plant disease" copy |
| F08 Map picker selects, clears, validates | Pass | `FarmMapPicker.test.tsx` (click, sample, clear, lat 95, lon 181, non-number). In Chrome with real OSM tiles, a map click filled the fields. |
| F09 Manual fallback without tiles | Pass (unit level) | Same caveat as E09 |
| F10 Unsaved edits warn before exit | Partial | The picker exposes `onDirtyChange(dirty)` and optional `savedValue`, tested. The warning itself (beforeunload or router blocker) must be wired by the parent (Genemor/Shaheem). |

Other checks run: `pnpm typecheck` pass, `pnpm lint` 0 errors (4 warnings in files I do not own), `pnpm build` pass. Screenshots (Chrome, light 375/1440/320, dark 1440) show no horizontal overflow; I looked at the light 1440 Evidence page and the My Farm map. I did not visually inspect the 320, 375 or dark images, and did not run axe or Playwright e2e.

## Design notes

- Leaflet and react-leaflet 4 (react-leaflet 5 needs React 19). The map is a lazy chunk (about 153 kB) behind a Suspense and error boundary, so a failed chunk or tile load leaves manual entry working.
- The pin is a CSS-drawn `divIcon`, so no Leaflet PNGs are bundled.
- Map keyboard path: the manual fields. The map itself pans and zooms with the keyboard, but placing a point by keyboard is not possible.
- OSM tiles come from `tile.openstreetmap.org`; fine for a demo, not for heavy production use under OSM's tile policy.

## Requested shared additions (not made; outside my folders)

1. `ChartFrame`: accept a custom badge label (for "NASA snapshot · 14 Nov 2026") and a built-in "Show data table" toggle. I built local equivalents in `src/features/evidence/ClimateCharts.tsx`.
2. Done in the review round (the one allowed edit): the stale `/evidence` assertion in `src/app/AppShell.test.tsx` now expects the heading and "offline snapshot" text.
3. `src/app/routes.tsx`: lazy-load `EvidencePage` (and Recharts) with `React.lazy`; the main bundle is 676 kB.
4. `src/test/setup.ts`: add a `ResizeObserver` stub so Recharts tests do not each need one.
5. `.gitignore`: Leaflet CSS ships inside the map chunk; no change needed. `scripts/` and `docs/` are new top-level folders.
6. A shared "Select/TextField" and icons (lucide-react is not installed) would replace my local `.field` markup and let error messages carry an icon as the UI guidelines require.
7. My Farm should pass `onDirtyChange` and `savedValue` to `FarmMapPicker` and handle the unsaved-edit warning.

## Open issues

- Valid-but-unfinished coordinates such as `-` or `1.` show no error until completed; a blur-time error is not implemented.
- The snapshot covers one point. See "Review round" for the distance tiers. The Evidence page itself always shows the demo point.
- hp-1 was unreachable over SSH this session, so builds and tests ran on the MacBook (small project, about 6 s per full test run).

## Review round (evidence page order, units, distance tiers, field sensors)

- Evidence page order: intro, in-page contents list, key figures, climate charts, NASA POWER source card, field sensors card, one compact "Other NASA datasets: not used" card (one row per dataset with a "Not used" badge, purpose and link), how to read this, limitations. The contents list is a sticky sidebar from 1024 px and a plain list above that.
- Units: the API unit "C" is shown as "°C" in the parameter list (helper `displayUnit`); the manifest keeps the raw "C". "Used - offline snapshot" is now "Used · offline snapshot".
- `getClimateContext` tiers, thresholds exported as `SNAPSHOT_FAR_KM` (50) and `SNAPSHOT_MAX_KM` (300):
  - up to 50 km: snapshot values, no note;
  - over 50 and up to 300 km: values kept plus the nearest-snapshot note and distance;
  - over 300 km: `annualRainfallMm` and `meanTemperatureC` are null, one evidence item with value null and the note "No NASA snapshot near this location (N km from Nakuru ...). Values are not shown so the plan is not scored with another region's climate."
  - Tests cover each tier and the exported constants. Boundary values exactly at 50 and 300 km are not tested.
- Field sensors card: static explainer in `src/features/evidence/FieldSensors.tsx`, no import from Abdullah's code. Comparison table (two columns on desktop, stacked under 768 px) for coverage, what it measures, update pattern and labelling. Links to `/farm` with the router `Link`. The wording about what a sensor measures ("such as soil moisture and soil temperature") is generic and is not checked against Abdullah's panel.
- Link test now checks only external (https) links, so the internal `/farm` link and contents anchors do not trip it.
- Not visually checked in a browser this round: sticky contents sidebar at 1024/1440, stacked comparison at 320/375, dark mode. Only jsdom tests and the build ran.
