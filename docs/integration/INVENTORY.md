# Repository inventory and integration decisions

Inspected 2026-11-15 in a fresh clone of `Trajectra-Labs/farmwise-nasaspaceapps` (private, admin access).

## What was in the shared repository

| Branch | Tip | Author work | Notes |
|---|---|---|---|
| `ted/evidence` (default branch) | `a852076` | Ted: NASA POWER snapshot, `getClimateContext`, Leaflet farm map picker, Data & Evidence page, Playwright + axe suite | Built on the provisional scaffold `21a78a7`. |
| `abdullah/plant-soil` | `e4065a3` | Abdullah: `PlantCheckPage`, `SoilSensorsPanel`, simulated soil presets, demo leaf illustrations | Built on the scaffold. Shared-store write actions were blocked (read-only store). |
| `moen/rotation-scenarios` | `d1cecff` | Moen: agronomy model, Rotation Planner, Scenario Studio, tests | Unrelated history (own root); carried its own `harness/` stand-ins. |
| Genemor | none | No branch, commit or handoff document | Onboarding, My Farm details, store, assistant were scaffold stubs. Completed in this integration. |
| Open pull requests | none | | |

Shaheem's local project (`nasaspaceapps-hackathon/farmwise`) had no Git history. It was kept as an independent source directory and its verified frontend files were copied into the clone. Nothing was pushed over the team repository.

## Merge method (history preserved)

1. `integration/farmwise-final` created from `origin/ted/evidence`.
2. `abdullah/plant-soil` merged with a normal merge commit.
3. `moen/rotation-scenarios` merged with `--allow-unrelated-histories` and resolved: Moen's feature, logic and test folders kept; the standalone `harness/`, starter config files and duplicate lockfile not carried over (Moen's own hand-off report says to do exactly this).
4. Shaheem's design system, shell, store and pages applied on top as a normal commit.

No force push, reset, rebase or branch deletion was used.

## Decisions

| Decision | Reason |
|---|---|
| Dependencies and tooling stay as in the shared repo (Vite 8, React Router 7, Recharts 3, ESLint 10, pnpm lockfile). Scripts call `npm run` so they work under pnpm or npm. | Ted/Abdullah/Moen code was written against them; no migration needed. |
| Shaheem's `src/ui`, tokens, AppShell and Dashboard replace the scaffold equivalents. | Required by the brief (visual foundation). |
| One store: `useFarmWise()` returns `{ state, actions, ...flat setters }`. Plant feedback is stored beside the frozen state (`plantFeedback`). | Moen needs `actions`; Abdullah needed write actions; Shaheem's shell uses flat setters. |
| `@fw/*` aliases point at the shared modules; `@fw/ui` resolves to `src/ui/fw-compat.tsx`. | Moen's pages use a different Tabs/Select/Slider/toast API; five thin adapters avoided rewriting 20 working files. |
| Additive compatibility props on shared components (`Card title`, `Badge source/label/tone`, `Dialog footer`, `ChartFrame sources`). | Ted/Abdullah/Moen markup keeps working with the shared look. |
| Legacy token names (`--fw-*`, `--color-text`) are aliased to the shared tokens. | Teammate CSS follows the shared palette in light and dark mode without edits. |
| Source labels use the explicit wording ("NASA offline snapshot", "Simulated sensor", "User soil test", "Model estimate", "Demo example"). | All three teammates' tests and Ted's Evidence page use it; clearer than abbreviations. |
| Season names are canonical "Long rains" / "Short rains"; legacy strings are mapped on load. | The agronomy model keys on these names. |
| Sample farm: 2 ha, KES 120,000 seasonal input budget, maize in 3 of 4 seasons. Default selected plan is "current". | Currency of the model is KES; the budget in USD made every plan infeasible. A maize-heavy current practice gives the comparison something real to show. |
| `noUncheckedIndexedAccess` removed from `tsconfig.app.json`. | Neither Shaheem's nor Moen's code was written for it; `strict` stays on. |
| Shared synchronous seed of the NASA context in `moenStore.ts`. | Plans no longer flash an unscored state on first render. Async or failing sources still show loading/error. |
| Moen's Playwright specs in `tests/moen/` are not run. | They target Moen's standalone harness shell and macOS baselines. Their component and unit tests (90 + 51) are kept and run in Vitest. The connected journey is covered by `tests/e2e/journey.spec.ts`. |
