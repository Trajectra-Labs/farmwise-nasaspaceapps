# FarmWise

Browser-only farm planning app (Vite + React 18 + TypeScript strict). No backend, auth or external AI APIs.

> Shared folders (`src/app`, `src/ui`, `src/styles`, `src/contracts`, `src/core`) are a **provisional starter**
> on branch `ted/evidence`. Shaheem's official starter will replace them. Feature modules are labelled placeholders.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm qa         # typecheck + lint + unit tests + build
pnpm e2e        # Playwright (run `pnpm exec playwright install` once first)
```

## Folder ownership

| Owner | Folders |
|---|---|
| Shaheem | `src/app`, `src/ui`, `src/styles`, `src/contracts`, `src/features/dashboard`, `tests/e2e`, `.github` |
| Ted | `src/features/evidence`, `src/features/farm-map`, `src/data/nasa`, `docs/qa/ted-*` |
| Moen | `src/features/rotation`, `src/features/scenarios`, `src/logic/agronomy` |
| Abdullah | `src/features/plant`, `src/features/soil`, `src/data/simulated` |
| Genemor | `src/features/onboarding`, `src/features/assistant`, `src/core` |

## Honesty rules

NASA values must be real and traceable or not shown. Unused datasets are "not used", never zero. Unknown stays "Unknown".
