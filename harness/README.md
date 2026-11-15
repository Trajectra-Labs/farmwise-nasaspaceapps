# Harness — stand-ins for other owners' modules (NOT Moen deliverables)

The FarmWise starter baseline (Shaheem) did not exist when Moen's workstream ran, so per PRD §3
("each person can still deliver a standalone folder with these exports and tests") this folder
provides minimal stand-ins so `src/features/rotation`, `src/features/scenarios` and
`src/logic/agronomy` run and are tested in isolation.

| Alias | Harness file | Real owner / integration target |
|---|---|---|
| `@fw/contracts` | harness/contracts/farmwise.ts (verbatim PRD §4) | Shaheem · src/contracts/farmwise.ts |
| `@fw/ui` | harness/ui/index.tsx | Shaheem · src/ui |
| `@fw/core` | harness/core/index.tsx (`useFarmWise() → {state, actions}`) | Genemor · src/core |
| `@fw/nasa` | harness/nasa (REAL NASA POWER snapshot, Nakuru -0.30, 36.07, 2015–2024) | Ted · src/data/nasa `getClimateContext(farm)` |
| `@fw/simulated` | harness/simulated (SIMULATED_IOT presets) | Abdullah · `getSimulatedReading(preset)` |

Integration: delete `harness/`, re-point the aliases in vite.config.ts/tsconfig.json, and adapt
`src/features/rotation/moenStore.ts` if `useFarmWise()` differs. No other Moen file imports these modules.
