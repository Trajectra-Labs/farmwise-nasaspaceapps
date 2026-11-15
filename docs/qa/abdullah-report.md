# Abdullah Workstream QA — Plant Check and Soil & Sensors

## Status

Implemented on `abdullah/plant-soil`, based on provisional scaffold commit
`21a78a7887770b4321e38ae1965f60361d5e22d3`. No Shaheem-authored starter commit
was available in the local refs; `git fetch --all` previously failed because
GitHub authentication was unavailable. The user authorized proceeding from the
provisional scaffold.

P01–P12 and F05–F07 are accounted for below. **P07 is blocked at app
integration**: the screen records and edits feedback and emits a typed callback,
but the current shared `FarmWiseProvider` has no write action or feedback field.
Likewise, Soil & Sensors exposes typed callbacks for preset and soil-test
changes, but downstream propagation cannot be verified against this
read-only scaffold store.

## Implemented

- `PlantCheckPage` supports JPG/PNG/WebP upload, 8 MB size validation, preview,
  replace/remove, image decode errors, camera capture, and explicit camera
  unsupported/denied fallbacks.
- Two distinct, locally bundled and credited demo illustrations show different
  visible observations. They are clearly labeled as FarmWise illustrations,
  not field photographs, and both outcomes are `DEMO_IMAGE`.
- Unknown uploads show no automated classification. Farmers can select visible
  signs in a guided checklist; possible concerns, visible observations,
  uncertainty, and observational next steps are presented separately.
- Farmer feedback can be selected, changed, and annotated; typed integration
  callbacks are provided. Until wired to shared state, the page discloses that
  feedback is only held for that page session.
- `SoilSensorsPanel` provides dry/normal/wet simulated readings with
  `SIMULATED_IOT`, timestamp, units, illustrative ranges, and no-hardware
  disclosure. User-entered soil-test values have separate `USER_SOIL_TEST`
  provenance and range validation. Missing results display `Unknown`.
- Components consume shared contracts, UI primitives, and the current shared
  state; no shared or other-owner files were changed.

## Acceptance results

| ID | Status | Evidence / note |
|---|---|---|
| P01 | PASS | Valid upload preview and file details tested. |
| P02 | PASS | Replacing/removing a photo clears the old interpretation. |
| P03 | PASS | Successful camera capture, denial, and unsupported-camera fallbacks tested. |
| P04 | PASS | Two credited demo illustrations return distinct outcomes. |
| P05 | PASS | Arbitrary upload uses guided observations only; no automatic diagnosis. |
| P06 | PASS | Visible signs, possible concerns, and uncertainty are separate. |
| P07 | BLOCKED | Callback behavior tested, but shared-state persistence is not possible with the current read-only store. |
| P08 | PASS | Next steps are observational; no treatment or pesticide advice. |
| P09 | PASS | Invalid type, oversized file, and undecodable image errors tested. |
| P10 | PASS | Checklist changes saved farmer-reported observations. |
| P11 | PASS | Uploaded preview remains page-local and is not included in shared observation data. |
| P12 | PASS | Keyboard-operable controls and accessible feedback states tested; no custom modal/popover is used. |
| F05 | PASS | Preset changes update the displayed readings and retain the simulated label. Downstream propagation remains blocked pending store actions. |
| F06 | PASS | Soil-test ranges are visible and invalid/out-of-range entries are rejected. |
| F07 | PASS | Missing soil-test values display `Unknown`, not zero. |

## Validation evidence

| Command / check | Result |
|---|---|
| `npx --yes --package=node@24 node node_modules/vitest/vitest.mjs run --pool=threads` | PASS — 5 files, 30 tests. Node 24 was needed because the lockfile resolves Undici 8, which uses a Zstandard API unavailable in the installed Node 22.14 runtime. |
| `.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json` | PASS |
| `.\node_modules\.bin\eslint.cmd .` | PASS — 0 errors; 4 existing Fast Refresh warnings in shared files (`AppShell.tsx`, `FarmWiseContext.tsx`, `Badge.tsx`). |
| `.\node_modules\.bin\vite.cmd build` | PASS |
| `git diff --check` | PASS |
| Browser check: `/plant` and `/farm` at 320 CSS px | PASS — document width matched viewport; no horizontal overflow. Wet preset displayed 76% moisture. |
| Browser visual review | Reviewed Plant Check sample states in dark desktop and light mobile presentation. The browser screenshots were inspected but not saved as files. |

The full `pnpm qa` script was not invoked: this environment has no global pnpm
binary, and the starter script shells out to `pnpm`; its underlying type-check,
lint, test, and build checks were run directly. No e2e, axe, or visual
regression suite was available in the provisional starter.

## Requested shared-store integration

Please add typed shared actions for updating `soilPreset`, `farm.knownSoil`,
`lastPlantObservation`, and farmer feedback. The shared state contract also
needs a feedback field for the feature-local `FarmerPlantFeedback` shape (or an
equivalent shared type). `SoilSensorsPanel` accepts `preset`, `soilTest`,
`onPresetChange`, and `onSoilTestChange`; `PlantCheckPage` accepts
`initialObservation`, `onObservationChange`, and `onFeedbackChange` for that
integration. No contract or core-store files were changed in this workstream.

## Fixture and provenance note

Sensor values are deterministic illustrative presets only; no physical sensor
or external IoT source is connected. Demo plant assets are original FarmWise
SVG illustrations and are not field photographs. Uploaded images remain local
to the Plant Check page and are not uploaded or saved in shared farm data.
