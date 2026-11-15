# FarmWise final integration report

Date: 2026-11-15. Prepared during the final integration pass for NASA Space Apps Challenge 2026 ("Field Shift: Adapting Farms with NASA Data").

## Status at a glance

| Status | Item |
|---|---|
| COMPLETE | Integrated app: onboarding, My Farm, Dashboard, Rotation Planner, Scenario Studio, Plant Check, Data & Evidence, assistant, shared state |
| COMPLETE | Typecheck, lint, 280 unit/component tests, production build, 56 Playwright tests |
| COMPLETE | Pull request without conflicts; teammate history preserved |
| PARTIAL | Plant Check (labelled demo images and guided checklist only, no image classification) |
| PARTIAL | Soil sensors (simulated presets only) and assistant (rule-based, not an AI model) |
| PARTIAL | NASA data cover one region (Nakuru, 2014 to 2023 snapshot); farms far from it get no NASA values by design |
| NOT IMPLEMENTED | Live NASA calls at run time, real IoT hardware, image classification, backend, authentication |
| BLOCKED | Deployed URL: no Vercel or Netlify credentials in this environment |
| BLOCKED | Branch protection check: not available on this private repository plan (nothing to bypass) |

## Teammate contributions

| Contributor | Source | Integrated |
|---|---|---|
| Ted | `ted/evidence` (default branch) | NASA POWER snapshot and `getClimateContext`, Leaflet map picker, Data & Evidence page, his Playwright and axe suite (adapted to the shared store). |
| Moen | `moen/rotation-scenarios` | Agronomy model, Rotation Planner, Scenario Studio, their 141 unit and component tests. Standalone harness not carried over (his own hand-off says so). His Playwright specs target that harness and are not run. |
| Abdullah | `abdullah/plant-soil` | Plant Check, Soil & Sensors panel, simulated presets, demo illustrations. His blocked items are resolved: preset, soil test, observation and feedback now write to the shared store. |
| Shaheem | local project (no Git history) | Design tokens, shared UI library, shell, error boundary, router, Dashboard, tests. |
| Genemor | no branch or handoff existed | Completed here: onboarding, My Farm details and rotation editing, validated persistent store, assistant (answers, voice input, text fallback). |

## Features that work (verified by Playwright unless noted)

- Connected journey J01-J12: sample farm, NASA information, soil preset change, three plans, compare, select, scenario preset and slider, assumptions dialog, Plant Check demo case, assistant answers from state, Dashboard consistent with the selection (score equals the planner score), state survives reload.
- Farm edit propagates (J13). Manual onboarding with validation (O01-O05). Corrupted JSON (O06) and partially valid saved data (O07) recover safely.
- Data honesty: a farm in London gets no NASA values (N01); every route carries source labels and avoids "real-time" wording (N02); no emoji (N03).
- Layout and accessibility: 7 routes x 3 widths (375, 768, 1440) x light and dark: no horizontal overflow, no serious or critical axe violations. Ted's suite also checks 320 and 1024 px.
- Overlays and keyboard: dialog and drawer Escape and focus return, mobile menu, skip link, theme toggle persists.
- Voice input in onboarding and the assistant uses browser speech recognition where present and always has a typed fallback. Only the unsupported and fallback paths are covered by automated tests; actual speech recognition needs a manual check in Chrome.

## Simulated or limited

Soil sensors are simulated presets labelled "Simulated sensor". Plant Check results for demo images are labelled "Demo example"; uploaded photos are not classified. The assistant is deterministic. NASA data are a stored historical snapshot. All scenario results are labelled "Model estimate" with ranges.

## NASA data sources and verification status

NASA POWER monthly point data (AG community, API v2.10.0), variables T2M, T2M_MAX, T2M_MIN and PRECTOTCORR, grid point 0.303 S, 36.08 E, 2014 to 2023, retrieved 14 Nov 2026. The raw API response is stored unmodified with a manifest. Ted cross-checked monthly-to-annual rainfall against the API annual values (largest difference 0.18 %, asserted in a unit test). In this pass the Dashboard value (1,481 mm per year) was confirmed to equal the Evidence page value and the Rotation Planner input. The snapshot was not re-fetched live during this pass.

## Significant fixes made during integration

