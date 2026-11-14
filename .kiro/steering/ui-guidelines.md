# FarmWise UI Guidelines — "Academic Blue + macOS restraint"

Every screen in FarmWise follows this document. It expands PRD §5 into rules a coding agent can apply
and a test can check. If a rule here and the PRD disagree, the PRD wins; report the conflict.

The feel: a calm, professional Mac app. Clear hierarchy, generous space, modest depth, one restrained
blue. Nothing decorative that does not help a farmer understand data. Do not copy Apple icons,
trademarks or System Settings layouts.

---

## 1. Tokens (single source of truth: `src/styles/tokens.css`)

Never hard-code a colour, radius, shadow, spacing or font size in a component. Use the variables.

### 1.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | #F7F9FC | #0C1423 | App background behind cards |
| `--color-surface` | #FFFFFF | #152235 | Cards, sidebar, dialogs, drawers |
| `--color-elevated` | #F1F5FB | #1C2D43 | Hover rows, selected nav item, table header, inset panels |
| `--color-text` | #172842 | #F2F6FF | Primary text, headings, numbers |
| `--color-text-2` | #50617A | #B3C2D8 | Secondary text, captions, axis labels, helper text |
| `--color-accent` | #2056A3 | #91B9FF | Primary buttons, links, focus ring, active nav, selected states |
| `--color-border` | #D6E0ED | #34455E | Card borders, separators, input borders |

Semantic status colours (add to tokens, keep this exact set; check AA on both surfaces):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-success` | #1E7A4C | #7BD3A4 | Pass / saved / feasible |
| `--color-warning` | #8A5A00 | #F2C46B | Caution / limitation / partial data |
| `--color-danger` | #B3261E | #FF9A92 | Error / infeasible / destructive |
| `--color-on-accent` | #FFFFFF | #0C1423 | Text on accent-filled buttons |

Each status colour also gets a soft background (`--color-*-soft`) at ~12% tint over surface, used for
badges and banners. Text on a soft background uses the full status colour, never white.

Rules:
- Blue is the only brand colour. Status colours mean status, never decoration.
- Never communicate meaning by colour alone: pair with an icon, label or pattern.
- Pale surfaces must be distinguishable to a person: card on background always has a 1px
  `--color-border`. Do not rely on near-identical whites.
- Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (≥ 18.66px bold / 24px regular). Input borders, focus rings
  and icon-only controls ≥ 3:1 against their background.

### 1.2 Theme

- Theme is set by `data-theme="light|dark"` on `<html>`. With no attribute, follow
  `prefers-color-scheme`. The user's toggle is stored in `localStorage` (wrapped in try/catch) and
  restored before first paint (inline script in `index.html`) to avoid a flash.
- Every component is reviewed in both themes. Shadows in dark mode are weaker; rely on borders and
  `--color-elevated` for depth instead.

### 1.3 Spacing

Scale: `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px, `--space-6` 32px.
No other gaps. Typical use:

| Context | Value |
|---|---|
| Icon ↔ label inside a control | 8 |
| Between form fields | 16 |
| Card padding | 24 desktop / 16 under 600px |
| Gap between cards in a grid | 16 (mobile) / 24 (desktop) |
| Section heading ↔ content | 12 |
| Between page sections | 32 |
| Page gutter | 16 (<600px), 24 (600–1024), 32 (>1024) |

### 1.4 Radius & elevation

- `--radius-card` 16px: cards, dialogs, drawers' inner edge, popovers, toasts.
- `--radius-control` 12px: buttons, inputs, selects, tabs container, badges use 999px (pill).
- `--shadow-1` (cards at rest): `0 1px 2px rgb(23 40 66 / 0.06)`.
- `--shadow-2` (popover, menu, toast): `0 8px 24px rgb(23 40 66 / 0.12)`.
- `--shadow-3` (dialog, drawer): `0 16px 48px rgb(23 40 66 / 0.18)`.
- Dark mode: same shadows at ~half opacity; borders carry the separation.

### 1.5 Typography

Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
Numbers in tables and metric cards use `font-variant-numeric: tabular-nums`.

| Role | Size / line-height | Weight |
|---|---|---|
| Page title (h1) | 28px / 1.25 (24px under 600px) | 650 |
| Section title (h2) | 20px / 1.3 | 600 |
| Card title (h3) | 16px / 1.4 | 600 |
| Body | 15px / 1.5 (16px on mobile inputs to stop iOS zoom) | 400 |
| Secondary / caption | 13px / 1.45 | 400, `--color-text-2` |
| Metric value | 28px / 1.2 | 600, tabular |
| Badge / overline | 12px / 1.3 | 600, letter-spacing 0.02em |

One h1 per page. Heading levels never skip. Sentence case everywhere ("Compare plans", not
"Compare Plans"). Max line length for prose: 70ch.

---

## 2. Layout

- App frame: left sidebar (240px) at ≥ 768px; below that, a compact top header (56px) with the logo,
  page title and a menu button that opens the nav as a Drawer.
