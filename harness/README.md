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

## Shared-UI behaviours Moen's features rely on (requested src/ui updates — PRD §4 "document the requested shared update")

The real `src/ui` (Shaheem) must provide these, or Moen's a11y results will differ after integration:

1. Dialog/Drawer: `role="dialog"`, `aria-modal`, labelled title, Close IconButton, focus trap, Escape, backdrop
   click dismiss, scroll lock, focus restored to the trigger on close.
2. Overlay header is a plain `div` (a `<header>` inside a dialog trips axe `landmark-no-duplicate-banner`).
3. Overlay scrollable body is keyboard-focusable (`tabIndex=0`, `role="region"`, labelled) — axe `scrollable-region-focusable`.
4. Tabs: roving tabindex with Arrow/Home/End handled on each `role="tab"` button; `TabPanel` linked by id.
5. Slider: native range input with visible label, `<output>` value and `aria-valuetext`.
6. `SourceBadge` with the seven PRD provenance labels; `ChartFrame` with title, source badges and text summary.
7. Tokens used directly by Moen CSS: `--fw-text`, `--fw-text-2`, `--fw-blue`, `--fw-border`, `--fw-border-strong`,
   `--fw-surface`, `--fw-elevated`, `--fw-chart-1..3`, `--fw-estimate(-bg)`, `--fw-warn(-bg)`, `--fw-danger(-bg)`,
   `--fw-success(-bg)`, spacing `--fw-s1..s6`, radii `--fw-radius-card/control`.
8. Dark-mode backdrop must visibly separate overlays from the page (harness: `--fw-backdrop` rgba(0,0,0,.72)).
