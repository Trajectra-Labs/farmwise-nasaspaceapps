# FarmWise — Moen workstream branch (`moen/rotation-scenarios`)

Rotation Planner (`/rotation`), Scenario Studio (`/scenarios`) and the deterministic agronomy model
(`src/logic/agronomy`) for the FarmWise PRD v3.

**Integrating this branch? Start with [`docs/qa/moen-report.md`](docs/qa/moen-report.md)** — it explains what the
workstream does, which files are Moen's, the public API, the `@fw/*` alias layer, the step-by-step integration
procedure, shared-UI compatibility, QA results and open items. Model details: `src/logic/agronomy/README.md`.

`harness/` and the root config files exist only so this branch runs standalone (no team starter existed when it
began); they are not to be merged — see `harness/README.md`.

```bash
npm ci
npm run dev          # http://localhost:5173/rotation and /scenarios (harness shell)
npm run qa           # typecheck, lint, unit, build, e2e, a11y, visual
```
