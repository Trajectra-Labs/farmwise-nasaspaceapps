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

## E2E and accessibility round (Playwright + axe, 15 Nov 2026)

Run: `pnpm exec playwright test` against the production build (`pnpm build && pnpm preview --port 4173`), installed Google Chrome (`channel: 'chrome'`), 4 workers, on the MacBook (hp-1 was not used; Chrome is installed here). Result of the final run: 35 passed, 1 failed (the console-error check on `/evidence`; see Shared defects). The `/farm` console-error check passed in the final run and failed in the first two runs, so it is timing-dependent for the same cause. Specs: `tests/e2e/ted-evidence.spec.ts`, `tests/e2e/ted-farm-map.spec.ts`, helpers in `tests/e2e/helpers/ted-*.ts`. Run only these with `pnpm e2e:ted`.

### Results

| Check | /evidence | /farm |
|---|---|---|
| 2a axe wcag2a/2aa/21aa, light | Pass | Pass |
| 2a axe wcag2a/2aa/21aa, dark | Pass | Pass |
| 2b No console or page errors on load | Failed before the favicon fix (404); see final-round run | Same |
| 2c No horizontal overflow, 320/375/768/1024/1440, light and dark (10 each) | Pass (10/10) | Pass (10/10) |
| 2d X01 skip link is first Tab stop; all contents links reachable by Tab; "Climate history" activates and scrolls to the section; focus ring outline not none | Pass | n/a |
| 2d X01 "Show data table" opens with Enter, `aria-expanded` true then false | Pass | n/a |
| 2d X01 map fields and buttons focusable with visible outline; typing coordinates by keyboard works | n/a | Pass |
| 2e E04 external links: https, 2+ word descriptive text, noopener on `_blank` | Pass | n/a |
| 2f E09/F09 tile requests aborted: notice shown, manual entry works, lat 95 shows error and `aria-invalid` | n/a | Pass |
| 2f Offline (`setOffline(true)` after load): 3+ charts render from the snapshot, data table opens | Pass | n/a |
| 2g F08 map click sets coordinates, Clear empties, sample fills -0.3031 / 36.08 | n/a | Pass |
| 2h X12 no "real-time" / "live data"; "forecast" only in negations | Pass | Pass |

Offline test caveat: after `setOffline(true)` the test navigates client-side to My Farm and back (no reload, since a reload would need the network from the preview server). It shows the snapshot charts need no network at runtime; it does not prove a cold offline start (no service worker exists).

### axe summary (serious/critical = 0 everywhere)

| Route | Theme | Violations | Passes | Incomplete (needs manual review) |
|---|---|---|---|---|
| /evidence | light | 0 | 29 | 1 |
| /evidence | dark | 0 | 29 | 1 |
| /farm | light | 0 | 27 | 1 |
| /farm | dark | 0 | 27 | 1 |

Full JSON is attached to each test in the Playwright results (`test-results/` locally; not committed). The one "incomplete" item per run was not inspected this round, so contrast on elements axe could not resolve (for example text over the map) is not confirmed.

### Shared defects found

1. **Missing favicon, 404 on every page: fixed.** Added `public/favicon.svg` (plain field-rows mark in #2056A3) and `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` in `index.html`. This was the one allowed shared edit in the final round.
2. **Axe "incomplete" item:** inspected, see "Axe incomplete review" below.

### Axe incomplete review (final round)

Rule `color-contrast`, the same single rule on all four runs. Axe could not resolve a background, so it asked for manual review.

| Route | Nodes | Axe reason | Measured (computed style vs opaque ancestor background) |
|---|---|---|---|
| /evidence (both themes) | 47 `tspan` axis ticks and axis titles, 4 short tick labels (`shortTextContent`) | "contains an image node" (SVG text) | Axis text #50617A on #FFFFFF = 6.3:1 light; #B3C2D8 on #152235 = 8.86:1 dark. Pass. No background image involved. |
| /farm (both themes) | `.leaflet-control-attribution` and its two links (`imgNode`) | Sits over map tiles | Before: links #0078A8 on Leaflet's #DDD fallback = 3.64:1, below AA (worst case; real background is 80% white over tiles). Fixed, see below. |
| /farm (both themes) | Field labels, help text, Clear button, Latitude and Longitude inputs (`bgOverlap`, `emptyValue`) | "overlapped by another element"; empty inputs | 14.8:1 light, 14.79:1 dark for labels and inputs; help text 6.3:1 / 8.86:1; button 7.19:1 / 8.07:1. `elementFromPoint` at each element's centre returned the element itself, so nothing covers them. These nodes no longer appear in the incomplete list after the attribution change. Inputs were measured at their text colour; empty-value contrast was not tested with a value typed. |

Additional finding from the same probe: the chart legend text in the temperature chart took the series colour (Recharts default): Minimum 3.29:1 light and 3.94:1 dark, below AA. Axe did not flag it.

Fixes (Ted's folders only):
- `src/features/evidence/ClimateCharts.tsx`: the legend text now uses `var(--color-text-2)` (6.3:1 light, 8.86:1 dark). The line swatches keep the series colours.
- `src/features/farm-map/farm-map.css`: the map attribution has an opaque `--color-surface` background, `--color-text` text and `--color-accent` links. Measured after: text 14.8:1 / 14.79:1, links 7.19:1 / 8.07:1 (light / dark).

Remaining: axe still lists `.leaflet-control-attribution` as incomplete on `/farm` (both themes, no reason message). The probe shows an opaque background and AA contrast, so I treat it as resolved by measurement, but axe itself does not confirm it. The `/evidence` SVG items stay "incomplete" because axe cannot evaluate SVG text; measured values above. I measured computed styles, not pixels in a screenshot crop.

### Screenshots (full page, `docs/qa/screenshots/ted/`, 20 files)

`evidence-{320,375,768,1024,1440}-{light,dark}.png` and `farm-{320,375,768,1024,1440}-{light,dark}.png`. I looked only at `farm-320-dark.png` (no clipping, controls readable); the others are unreviewed by eye, but passed the overflow assertion and axe.

### Gaps

- Map tile loading with the real OSM server was exercised online by the click test; it depends on network access when run.
- Contrast over map tiles (attribution measured by computed style only), 200% zoom and screen-reader announcements were not tested.
- `tests/e2e` files are type-checked by `tsc -b` through the node tsconfig, which lacks DOM types, so each test file starts with `/// <reference lib="dom" />`. A shared tsconfig fix would remove that.
