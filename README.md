# FarmWise

Browser-only farm planning app (Vite + React 18 + TypeScript strict). No backend, auth or external AI APIs.

FarmWise is the integrated NASA Space Apps 2026 build (branch `integration/farmwise-final`). It combines every contributor's work
on one shared design system and one store. See `SUBMISSION_NOTES.md`, `DEMO_SCRIPT.md` and
`FARMWISE_FINAL_INTEGRATION_REPORT.md`; integration decisions are in `docs/integration/INVENTORY.md`.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm qa         # typecheck + lint + unit tests + build + Playwright
pnpm e2e        # Playwright journey, accessibility and layout checks (needs Google Chrome)
```

## Folder ownership

| Owner | Folders |
|---|---|
| Shaheem | `src/app`, `src/ui`, `src/styles`, `src/contracts`, `src/features/dashboard`, `tests/e2e/journey.spec.ts` |
| Ted | `src/features/evidence`, `src/features/farm-map`, `src/data/nasa`, `docs/qa/ted-*` |
| Moen | `src/features/rotation`, `src/features/scenarios`, `src/logic/agronomy` |
| Abdullah | `src/features/plant`, `src/features/soil`, `src/data/simulated` |
| Genemor scope (completed during integration) | `src/features/onboarding`, `src/features/assistant`, `src/core`, My Farm details in `src/features/farm-map/FarmPage.tsx` |

## Honesty rules

NASA values must be real and traceable or not shown. Unused datasets are "not used", never zero. Unknown stays "Unknown".