- Content max-width 1200px, centred, with the page gutters above. Every route uses the same `Page`
  wrapper: h1, optional one-line description in `--color-text-2`, optional primary action aligned right
  (stacks below title under 600px).
- Grids: 12-column mental model. Cards use `repeat(auto-fit, minmax(280px, 1fr))` unless a layout
  needs fixed columns. No card may force horizontal page scroll at 320px.
- Tables that can be wide sit inside a horizontally scrollable container with a visible scroll hint;
  the page itself never scrolls sideways.
- Breakpoints to test: 320, 375, 768, 1024, 1440.

## 3. Navigation

- Destinations in order: Dashboard, My Farm, Rotation Planner, Scenario Studio, Plant Check,
  Data & Evidence. Plus Onboarding (entry from Dashboard / first run) and the global "Ask FarmWise"
  button (opens the Assistant Drawer).
- Active item: `--color-elevated` background, `--color-accent` text and a 3px accent bar on the
  leading edge, plus `aria-current="page"`. Active state always matches the URL.
- Logo/home opens Dashboard and keeps app state. Browser back/forward works.
- Each nav item is ≥ 44px tall, has an icon + text label. Icons alone are never the only label.

## 4. Components (all from `src/ui`; features never restyle or duplicate them)

General for every control: states default, hover, focus-visible, pressed, disabled, loading,
selected/checked where relevant. Minimum hit area 44×44px. Disabled controls stay readable (≥ 3:1)
and explain why via helper text or tooltip when the reason is not obvious.

**Button** — variants: `primary` (accent fill, `--color-on-accent` text), `secondary` (surface fill,
border, accent text), `ghost` (no border, accent text), `danger` (danger fill, used only for confirmed
destructive actions). Sizes `md` (44px) and `sm` (36px visual, 44px hit area). Loading state keeps the
width, shows a spinner and sets `aria-busy`. One primary button per view region.

**IconButton** — always has `aria-label`; tooltip shows the same text on hover/focus.

**Card** — surface, 1px border, radius 16, shadow-1, padding 24/16. Optional header (title +
provenance badge + action menu) and footer. A clickable card is a single `<a>`/`<button>` target with
a visible focus ring around the whole card; no nested competing click targets.

**Badge** — pill, 12px text. Provenance variants (one per `SourceKind`, text always visible):

| SourceKind | Label | Style |
|---|---|---|
| NASA_OBSERVED | NASA observed | accent soft bg, accent text, satellite icon |
| NASA_OFFLINE_SNAPSHOT | NASA snapshot · {date} | accent soft bg, accent text, archive icon |
| SIMULATED_IOT | Simulated sensor | warning soft bg, warning text, flask icon |
| FARMER_REPORTED | Farmer input | elevated bg, primary text, person icon |
| USER_SOIL_TEST | Your soil test | success soft bg, success text, beaker icon |
| DEMO_IMAGE | Demo example | elevated bg, text-2, image icon, dashed border |
| MODEL_ESTIMATE | Model estimate | elevated bg, text-2, sigma/compass icon, dashed border |

**TextField / Select** — visible label above (never placeholder-only), helper text below, error text
in danger colour with an icon and `aria-describedby`/`aria-invalid`. Units shown as a suffix inside
the field ("mm", "°C", "ha"). Validate on blur and on submit, not on every keystroke.

**Tabs** — segmented container, radius 12; selected tab uses surface + shadow-1. Arrow keys move
between tabs (roving tabindex). Switching with unsaved changes asks before discarding.

**Slider** — shows current value with unit and sign ("−10 %", "+1.5 °C"), min/max labels, keyboard
step and Page Up/Down large step, Home/End. Has a "Reset" ghost button nearby.

**Dialog** — portal, centred, max-width 560px (full-screen sheet under 600px), radius 16, shadow-3,
24px padding, title + close IconButton top-right, actions bottom-right (primary last). Focus trap,
Escape closes, backdrop click closes only when there are no unsaved changes, scroll lock, focus
returns to the trigger. Destructive confirmations name the thing being lost.

**Drawer** — same rules as Dialog; slides from the right (assistant) or left (mobile nav), width
min(420px, 100vw).

**Tooltip / Popover** — opens on hover and focus, closes on Escape, blur and pointer leave; never
holds the only copy of essential info. Popover for interactive content, tooltip for short text only.

**Toast** — bottom-centre on mobile, bottom-right on desktop; stack max 3; auto-dismiss 5s except
errors (manual dismiss); `role="status"` (or `alert` for errors); pauses on hover/focus.

**Skeleton / EmptyState / ErrorState** — every async or data-dependent region has all three.
EmptyState: icon, one-line reason, next action button. ErrorState: what failed, a Retry, and a
fallback (e.g. "Use offline snapshot"). Never a blank panel, never a raw stack trace.

**ChartFrame** — the only chart wrapper. Contains: title, provenance badge, units in axis titles,
legend, the chart, a caption with source + period, and a text summary (visually available via a
"Show data table" toggle and always available to screen readers). Charts are keyboard reachable.

## 5. Data display & honesty (visual rules)

