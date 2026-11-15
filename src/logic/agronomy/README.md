# src/logic/agronomy — deterministic rotation & scenario model (Moen)

Pure TypeScript, no I/O, no `Date.now` / `Math.random`: identical inputs always give identical outputs.
**This is a demonstration model. It is not agronomic advice, not a soil test, and not an income guarantee.**

| File | Purpose |
|---|---|
| `types.ts` | Public API types (extensions of the frozen `@fw/contracts`). |
| `crops.ts` | Crop rule manifest (`CROPS`), sources (`SOURCES`), `getCrop`, season names. |
| `model.ts` | Shared constants/helpers (rain shares, irrigation, ET, FAO-33 yield response). |
| `evaluate.ts` | `evaluateRotations(farm, climate, soil, options?)` → 3 plans + recommendation. |
| `scenario.ts` | `runScenario(plan, inputs, context)`, presets, limits, `matchPreset`, `clampScenarioInputs`. |
| `format.ts` | The ONE shared formatter set (used by both UI features), clipboard/JSON formatters, provenance helpers, source labels. |
| `index.ts` | Barrel. |

## 1. Crop manifest (Nakuru County, Kenya · lat −0.30, lon 36.07 · bimodal rains)

Seasons are exactly `"Long rains"` (≈Mar–Jul) and `"Short rains"` (≈Oct–Jan).

| id | Crop | Family | Seasons | Water need mm/season | Ky | Drought tol. (1–5) | Heat stress > °C | Pest group | pH | Yield t/ha (typ.) | Price KES/t | Cost KES/ha/season |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| maize | Maize | cereal | LR, SR | 500–800 | 1.25 | 2 | 28 | cereal_stemborer | 5.5–7.5 | 1.5–4.5 (2.5) | 30–50k | 45–75k |
| beans | Common beans | legume | LR, SR | 300–500 | 1.15 | 2 | 24 | grain_legume | 5.5–7.0 | 0.4–1.2 (0.7) | 80–130k | 30–55k |
| sorghum | Sorghum | cereal | LR, SR | 450–650 | 0.9 | 4 | 32 | cereal_stemborer | 5.5–8.0 | 0.8–2.5 (1.4) | 30–50k | 25–45k |
| finger_millet | Finger millet | cereal | LR only | 350–550* | 0.9* | 4 | 30 | small_millet | 5.0–7.5 | 0.6–1.8 (1.0) | 70–120k | 25–45k |
| irish_potato | Irish potato | root/tuber | LR, SR | 500–700 | 1.1 | 2 | 21 | solanaceae | 4.8–6.5 | 8–20 (12) | 15–35k | 120–200k |
| sweet_potato | Sweet potato | root/tuber | LR, SR | 400–650* | 1.0* | 4 | 30 | sweetpotato_weevil | 5.0–7.0 | 6–15 (9) | 15–30k | 40–70k |
| soybean | Soybean | legume | LR, SR | 450–700 | 0.85 | 3 | 28 | grain_legume | 6.0–7.0 | 0.8–2.0 (1.2) | 55–85k | 35–60k |
| cowpea | Cowpea | legume | LR, SR | 300–450* | 0.9* | 5 | 32 | grain_legume | 5.5–7.5 | 0.4–1.2 (0.7) | 70–110k | 25–45k |

