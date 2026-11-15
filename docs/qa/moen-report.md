# QA report — Moen · Crop rotations · Scoring · Scenario Studio

FarmWise PRD v3 · owner workstream MOEN · report date 2026-11-15 · machine-readable twin: `docs/qa/moen-results.json`

## Scope and ownership

| Folder | Content |
|---|---|
| `src/logic/agronomy/` | Pure deterministic model: crop rule manifest, `evaluateRotations`, `runScenario`, presets/limits, shared formatters, README with every assumption |
| `src/features/rotation/` | `RotationPage` (Rotation Planner), `PlanSequence`, `copyText`, store adapter `moenStore.ts` |
| `src/features/scenarios/` | `ScenarioPage` (Scenario Studio) |
| `tests/moen/` | Playwright e2e / a11y / visual specs + darwin visual baselines |
| `docs/qa/moen-*`, `docs/qa/screenshots/moen/` | This report, results JSON, 44 screenshots |

**Standalone delivery.** No starter baseline existed, so per PRD §3 the workstream ships as a standalone folder.
`harness/` holds clearly marked stand-ins for other owners' modules (contracts verbatim from PRD §4, shared UI,
central store, a real NASA POWER snapshot, simulated soil presets). It is NOT a Moen deliverable — see
`harness/README.md` for the alias re-pointing and the list of shared-UI behaviours Moen relies on.
`tests/setup.ts`, `playwright.config.ts`, `vite.config.ts`, `package.json` are starter-level files that Shaheem's real starter replaces.

## Ready-to-integrate exports

- `src/features/rotation`: `RotationPage`, `PlanSequence`, `copyText`, `downloadJson` (+ sub-components)
- `src/features/scenarios`: `ScenarioPage`
- `src/logic/agronomy`: `evaluateRotations(farm, climate, soil)`, `runScenario(plan, inputs, context)`, `SCENARIO_PRESETS`,
  `SCENARIO_LIMITS`, `DEFAULT_SCENARIO_INPUTS`, `matchPreset`, `clampScenarioInputs`, `formatRotationSummary`,
  `formatScenarioSummary`, `rotationEvaluationToJSON`, `formatKes`, `formatKesRange`, `formatSignedKes`, `formatNumber`, `formatMm`, `CROPS`, all types.

## Commands and results (final run, serial, 2026-11-15, Node 26.x, macOS)

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 problems |
| `npx vitest run` | PASS — 141/141 tests in 8 files (logic 90, rotation 29, scenarios 22) |
| `npm run build` | PASS |
| `npx playwright test --project=e2e --project=a11y` | PASS — 30/30 |
| `npx playwright test --project=visual --update-snapshots` | PASS — 51/51 (baselines regenerated after intentional round-2 UI text changes) |
| `npx playwright test --project=visual` | PASS — 51/51 compared against baselines |

`npm run qa` chains all of the above. Browser: installed Google Chrome (`channel: "chrome"`) — see limitations.

## Requirement status

| ID | Status | Evidence |
|---|---|---|
| R01 three plans, crop-by-season | PASS | `rotation.test.ts`, `RotationPage.test.tsx`, e2e |
| R02 selection highlights + details | PASS | RTL + e2e |
| R03 Compare All modal, mobile readable | PASS | RTL, e2e, `rotation-compare-*-{375,1440}.png`, axe with dialog open |
| R04 Why plan: reasons, risk, unknowns | PASS | RTL, `rotation-why-*.png` |
| R05 infeasible never recommended | PASS | logic tests + guard test (model mocked to recommend infeasible), all-infeasible screenshot |
| R06 Use in Scenario preserves id | PASS | RTL + e2e lands on /scenarios with plan |
| R07 keep current selectable | PASS | RTL + e2e |
| R08 farm edits recalculate | PASS | soil/irrigation/budget/priorities in logic + UI tests |
| R09 score vs confidence separate | PASS | logic independence tests, UI labels |
| R10 KES explicit, no false precision | PASS | whole-thousand assertions, shared formatters |
| R11 no duplicate/empty/out-of-season | PASS | logic tests incl. alias crops (bean/potato) |
| R12 shared UI | PASS | role/aria assertions on shared Dialog/Drawer/Card; no locally styled near-duplicates |
| S01 four presets | PASS | RTL + e2e |
| S02–S05 sliders (keyboard + pointer) | PASS | RTL + e2e (pointer = track click, not drag) |
| S06 plan selector preserves inputs | PASS | RTL + e2e |
| S07 chart units, legend, summary | PASS | RTL, `scenarios-tooltip-*-1024.png` |
| S08 assumptions drawer | PASS | RTL, `scenarios-drawer-*.png` |
| S09 reset deterministic | PASS | RTL + e2e |
| S10 copy summary | PASS | RTL (mocked clipboard) + e2e (granted clipboard) |
| S11 no NaN/Infinity at extremes | PASS | logic grid over all limit combinations + UI extremes |
| S12 uncertainty + source labels visible | PASS | RTL; climate-aware wording (no NASA claim without data) |
| S13 repeatable outputs | PASS | logic + RTL determinism |
| S14 mobile chart/table both themes | PASS | visual 320/375 light+dark, no horizontal overflow assertion |

