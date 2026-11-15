# FarmWise: NASA Space Apps Challenge 2026 submission notes

Challenge: **Field Shift: Adapting Farms with NASA Data** (crop rotation).
Team: Trajectra Labs FarmWise team (Shaheem, Ted, Moen, Abdullah). The onboarding, assistant and shared-state scope assigned to Genemor was completed during integration.

## Overview

FarmWise is a browser app that helps a smallholder farmer compare crop rotations under local climate history. The farmer sets up a farm (or opens a sample farm in Nakuru, Kenya), sees NASA POWER climate history for that place, gets three complete rotation plans (current practice, minimum change, resilience-oriented) with scores, confidence and reasons, then explores rainfall, temperature, irrigation and input-cost changes in Scenario Studio. Everything is explained in plain language and every number carries its source label.

## What is implemented (tested)

- Onboarding: sample farm, manual setup with validation, optional voice notes with a typed fallback.
- My Farm: edit and save farm details and crop rotation, simulated soil presets, user-entered soil tests, interactive map picker (OpenStreetMap tiles; manual coordinates always work).
- Shared state: one store, saved in the browser, validated on load. Corrupted or partial data falls back to safe defaults. Dashboard, Rotation Planner, Scenario Studio, Plant Check and the assistant read the same state.
- NASA data: a real NASA POWER monthly snapshot with units, period, retrieval date and grid-scale statement; a Data & Evidence page with findings linked to where FarmWise uses them; a source table. Other NASA products are listed as "not used".
- Rotation Planner: three plans, feasibility checks (season, soil pH, water, budget), weighted score with a separate confidence label, a "Why this plan?" evidence drawer, side-by-side comparison, export.
- Scenario Studio: rainfall, temperature, irrigation and input-cost sliders and presets. Results (water, yield, cost, revenue, net return) update from the model, with ranges, assumptions and uncertainty.
- Plant Check: image upload and preview, two credited demo illustrations, guided symptom checklist, farmer feedback. No automatic diagnosis of uploaded images.
- Assistant: deterministic, context-aware answers (plan choice, reasons, dry-season readiness, scenario, soil, last plant check, reliability) built from the farm's actual state.
- Accessibility and layout: light and dark mode, responsive down to 320 px, keyboard-operable overlays, skip link, axe checks with no serious or critical violations on every route at three widths in both themes.

## NASA data and how it affects recommendations

| Item | Value |
|---|---|
| Dataset | NASA POWER, monthly point data, community AG, API v2.10.0 |
| Variables | T2M, T2M_MAX, T2M_MIN (deg C), PRECTOTCORR (mm/day, converted to mm per month) |
| Location | Grid point 0.303 S, 36.08 E (Nakuru demo region), elevation about 2338 m |
| Period | 2014 to 2023, retrieved 14 Nov 2026 (offline snapshot stored in the repo next to the unmodified API response) |
| Scale | Regional grid cell (MERRA-2 meteorology), not a field measurement |
| Re-fetch | `node scripts/fetch-nasa-power.mjs` (see `docs/qa/ted-report.md`) |

Mean annual rainfall (1,481 mm over 10 complete years) and mean temperature (15.5 deg C) feed the model. Seasonal rain plus irrigation is compared with each crop's water need (FAO-style ranges); drought-sensitive crops on rainfed farms can fail the water check; mean temperature is compared with each crop's heat threshold. Scenario rainfall and temperature changes are applied on top of these historical values. If the farm is more than 300 km from the snapshot point, FarmWise shows "No NASA snapshot for this location" and does not score with another region's climate.

## Technologies

Vite, React 18, TypeScript (strict), React Router 7, Recharts 3, Leaflet and React Leaflet 4, Lucide icons, Vitest with Testing Library, Playwright with axe-core. No backend, database or authentication.

## Simulated features and limitations

- **All soil sensor readings are simulated presets** (dry, normal, wet). No hardware is connected. A soil test the farmer types in is labelled separately and replaces the preset in the model.
- Plant Check does **not** classify arbitrary photos. Demo illustrations are labelled as illustrations, not field photographs. Results list visible signs and possible concerns to check locally, not diagnoses or treatment advice.
- The assistant is rule-based, not an AI model. It cannot diagnose, forecast weather or give financial advice, and says so.
- NASA data are historical and regional. FarmWise makes no forecast and has no live NASA connection at run time.
- The crop manifest covers eight crops for Nakuru's two rainy seasons. Water-need ranges for maize, beans, sorghum, potato and soybean follow FAO sources; finger millet, sweet potato and cowpea values, and all yield, price and cost figures, are team assumptions (`src/logic/agronomy/README.md`).
- Map tiles need internet; without it, typing latitude and longitude still works.

## Agricultural assumptions and uncertainty

Scores are relative comparisons between the three plans for one farm, not agronomic ratings. Costs and revenue are wide, rounded KES ranges. Confidence shows how complete the inputs are, not the chance of success. Weather timing, pests, management and markets can change real outcomes. Farmers should check with a local extension officer before changing what they plant.

## AI tools used

Claude (Anthropic) through Claude Code was used for code generation, integration, testing and documentation. Teammates also used AI coding assistants for their own workstreams. The team reviewed and tested the output. No AI model runs inside the app.

## Repository and demo

- Repository: https://github.com/Trajectra-Labs/farmwise-nasaspaceapps (currently private; make it public or add the judges before submitting if required)
- Deployed demo URL: **not deployed yet**. No Vercel or Netlify credentials were available in the build environment. Steps are in `FARMWISE_FINAL_INTEGRATION_REPORT.md`.

## Run locally

```sh
pnpm install          # or: npm install
pnpm dev              # http://localhost:5173
pnpm build && pnpm preview
pnpm qa               # typecheck, lint, unit tests, build, Playwright
```

Requires Node 20.19 or newer. Playwright uses Google Chrome.