Sources and honesty:
- **Published** — seasonal water need ranges for maize, beans, sorghum, potato, soybean: FAO Land & Water crop
  information (<https://www.fao.org/land-water/databases-and-software/crop-information/en/>), methodology FAO-56
  (<https://www.fao.org/3/x0490e/x0490e00.htm>). Seasonal Ky for those crops: FAO Irrigation & Drainage Paper 33
  (Doorenbos & Kassam 1979; no URL given because we could not verify a stable one) as reproduced in FAO-66
  (<https://www.fao.org/3/i2800e/i2800e.pdf>).
- **Assumption** (`*` above) — water need and Ky for finger millet, sweet potato and cowpea (not on the FAO crop
  information pages; set by analogy with similar crops).
- **Assumption** — every yield, price and cost value (rounded, deliberately wide, KES, not market quotes); pH
  ranges, heat thresholds, drought-tolerance ratings, pest groups, season lists, "familiar" flags. Finger millet is
  long-rains only because of its long growing cycle. No crop is restricted by default; `restricted` is supported
  (blocking) and exercised in tests through a custom manifest (`evaluateRotations(..., { crops })`).
- Crop id aliases (`bean`, `potato`, `millet`, `soy`, …) are canonicalised at the start of `evaluateRotations`: every
  plan (including `current`) carries canonical ids, and change counting / distinctness compare canonical ids, so
  `bean` → `beans` is never a "change". Anything else is an **unknown crop**.
- Pest-group ids are internal; farmer-facing text uses `PEST_GROUP_LABELS` / `pestGroupLabel(id)`.

## 2. Feasibility checks (run before ranking)

| id | Rule | Blocking when |
|---|---|---|
| `sequence` | ≥1 season, every season has a crop, no repeated season slot | empty rotation or empty crop (repeated slot = warning) |
| `crops-known` | every crop in the manifest | any unknown crop ("cannot be checked") |
| `season` | crop grown in that season | crop out of season. Unknown season names = warning + missing info (rain share 0.30 assumed) |
| `ph` (only if pH known) | pH inside crop range | pH > 0.5 units outside a crop's range (inside 0.5 = warning) |
| `water` (only if rainfall known) | rainfed + drought tolerance ≤ 2 + expected season rain < 60 % of mid need | that condition; supply < 80 % of need for a sensitive crop = warning |
| `budget` (only if budget and area known) | **budget = farmer's input budget per season for the whole farm** | low-bound cost × area of the costliest season > budget (high bound > budget = warning) |
| `restricted` | no restricted crop | any restricted crop |

Infeasible ⇒ `feasible:false`, `score:null` ("rejected before ranking"); components are still shown for explanation.
Unknown budget/area/pH/rainfall ⇒ the check is omitted (never shown as "passed") and listed in `missingInfo`.

## 3. Plan generation (rule-based, works for any rotation)

Season slots (season + yearOffset, order) are always copied from the farm. The rotation is treated as **cyclic**
(last season is followed by the first).

Issue vector, worst first: `[slots with a blocking problem, drought-sensitive slots with supply < 80 % need,
adjacent same-pest-group pairs, no legume]`.

- **current** — farm rotation as-is.
- **minimum** — tiers: (1) a single-season change that removes the worst issue without adding blockers;
  (2) else a two-season change that does; (3) else a single change that reduces it; (4) else the best single change.
  Within a tier: fewest issues (lexicographic) → fewest unfamiliar crops (familiar = flagged in manifest or already in
  the farm's rotation) → highest score → slot/crop manifest order. If the current rotation has no issue, the best-
  scoring single change is shown (always distinct from current).
- **resilience** — beam search (width 80) over in-season, unrestricted crops per slot. Objective: +12 × drought
  tolerance, +10 × heat margin, +20 × water reliability, +2 familiar, −1000 per slot blocker, −40 same pest group
  adjacent (incl. wrap-around), −10 same crop adjacent, +5 non-legume after legume, +30 first legume (+5 next two),
  +3 per distinct crop. The best candidate that is distinct from current and minimum (preferring feasible ones) wins.
- **Edge cases**: unknown-season slots keep the farmer's crop (no in-season alternatives exist). If no distinct
  alternative can be built (e.g. every slot has an unknown season) the plan copies the current seasons and is marked
  infeasible with a clear constraint. Empty rotation ⇒ three empty infeasible plans, `recommendedId:null`.

## 4. Scores (0–100, relative between the three plans)

Weights: water .30, soil .25, cost .20, climate .15, change .10. Each farmer priority (`water`/`cost`/`soil`) multiplies
its weight by 1.6, then all weights are renormalised (rounded to 3 dp). Score = Σ w·v / Σ w over components whose value
is not null, rounded to an integer.

- **water** (null without rainfall): mean over seasons of `100 × (1 − Ky × clamp(1 − supply / (1.3 × need), 0, 1))`;
  supply = season rain + irrigation + soil-moisture adjustment (see §6); 1.3 = rainfall-variability buffer.
- **soil**: start 70; −15 per adjacent same-pest-group pair (a 1-season rotation counts as monoculture); legumes
  +10 (+5 per extra, max +20) or −10 if none; if soil N known: each nitrogen-demanding season not following a legume
  −8 × clamp((30 − N)/10, 0, 1.5); if pH known: −15 per pH unit outside each crop's range. Clamped 0–100.
- **cost**: with budget and area: `100 × (1.5 − peak-season mid cost ÷ budget)`; otherwise
  `100 × (1 − mean mid cost per ha per season ÷ 200,000 KES)`. Clamped 0–100.
- **climate** (null without temperature): per season `50 × (tolerance − 1)/4 + 50 × clamp((heat threshold − mean T)/8, 0, 1)`.
- **change**: `100 − 25 × changed seasons`.

**Recommendation**: highest-score *feasible* plan; ties → fewer changed seasons → order current/minimum/resilience.
Never an infeasible plan; `null` if none is feasible. Keeping the current rotation is a legitimate outcome.

## 5. Confidence (separate from score)

- `low`: no climate (or no rainfall/temperature), no soil reading, any unknown crop or season, or empty rotation.
- `high`: climate + `USER_SOIL_TEST` soil + farm area + budget.
- `medium`: otherwise (e.g. `SIMULATED_IOT` soil is capped at medium).
`missingInfo` lists every unknown (climate, pH, N, moisture, lab soil test, area, budget, unknown crops/seasons).

Evidence per plan: climate evidence passed through from `ClimateContext`; soil (`soil-moisture`, `soil-ph`, `soil-n`,
`soil-p`, `soil-k`, source `SIMULATED_IOT` or `USER_SOIL_TEST`); farmer inputs (`farmer-rotation`, `farmer-irrigation`,
`farmer-budget`, `farmer-area`, `farmer-priorities`, `FARMER_REPORTED`); model outputs (`model-water-balance`,
`model-cost`, `model-score`, `MODEL_ESTIMATE`). Every `Reason` carries `evidenceIds` and/or `ruleIds`.
Model costs are KES rounded to the nearest 1,000; `costBasis:"per_ha"` when area is unknown or ≤ 0. The farmer's
budget is user-entered and is never rounded (evidence keeps the raw number with unit `KES`; text shows it as entered).
Pre-formatted evidence values (e.g. `model-cost` = "KES 200,000 – 360,000") carry no `unit`.
`RotationEvaluation.provenance` records the climate source/snapshot/period and soil source actually used.

## 6. Scenario formulae (`runScenario`)

Inputs are clamped/snapped to `SCENARIO_LIMITS` (rain −50…+30 % step 5; temperature −1…+4 °C step 0.5; irrigation
0…100 % of normal availability step 10; input cost −20…+60 % step 5). Baseline = `context.currentPlan`, selected =
`plan`, both under the **same** inputs. Per known-crop season:

- rain = annual rainfall × share × (1 + rain%/100); shares: Long rains **0.45**, Short rains **0.30**, unknown **0.30**
  (NASA snapshot climatology is ≈0.50 / ≈0.35; reduced ~10 % as a crude effective-rainfall allowance).
- irrigation = {rainfed 0, limited 75, regular 200} mm × irrigation%/100.
- soil-moisture adjustment = clamp((moisture % − 25) × 3, −60, +60) mm (the current reading is treated as indicative
  of planting conditions in every season — a simplification).
- need = mid FAO need × (1 + 0.04 × ΔT) (≈4 %/°C ET sensitivity, assumption).
- water met = min(1, supply/need); **waterIndex** = 100 × Σ(met × need)/Σ need.
- yield ratio = clamp(1 − Ky × (1 − met), 0, 1) [FAO-33] × clamp(1 − 0.10 × max(0, T + ΔT − heat threshold), 0, 1);
  **yieldIndex** = 100 × mean ratio.
- cost = mid cost/ha × area × (1 + cost%/100); revenue = typical yield × ratio × mid price × area; net = revenue − cost.
- Ranges: cost low/high cost; revenue low yield × low price … high yield × high price (ratio at high/low need);
  net = revenue low − cost high … revenue high − cost low; indices from high/low water need.
- Null handling: no rainfall ⇒ water/yield/revenue/net = null (cost still shown); no area ⇒ per ha; empty rotation ⇒
  all null; unknown crops are skipped. Every case adds a plain-language `uncertainty` note; nothing returns NaN/Infinity.
- Presets: Typical (0, 0, 100, 0), Drier (rain −30 %), Hotter (+2 °C), Higher costs (+25 %). Preset descriptions do
  not name a data source or period.
- Provenance: `result.provenance` = `{ climate: { source, label, snapshot, period, spatialScale } | null, soil }`, read
  from the `ClimateContext`'s own evidence, `snapshot` flag and `observedPeriod`. The climate uncertainty sentence and
  the copy-summary "Labels:" line are built from it; with no climate nothing claims NASA data.

## 6b. Shared formatters (`format.ts`, exported from `index.ts`)

| Function | Example |
|---|---|
| `formatKes(n)` | `KES 120,000`; negative `−KES 20,000` (U+2212); null/NaN `Unknown` |
| `formatKesRange(r)` | `KES 330,000 – 560,000` (currency once, en dash); any negative end: `−KES 260,000 to KES 1,332,000`, `−KES 500,000 to −KES 20,000`; equal ends `KES 5,000`; null `Unknown` |
| `formatSignedKes(n)` | `+KES 1,000` / `−KES 1,000` / `KES 0` |
| `formatNumber(n, maxFractionDigits = 0)` | `1,631`; `formatNumber(16.64, 1)` → `16.6`; negatives use U+2212 |
| `formatMm(n)` | `1,631 mm` |
| `formatRange(r, fmt = formatKes)` | compatibility: `KES 90,000 – KES 150,000` |
| `cropName(id)` | `Common beans`; unknown → `Teff (unknown crop)` |

All return `Unknown` for null/non-finite input and never print NaN/Infinity.

## 7. Known limitations

- Not agronomic advice, not a soil test, not an income guarantee. Prices/costs/yields are demonstration assumptions.
- One mean annual rainfall and mean temperature (historical NASA POWER snapshot, regional grid) — no intra-season
  timing, no forecast, no inter-annual risk beyond the 1.3 buffer.
- Soil moisture/N/pH from a simulated sensor are synthetic; a single reading is applied to every season.
- No labour, market access, seed availability, storage, intercropping or fallow modelling; pest groups are coarse.
- Budget is interpreted as input budget per season for the whole farm.