1. Two incompatible shared stores merged into one with `actions`; added plant feedback.
2. Season vocabulary mismatch ("Long Rains (Mar–Jun)" vs "Long rains") made model checks silently skip; now canonical, with migration of saved data.
3. Sample farm budget was in USD while the model uses KES, making every plan infeasible; corrected.
4. Dashboard and assistant used a placeholder rotation and climate layer; both now use the same evaluation as the Rotation Planner and Scenario Studio.
5. Plan scores no longer flash in an unscored state before climate loads.
6. Shell: added skip link and main landmark focus; route chunk prefetching so navigation keeps working if the connection drops; labelled cards render as landmark regions.
7. Map marker removed from the tab order (unnamed focusable control failed axe); chart accessibility layer disabled where the chart is intentionally hidden from assistive technology.
8. Compatibility layers: UI props, token aliases and five control adapters for Moen's pages; default button variant for those pages.
9. Lint: replaced references to a rule set that is not installed; fixed ref-during-render patterns.
10. Unhandled promise rejection in a test mock and several stale expectations updated to the integrated fixtures (no assertions were weakened).

## Automated test results (run on the final branch contents)

| Check | Result |
|---|---|
| `tsc -b` | pass, 0 errors |
| ESLint | pass, 0 errors, 11 warnings (react-refresh export rules) |
| Vitest | 280 passed, 20 files |
| `vite build` | pass (largest chunk: charts, 544 kB, 159 kB gzip) |
| Playwright | 56 passed (17 journey/layout/honesty, 39 Ted suite incl. smoke) |
| `pnpm audit` | 1 moderate, dev-only (minimatch through typescript-eslint). No runtime advisories. Not upgraded: fix needs a major tooling bump. |
| GitHub Actions | CI workflow added in this PR; result recorded below |

Not covered by automation: real microphone input, real camera capture, real tile loading (blocked-tile path is tested), a deployed URL, and a visual pixel-baseline suite (screenshots were reviewed by eye at 1440 and 375 px in both themes).

## Remaining problems

- No deployed URL yet.
- Scenario Studio opens comparing "current rotation vs itself" until a different plan is selected on the Rotation Planner; the demo script selects a plan first.
- Moen's visual and axe specs under `tests/moen/` are unused harness-era files.
- The repository is private; judges may need access or the repo made public.

## Repository, branch and merge

- Repository: https://github.com/Trajectra-Labs/farmwise-nasaspaceapps
- Branch: `integration/farmwise-final`
- Pull request: https://github.com/Trajectra-Labs/farmwise-nasaspaceapps/pull/1 (base `ted/evidence`, the repository's default branch)
- Merge status and final commit SHA: see the end of this file.

## Local run commands

```sh
pnpm install            # or npm install
pnpm dev                # http://localhost:5173
pnpm build && pnpm preview --port 4173
pnpm qa                 # typecheck, lint, tests, build, Playwright
```

## Deployment

Not deployed. `vercel.json` and `netlify.toml` rewrite every path to `index.html` (client-side routes), keep built assets as static files, and need no secrets. A route refresh (`/rotation`) was verified against the local production preview server only.

Remaining action for a team member with access (about 3 minutes):
1. Vercel: "Add New Project", import the repository, pick the branch, accept the detected Vite settings, deploy. Or Netlify: "Add new site", import, build `npm run build`, publish `dist`.
2. Open the URL, click Try Sample Farm, press refresh on `/rotation`, confirm it loads.
3. Paste the URL into `SUBMISSION_NOTES.md` and the submission form.

## Steps to record the demo

Follow `DEMO_SCRIPT.md` (30 seconds, six beats). Use a clean browser profile at 1440 x 900, light mode, and rehearse once.

## Submission checklist

- [ ] Deployed URL (blocked, steps above)
- [ ] Make the repository public or share it with the judges
- [ ] Record and upload the 30-second video from `DEMO_SCRIPT.md`
- [ ] Paste the overview from `SUBMISSION_NOTES.md` into the NASA form
- [ ] List the NASA data used (POWER monthly, 2014 to 2023) and the simulation disclosures
- [ ] Check voice input once manually in Chrome (optional feature)

## Merge record

- Last integration commit: `6f786aa7b52b799542c4e1e6ead116ade0133dc6` (CI passed: typecheck, lint, 280 unit tests, build, Playwright).
- Pull request #1 merged into `ted/evidence` (default branch) with a merge commit, `26d6bca6bb8ce3f58c84f518e1e1198e2b281e06`. All branch histories (Ted, Abdullah, Moen) are preserved. The source branches were not deleted.
