# Moen workstream — QA report & integration hand-off

**FarmWise PRD v3 · Owner: MOEN · Crop rotations · Scoring · Scenario Studio**
Branch: `moen/rotation-scenarios` · Report date: 2026-11-15 · Machine-readable twin: `docs/qa/moen-results.json`

This document is written for the **integrating agent** (Shaheem's final integration, PRD §11) who has not seen this
workstream before. Read §1–§3 to understand the feature, §4–§6 to integrate it, §7–§9 for evidence and open items.

---

## 1. What this workstream is (in one paragraph)

Moen delivers PRD screens **S3 Rotation Planner** (`/rotation`) and **S4 Scenario Studio** (`/scenarios`), plus the pure
deterministic model behind them (`src/logic/agronomy`). From the shared farm profile, the NASA climate context and the
soil reading (simulated preset or farmer soil test), the model builds **three complete seasonal rotations** —
*Current*, *Minimum change*, *Resilience-oriented* — checks feasibility, scores them 0–100 with an explainable weighted
breakdown and a **separate** confidence label, and recommends the best *feasible* plan (never an infeasible one).
Scenario Studio re-runs the model under what-if inputs (rainfall, temperature, irrigation, input cost) and compares
Current vs Selected on water, yield, cost, revenue and net return — always as ranged **model estimates**, never guarantees.

## 2. Files owned by Moen (integrate these; do not edit other owners' copies)

```
src/logic/agronomy/            pure model — no React, no I/O, no Date.now/Math.random
  types.ts                     public types (narrow extensions of the frozen contracts)
  crops.ts                     8-crop rule manifest (Nakuru, Kenya; "Long rains"/"Short rains") + sources + pest labels
  model.ts                     scenario/model constants (rain shares, irrigation mm, ET per °C, heat penalty …)
  evaluate.ts                  evaluateRotations(): plan generation, feasibility, scoring, confidence, evidence
  scenario.ts                  runScenario(), SCENARIO_PRESETS, SCENARIO_LIMITS, matchPreset, clampScenarioInputs
  format.ts                    shared formatters (KES, ranges, numbers, mm) + copy/JSON summaries
  index.ts                     barrel — the only import path for UI code
  README.md                    every formula, weight, rule, assumption, source and limitation  ← read this
  __tests__/                   90 unit tests
src/features/rotation/         Rotation Planner UI
  index.ts                     exports RotationPage, PlanSequence, copyText, downloadJson, sub-components
  moenStore.ts                 ★ THE single integration seam to store / NASA / soil (see §5)
  logicBridge.ts               the only rotation file importing src/logic/agronomy
  RotationPage, PlanCard, PlanSequence(+.css), PlanDetails, WhyDrawer, CompareDialog, exportUtils, format, rotation.css
  __tests__/                   29 component tests
src/features/scenarios/        Scenario Studio UI
  index.ts                     exports ScenarioPage
  ScenarioPage, ScenarioInputsPanel, ScenarioResults, ScenarioCharts, AssumptionsDrawer, formulas, format, share, scenarios.css
  __tests__/                   22 component tests
tests/moen/                    Playwright: rotation|scenarios .e2e / .a11y / .visual specs (+ darwin baselines)
docs/qa/moen-report.md, docs/qa/moen-results.json, docs/qa/screenshots/moen/ (44 PNGs)
```

**NOT Moen deliverables (delete or replace at integration):**
- `harness/` — stand-ins for other owners' modules, only so this branch runs in isolation (see §4).
- Root starter files created because no team starter existed when this branch began: `package.json`,
  `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`,
  `tests/setup.ts`, `.gitignore`. **Use the team starter's versions**; merge only the bits listed in §6.

## 3. Public API (ready-to-integrate exports)

| Export | From | Notes |
|---|---|---|
| `RotationPage` | `src/features/rotation` | Route `/rotation`. Ted's starter `src/app/routes.tsx` already imports it from `../features/rotation` ✔ |
| `ScenarioPage` | `src/features/scenarios` | Route `/scenarios`. Already imported by the starter routes ✔ |
| `evaluateRotations(farm, climate \| null, soil \| null, options?)` → `RotationEvaluation` | `src/logic/agronomy` | PRD signature. Always 3 plans in order current/minimum/resilience. `recommendedId` is feasible-only or `null`. |
| `runScenario(plan, inputs, context)` → `DetailedScenarioResult` | `src/logic/agronomy` | PRD signature. `context = { farm, climate, soil, currentPlan }`. Returns contract `ScenarioResult` + ranges + provenance. |
| `SCENARIO_PRESETS`, `SCENARIO_LIMITS`, `DEFAULT_SCENARIO_INPUTS`, `matchPreset`, `clampScenarioInputs` | `src/logic/agronomy` | Presets: typical, drier, hotter, costlier ("Higher costs"). |
| `formatKes`, `formatKesRange`, `formatSignedKes`, `formatNumber`, `formatMm` | `src/logic/agronomy` | Shared display formatters (U+2212 minus). Dashboard/assistant should reuse them for consistent numbers. |
| `formatRotationSummary`, `formatScenarioSummary`, `rotationEvaluationToJSON` | `src/logic/agronomy` | Plain-text/JSON summaries with provenance labels — usable by Genemor's assistant. |
| `PlanSequence`, `copyText`, `downloadJson` | `src/features/rotation` | Crop-by-season chips (self-styled) and clipboard/download helpers. |

**For the Dashboard (Shaheem, D04/D06/D07):** call `evaluateRotations(farm, climate, soil)` with the same inputs
(or reuse `useMoenData()` from `moenStore.ts`) — the "resilience score" card must show `plans[2].score` and
`recommendedId`, never a hard-coded number. "Why?" can link to `/rotation`, where the Why drawer lives.
**For the Assistant (Genemor):** `formatRotationSummary(evaluation, farm.name)` and plan `reasons[]` (each with
`evidenceIds`/`ruleIds`) are grounded, deterministic text to answer "why this plan / what should I change first".

## 4. How it runs in isolation today — the `@fw/*` alias layer

Moen's code never imports other owners' files by relative path. It imports through five aliases (set in
`vite.config.ts` and `tsconfig.json`), currently pointing at `harness/`:

| Alias | Harness stand-in | Real owner / target in the team repo |
|---|---|---|
| `@fw/contracts` | `harness/contracts/farmwise.ts` (verbatim PRD §4) | Shaheem · `src/contracts/farmwise.ts` |
| `@fw/ui` | `harness/ui/index.tsx` | Shaheem · `src/ui/index.ts` |
| `@fw/core` | `harness/core/index.tsx` | Genemor · `src/core/index.ts` |
| `@fw/nasa` | `harness/nasa/` (real NASA POWER snapshot) | Ted · `src/data/nasa/index.ts` |
| `@fw/simulated` | `harness/simulated/` | Abdullah · `src/data/simulated/index.ts` |

## 5. Integration procedure (step by step)

Merge order per PRD §11: Ted → Genemor → Abdullah → **Moen** → Shaheem final shell.

1. **Copy only Moen's folders** (§2) and `docs/qa/moen-*` + `docs/qa/screenshots/moen/` into the integrated repo.
   Do not copy `harness/` or the root starter files.
2. **Add the aliases** to the integrated `vite.config.ts` `resolve.alias` and `tsconfig.json` `paths` (simplest path —
   no Moen source edits):
   ```ts
   "@fw/contracts": "src/contracts/farmwise.ts",
   "@fw/ui":        "src/ui/index.ts",
   "@fw/core":      "src/core/index.ts",
   "@fw/nasa":      "src/data/nasa/index.ts",
   "@fw/simulated": "src/data/simulated/index.ts",
   ```
   (Alternative: search-replace `"@fw/x"` with relative paths in Moen's files — ~20 files, mechanical.)
3. **Adapt `src/features/rotation/moenStore.ts` to the real store** — the ONLY file that touches store/NASA/soil.
   It expects `useFarmWise()` → `{ state: FarmWiseState, actions }` and uses exactly:
   `state.farm`, `state.soilPreset`, `state.activePlanId`, `state.scenario`,
   `actions.setActivePlanId(id)`, `actions.setScenario(inputs)`.
   Map these to Genemor's final action names. ⚠ Ted's branch currently carries a **read-only placeholder** core
   (`useFarmWise()` returns `FarmWiseState`, no actions) — Genemor's real store must provide the two setters, or
   plan selection, "Use in scenarios" and scenario persistence (R06, S06, S09) cannot write state. Do **not** create
   a second store inside Moen's folders (PRD: one data flow).
4. **NASA climate (Ted)** — compatible: Ted exports `getClimateContext(farm: FarmProfile): ClimateContext`
   (synchronous; throws/returns no values for invalid or far coordinates). `moenStore.ts` already wraps the call in
   `Promise.resolve().then(...)`, so sync, async and throwing implementations all work, and errors show the
   Retry state. The climate refetch is keyed on `lat/lon` only and stale-location data is never scored.
   Ted's snapshot is also Nakuru (−0.303, 36.08, 2014–2023) — same region as Moen's crop manifest ✔.
5. **Simulated soil (Abdullah)** — `moenStore.ts` calls `getSimulatedReading(state.soilPreset)` expecting a contract
   `SoilInput` (`source: "SIMULATED_IOT"`). Ted's branch has only a TODO stub; Abdullah's module must export it.
   If the farm has `knownSoil` with `source: "USER_SOIL_TEST"`, Moen uses that instead (and confidence can rise to high).
6. **Shared UI (Shaheem)** — see §6; this is the biggest integration task.
7. **Routes** — already wired in the starter (`rotation`, `scenarios`). Moen's pages link to `/onboarding`
   (empty state) and between `/rotation` ↔ `/scenarios`; no other routes assumed.
8. **Run** `typecheck → lint → test → build → e2e/a11y/visual` and fix only integration glue (§8 for test notes).

## 6. Shared-UI compatibility (Moen ↔ `src/ui`)

Moen uses these components from `@fw/ui`. Ted's branch `src/ui` currently exports only `Button, Card, Badge,
ChartFrame, EmptyState` — Shaheem's final `src/ui` must provide the rest (all are in the PRD §5 component list).

| Component | Used by Moen | Props Moen passes | Status vs Ted-branch `src/ui` |
|---|---|---|---|
| `Button` | both pages | `variant` primary/secondary/ghost/danger, `size` "sm", `loading`, native button props | exists — check variant names |
| `Card` | both | `selected`, native section props | exists — check `selected` |
| `Badge` | both | `tone` neutral/info/success/warn/danger/estimate + children | ⚠ **API differs**: starter is `Badge({source}\|{label})` |
| `SourceBadge` | both (9 files) | `source: SourceKind` | ⚠ missing — equals starter `<Badge source=…/>`; a 1-line alias export solves it |
| `ChartFrame` | scenarios | `title`, `sources: SourceKind[]`, `summary`, `legend`, children | ⚠ **API differs**: starter has `source` (single) + `caption` |
| `EmptyState` | both | `title`, `body`, `action` | exists — check props |
| `ErrorState` | both | `title`, `body`, `onRetry` | missing |
| `Skeleton` | both | `height`, `width`, `label` | missing |
| `Dialog` | Compare all | `open`, `onClose`, `title`, `description`, `footer`, `size: "xl"` | missing |
| `Drawer` | Why plan, Assumptions | `open`, `onClose`, `title`, `description`, `footer` | missing |
| `Tabs` + `TabPanel` | scenario presets | `items`, `value`, `onChange`, `ariaLabel`, `idBase` | missing |
| `Slider` | 4 scenario sliders | `label`, `value`, `min`, `max`, `step`, `onChange`, `formatValue`, `description` | missing |
| `Select` | plan selector | `label`, `value`, `options`, `onChange`, `hideLabel` | missing |
| `ToastProvider`, `useToast().show({title, tone})` | copy/download/use-in-scenarios feedback | — | missing (`ToastProvider` must wrap the app) |

Recommended approach: Shaheem implements the missing components; where the final API differs, add thin
compatibility props/exports in `src/ui` (e.g. `SourceBadge`, `Badge tone`, `ChartFrame sources[]/legend`) **or**
adapt Moen's call sites — both are small. `harness/ui/index.tsx` is a working reference implementation of every
component above with the exact behaviour Moen's a11y tests expect:
1. Dialog/Drawer: `role="dialog"`, `aria-modal`, labelled title, Close button, focus trap, Escape, backdrop dismiss,
   scroll lock, **focus restored to the trigger on close**.
2. Overlay header is a `div` (a `<header>` inside a dialog fails axe `landmark-no-duplicate-banner`).
3. Overlay scrollable body is focusable (`tabIndex=0`, `role="region"`, labelled) — axe `scrollable-region-focusable`.
4. Tabs: roving tabindex; Arrow/Home/End handled on each `role="tab"`; `TabPanel` linked by id.
5. Slider: native `input[type=range]` with visible label, `<output>`, `aria-valuetext`.
6. Dark-mode overlay backdrop must visibly separate the overlay from the page.

**Design tokens used directly in Moen CSS** (must exist in `src/styles`, light + dark): `--fw-text`, `--fw-text-2`,
`--fw-blue`, `--fw-on-blue`, `--fw-bg`, `--fw-surface`, `--fw-elevated`, `--fw-border`, `--fw-border-strong`,
`--fw-chart-1..3`, `--fw-estimate(-bg)`, `--fw-warn(-bg)`, `--fw-danger(-bg)`, `--fw-success(-bg)`,
spacing `--fw-s1..s6` (4/8/12/16/24/32), radii `--fw-radius-card` (16px) / `--fw-radius-control` (12px).
If the final token names differ, a find-replace in `rotation.css`, `PlanSequence.css`, `scenarios.css` is enough.
Moen's TSX/CSS uses no `fw-*` component class names — only its own `rot-`/`scn-` prefixes.

**Dependency versions:** this branch was built on React 18.3, react-router-dom **6.28**, recharts **2.15**,
Vite 5, Vitest 2, ESLint 9, Playwright 1.56, npm. Ted's starter uses react-router-dom **7**, recharts **3**, Vite 8,
Vitest 5, ESLint 10, Playwright 1.65, **pnpm**. Moen uses only stable APIs (`Link`, `useNavigate`, `MemoryRouter`;
recharts `ResponsiveContainer/BarChart/Bar/XAxis/YAxis/Tooltip/CartesianGrid/Label/ReferenceLine`), which exist in both majors —
but re-run Moen's tests after adopting the team versions. Note recharts 3 changed some tooltip/legend typings; fix
in `ScenarioCharts.tsx` only if typecheck complains.

## 7. Behaviour reference (what the integrator should see)

**Rotation Planner (`/rotation`)**
- Header: farm name, provenance strip — climate (source badge, rain mm/yr, temperature, period), soil (Simulated
  sensor / Farmer soil test), farmer inputs (irrigation, budget as entered).
- Three plan cards in a keyboard radio group (Arrow/Home/End): crop chips per season and year ("changed" marked),
  feasibility, change size, water need (≈ mm over the rotation), soil effect, input-cost range (KES, whole farm),
  budget fit ("Within / May exceed budget per season", model estimate), evidence count, top risk, **score** (0–100,
  "Not scored — infeasible" when rejected) and **confidence** as separate fields, "Recommended" badge only on a feasible winner.
- Details panel for the selected plan: feasibility checks (pass/warning/blocking), benefits, risks, constraints,
  weighted score breakdown, missing information.
- Why this plan? drawer: reasons with linked evidence (value, period, spatial scale, source badge, link),
  rule sources (published vs team assumption), unknowns, score-vs-confidence explanation.
- Compare all dialog (table ≥640px, stacked per plan below). Keep my current rotation. Use in scenarios
  (disabled with explanation for infeasible plans) → `/scenarios`. Copy summary. Download JSON.
- States: climate loading skeleton; climate error with Retry (plans still shown, confidence lowered, unknowns shown
  as "Unknown"); no farm → empty state linking to `/onboarding`.

**Scenario Studio (`/scenarios`)**
- Plan selector (keeps the 4 inputs), selected plan's crop sequence, infeasible warning.
- Preset tabs Typical / Drier / Hotter / Higher costs; "Custom (modified from X)" when sliders diverge.
- Sliders: rainfall −50…+30 % (step 5), temperature −1…+4 °C (0.5), irrigation 0…100 % of normal (10; noted as no
  effect for rainfed farms), input cost −20…+60 % (5). Every change recalculates immediately.
- Observed inputs panel (NASA source/period, simulated soil, farmer irrigation) vs dashed "Scenario-adjusted inputs"
  (model estimate). Six metric tiles Current vs Selected with low–high ranges and change vs current.
- Two bar charts (current solid, selected hatched/dashed) with legend, units, text summary; data table with caption;
  always-visible uncertainty list; Assumptions drawer (formulas, constants, source links).
- Reset (to Typical; disabled with visible reason when already there), Copy summary, Download .txt, Back to Rotation Planner.
- Scenario inputs and active plan live in the **central store**, so they persist across navigation.

**Model essentials** (full detail: `src/logic/agronomy/README.md`)
- Plans are generated by rules for any farm rotation (not hard-coded to the sample farm); crop-id aliases
  ("bean", "potato", "soya") are canonicalised first. Sample farm (maize×3 + beans) yields
  Minimum = Maize→Beans→Maize→Beans, Resilience = Sorghum→Cowpea→Finger millet→Cowpea (recommended, 86/100).
- Blocking feasibility: empty slot/rotation, unknown crop, out-of-season crop, pH >0.5 outside crop range,
  rainfed drought-sensitive crop with rain <60 % of need, cheapest season cost > budget, restricted crop.
- Score weights water .30 / soil .25 / cost .20 / climate .15 / change .10; each farmer priority ×1.6 then renormalised.
- Confidence: high only with climate + farmer soil test + area + budget; simulated soil caps at medium; no climate → low.
- Scenario: seasonal rain = annual × share (Long rains .45, Short rains .30) × (1+Δ%); irrigation rainfed 0 /
  limited 75 / regular 200 mm per season × slider; crop water need +4 %/°C; yield via FAO-33 Ky linear response
  plus heat penalty; money rounded to KES 1,000; missing climate → nulls ("Unknown") with explanation.

## 8. QA results (final run, serial, 2026-11-15, Node 26, macOS, installed Chrome)

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 problems |
| `npx vitest run` | PASS — 141/141 in 8 files (logic 90, rotation 29, scenarios 22) |
| `npm run build` | PASS |
| `npx playwright test --project=e2e --project=a11y` | PASS — 30/30 (axe light/dark, 375 & desktop, dialogs/drawers open, keyboard paths) |
| `npx playwright test --project=visual` | PASS — 51/51 compared against darwin baselines; no horizontal overflow at 320/375/768/1024/1440 × light/dark |

Requirement coverage (all executed, none blocked): **R01–R12 PASS, S01–S14 PASS** — per-ID evidence in
`moen-results.json`. Note S02: pointer tested by track click, not drag.

**Test notes for integration**
- Component tests wrap pages in `FarmWiseProvider` (with `initialState`), `ToastProvider`, `MemoryRouter` — update
  `src/features/rotation/__tests__/helpers.tsx` and the wrapper in `src/features/scenarios/__tests__/ScenarioPage.test.tsx`
  if the real provider API differs.
- Playwright specs drive the harness "Harness controls" panel (labels "Soil preset (simulated)", "Irrigation",
  "Budget (KES)", "Theme", "No farm") and the localStorage key `farmwise:harness:v1`. After integration, replace
  those steps with the real My Farm / Soil & Sensors controls and Genemor's persistence key.
- Visual baselines (`tests/moen/*.visual.spec.ts-snapshots/`) are darwin-only and harness-shell-specific; regenerate
  with `--update-snapshots` in the integrated shell. `playwright.config.ts` skips comparisons on platforms with no
  baselines (console warning) instead of failing.
- `tests/setup.ts` includes an in-memory `localStorage` fallback needed on Node ≥ 25 (global `localStorage` shadows
  jsdom's) and a `ResizeObserver` stub for recharts — carry both into the team's test setup.
- Playwright uses `channel: "chrome"` by default because `playwright install chromium` hangs at extraction on
  Node 26 on the dev machine; set `PW_CHANNEL=bundled` where the bundled browser installs.

## 9. Review history (automated, no human gates)

Three implementer agents (logic / Rotation UI / Scenario UI) + one reviewer agent, orchestrated by Moen's assistant.
- Round 1: **2 P1** (crop-alias duplicate plans; NASA source claimed when no climate loaded) + 15 P2 → fixed.
- Round 2: 0 P0/P1; 7 P2 (range sign format, stale-location climate, label-in-name, PlanSequence CSS coupling,
  climate-aware wording, link semantics, platform baselines) → fixed.
- Round 3: 0 P0/P1; 2 P2 (visual baselines on other platforms; uncommitted baselines) → fixed.
Screenshots inspected by AI: both pages at 320/375/1440 (both themes, cropped where tall), compare dialog,
why/assumptions drawers, tooltip, error/empty/infeasible states. Others covered by automated overflow/clipping checks.

## 10. Data honesty

- Climate: only from the climate module; all wording (source, snapshot, period) is generated from what was actually
  loaded. With no climate the UI says so and shows "Unknown", never zeros or a NASA claim.
- Soil: "Simulated sensor" or "Farmer soil test" label always shown; never presented as a lab result.
- FAO-based water needs / Ky for maize, beans, sorghum, potato, soybean; everything else (prices, costs, yields,
  remaining crop parameters) labelled **team assumption**. Every money/yield/water output carries a "Model estimate"
  badge, low–high range and "not a guarantee" wording. No forecast claims.

## 11. Open items for the integrator / team

| # | Item | Owner | Action |
|---|---|---|---|
| 1 | Real store must expose `setActivePlanId` and `setScenario` (and soil preset / farm edits) | Genemor | Map in `moenStore.ts` |
| 2 | Missing shared components + Badge/ChartFrame API differences (§6) | Shaheem | Implement or add compat props |
| 3 | `getSimulatedReading(preset)` not yet in Ted-branch stub | Abdullah | Export per PRD |
| 4 | Season names must be exactly `"Long rains"` / `"Short rains"` in onboarding crop sequences (unknown names are flagged, plans degrade) | Genemor + Moen | Agree during integration |
| 5 | Region: Moen's crop manifest is for Nakuru; Ted's snapshot is Nakuru 2014–2023 ✔ (Moen harness used 2015–2024; no code change needed) | Team | Confirm |
| 6 | Budget meaning: Moen treats it as the per-season input budget for the whole farm | Team | Decide at integration; onboarding label must match |
| 7 | Playwright specs/baselines tied to harness shell | Shaheem | Re-point to real controls; regenerate baselines |
| 8 | Unverified: bundled Chromium on Node 26, non-darwin visual comparison, loading-state screenshot, agronomist validation | — | Listed in results JSON |