## Controls inventory (all wired and tested)

Rotation Planner: plan radio group (Arrow/Home/End), per-plan "Why this plan?" drawer, Compare all dialog, Keep my current rotation,
Use in scenarios (disabled with explanation for infeasible plans), Copy summary (clipboard + execCommand fallback), Download JSON,
climate Retry, empty-state "Set up a farm" link.
Scenario Studio: plan Select, 4 preset tabs, 4 sliders, Reset (visible disabled reason), Assumptions drawer, Copy summary,
Download .txt, Back to Rotation Planner link, climate Retry, empty-state link, chart tooltips.

## Review process

Three implementer agents (logic, Rotation UI, Scenario UI) + one reviewer agent, orchestrated by Moen's assistant.
- Round 1: 2 P1 (crop-alias duplicates; NASA source claimed without data) + 15 P2 → all routed back and fixed.
- Round 2: 0 P0/P1; 7 P2 (range minus format, stale-location climate, label-in-name, PlanSequence CSS coupling,
  climate-aware explainer, link semantics, darwin-only baselines) → fixed.
- Round 3: 0 P0/P1; all round-2 fixes verified; 2 P2 on visual baselines (comparison on platforms without baselines; uncommitted baselines) → fixed by orchestrator.

## Screenshot / AI visual inspection

44 screenshots in `docs/qa/screenshots/moen/` (both pages at 320/375/768/1024/1440 × light/dark, compare dialog,
why drawer, assumptions drawer, tooltip, error, empty, infeasible). Visual baselines: `tests/moen/*.visual.spec.ts-snapshots/`.
Images inspected by AI (implementers, reviewer, orchestrator): rotation 1440 light/dark, 320/375 dark (cropped), compare dialog
375/1440 both themes, why drawer 375, climate-error 375/1440, infeasible 375, scenarios 1440 light/dark, 320/375 (cropped),
drawers, tooltip 1024 both themes, empty and error states. Remaining images were covered by automated overflow/clipping assertions only.

## Data honesty

- Climate comes only from the climate module (harness: real NASA POWER monthly snapshot, Nakuru −0.30/36.07, 2015–2024,
  request URL + retrieval time preserved). Wording is generated from the actual source/snapshot/period; with no climate the UI
  says so and shows "Unknown", never zeros.
- Soil: labelled "Simulated sensor" (or "Farmer soil test" when user-entered); simulated soil caps confidence at medium.
- Crop water needs/Ky for maize, beans, sorghum, potato, soybean follow FAO guidance; all prices, costs, yields and the
  remaining crop parameters are labelled team assumptions. Every money/yield/water output is a "Model estimate" with ranges
  and "not a guarantee" wording.

## Known limitations / unverified

1. **Bundled Chromium not verified.** `playwright install chromium` hangs at extraction under Node 26 (both Playwright 1.49 and
   1.56); tests run on installed Google Chrome. Set `PW_CHANNEL=bundled` where the bundled browser installs.
2. Visual baselines are darwin-only. On other platforms (e.g. Linux CI) screenshot comparisons are skipped with a console warning
   (`ignoreSnapshots` when no `-<platform>.png` baseline exists); overflow/clipping assertions still run. Commit CI baselines to enable comparison.
3. Harness stand-ins: integration must re-point `@fw/*` aliases and may need to adapt `moenStore.ts` to the real `useFarmWise()`.
   Axe results depend on the shared overlay behaviours listed in `harness/README.md`.
4. Demo region (Nakuru, Kenya) and season names ("Long rains"/"Short rains") were chosen by this workstream; they must match
   Ted's region and Genemor's onboarding season values.
5. Budget is interpreted as the per-season input budget for the whole farm (documented); onboarding should label it that way.
6. Loading-state screenshot not captured (harness climate resolves synchronously); covered by RTL only.
7. Slider pointer interaction tested by track click, not drag. FAO-33 cited without URL (not verified).
8. Agronomic correctness is not validated by an agronomist; outputs are relative, explainable estimates for demonstration.
