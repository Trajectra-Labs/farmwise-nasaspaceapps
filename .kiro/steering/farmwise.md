# FarmWise — steering for coding agents

Full PRD (local only, not committed): `.kiro/prd-v3.txt`. Read sections 3–6 before editing.

## Stack (frozen)
Vite + React 18 + TypeScript (strict), React Router, CSS custom properties, Recharts (single chart library),
Vitest + React Testing Library, Playwright. Package manager: **pnpm** only (never npm/yarn/npx; use `pnpm exec` / `pnpm dlx`).
Browser-only app. No backend, auth, database, real IoT or external AI APIs.

## Ownership (do not edit other owners' folders)
- Shaheem: src/app, src/ui, src/styles, src/contracts, src/features/dashboard, tests/e2e, .github
- Ted: src/features/evidence, src/features/farm-map, src/data/nasa, docs/qa/ted-*
- Moen: src/features/rotation, src/features/scenarios, src/logic/agronomy
- Abdullah: src/features/plant, src/features/soil, src/data/simulated
- Genemor: src/features/onboarding, src/features/assistant, src/core

This branch (`ted/evidence`) is Ted's. Shared folders here are a provisional starter that Shaheem's
official starter will replace; keep them minimal and contract-faithful.

## Honesty rules
- NASA values must be real and traceable (URL, coords, period, units, retrieval time) or not shown.
- Never invent numbers labelled NASA; never present historical rain as a forecast.
- Unused datasets are shown as "not used", never as zero. Unknown stays "Unknown".
- Placeholders must say they are placeholders.

## Design tokens (Academic Blue)
Light / dark: bg #F7F9FC/#0C1423, card #FFFFFF/#152235, elevated #F1F5FB/#1C2D43,
text #172842/#F2F6FF, text-2 #50617A/#B3C2D8, accent #2056A3/#91B9FF, border #D6E0ED/#34455E.
Radius 16px cards / 12px controls. Spacing 4/8/12/16/24/32. System UI font, body 15–16px, h 24–30px.
44px min touch targets, always-visible focus ring, WCAG AA contrast.