- Every number shown has a nearby provenance Badge or caption. Derived results inherit the weakest
  source and show "Model estimate".
- Unknown values render as "Unknown" in `--color-text-2` with a short reason, never `0`, `—` alone,
  or a blank.
- Observed history uses solid lines/filled bars. Estimates, scenarios and projections use dashed
  lines / hatched or outlined bars and a "Model estimate" label. Never mix them unlabelled.
- Missing data points create gaps in lines, not drops to zero.
- Scores (0–100) and confidence (low/medium/high) are always shown as two separate elements.
- Never say "real-time", "forecast", "live" or "diagnosis" for NASA historical data, simulated sensors
  or demo images.
- Units: SI, written with a space ("12 mm", "24.1 °C", "1.2 ha"); dates as "12 Mar 2024"; ranges
  with an en dash ("2015–2024"). Round for display (1 decimal for °C, whole mm for rain), keep full
  precision in data.

## 6. Chart style

- Single palette: series 1 `--color-accent`, series 2 #6B8FC7 / dark #5F7FB3, series 3 #9A7B4F /
  dark #C9A877, comparison/baseline in `--color-text-2`. Max 4 series per chart.
- Gridlines: horizontal only, `--color-border` at 60% opacity. Axis text 12px `--color-text-2`.
- Tooltips use the Popover style (surface, border, shadow-2, radius 12) and show value + unit + date
  + provenance.
- Respect `prefers-reduced-motion`: disable chart animations.

## 7. Iconography

One icon set only (lucide-react, outline, 1.75px stroke, 20px in controls / 16px in badges).
Icons inherit `currentColor`. Decorative icons get `aria-hidden="true"`.

## 8. Motion

Durations 120ms (hover/press), 200ms (popover/toast), 240ms (dialog/drawer). Easing
`cubic-bezier(0.2, 0, 0, 1)`. Fade + small translate (≤ 8px) only; no bounce, no parallax. Under
`prefers-reduced-motion: reduce`, use opacity only or no animation.

## 9. Accessibility checklist (each component and page)

- [ ] All functionality works with keyboard only; logical tab order; no keyboard traps outside modals.
- [ ] `:focus-visible` ring: 2px `--color-accent` + 2px offset, visible on every surface.
- [ ] Landmarks: `header`, `nav`, `main`, one h1, skip-to-content link.
- [ ] Form fields labelled; errors announced; required marked in text, not just "*".
- [ ] Images/icons have alt or `aria-hidden`; charts have text summaries.
- [ ] Contrast AA in both themes; axe reports zero serious/critical issues.
- [ ] Touch targets ≥ 44×44px; nothing clipped at 320px; zoom to 200% still usable.

## 10. Copy voice

Plain, calm, specific, farmer-first. Short sentences. Say what we know, what we don't, and what to do
next. No hype, no exclamation marks, no jargon without a one-line explanation.
Good: "Rainfall here averaged 812 mm a year (2014–2023, NASA POWER). This is regional, not your field."
Bad: "AI-powered real-time soil intelligence!"

## 11. No AI-product clichés

FarmWise must look like a well-made agricultural tool, not a generic "AI app". Banned:

- Purple/violet/indigo-to-pink gradients, gradient text, neon glows, aurora/mesh/blob backgrounds.
- Sparkle ✨, magic-wand, robot, brain or "stars" icons for anything, including the assistant.
- Glassmorphism (frosted translucent cards), heavy blur, floating orbs, animated gradient borders.
- Emoji in UI copy, headings or buttons.
- Copy like "AI-powered", "smart", "magic", "unlock", "supercharge", "revolutionary", "insights at your
  fingertips", "Let AI do the work". Name what the feature does instead ("Compare rotation plans").
- Chat-bubble-first layouts. The assistant is a plain Drawer with a text field and cited answers,
  labelled "Ask FarmWise", not a mascot or avatar.
- Typewriter/streaming text effects, shimmer on non-loading content, fake "thinking…" dots.
- Hero sections with giant centred headline + gradient blob; three identical icon-feature cards.
- Overly rounded pill-everything, oversized drop shadows, everything centred.
- Confidence percentages invented for effect ("97% accurate").

Instead: left-aligned content, real data first, restrained blue, plain icons, precise labels, visible
sources. If a screen would look at home on any AI startup landing page, redo it.

## 12. Do / Don't

- Do reuse `src/ui`. Don't create a local `MyButton` or restyle a shared component in a feature.
- Do use tokens. Don't write hex codes or px gaps outside the scale in feature CSS.
- Do show provenance. Don't show a number without a source.
- Do handle loading/empty/error. Don't leave a blank card.
- Do label estimates. Don't style projections like observations.

## 13. Definition of done for any UI change

1. Uses only `src/ui` components and tokens.
2. Works at 320 / 375 / 768 / 1024 / 1440 in light and dark with no clipping or sideways scroll.
3. Keyboard and screen-reader checks above pass.
4. Loading, empty, error states present.
5. Provenance shown for every number.
6. `pnpm qa` passes.
