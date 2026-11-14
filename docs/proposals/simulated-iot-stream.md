# Proposal: simulated sensor stream + sensor-feed adapter

**Owner:** Abdullah (`src/features/soil`, `src/data/simulated`). **Proposed by:** Ted.
**Status:** proposal; Abdullah decides. Needs no contract change.

## Why

FarmWise's soil panel uses static dry / normal / wet presets. A stream of readings that changes every few
seconds makes the "Soil & Sensors" tab feel like a farm with sensors in the ground, which is a stronger demo.
Behind it sits a small adapter, so a real LoRa / MQTT gateway can be added after the hackathon without
rewriting the UI.

It stays within the PRD: readings remain `SIMULATED_IOT`, there is no network or hardware, and
nothing claims to be real-time.

## What to build

### 1. Adapter interface: `src/data/simulated/feed.ts`

```ts
import type { SourceKind } from '../../contracts/farmwise'

export type SensorMetric = 'soilMoisturePct' | 'soilTempC' | 'airTempC' | 'airHumidityPct'

export type SensorReading = {
  sensorId: string           // e.g. "sim-node-1"
  metric: SensorMetric
  value: number | null       // null = no reading, never 0
  unit: '%' | '°C'
  timestamp: string          // ISO
  source: SourceKind         // "SIMULATED_IOT" for the simulator
}

export type FeedStatus = 'connecting' | 'streaming' | 'paused' | 'stale' | 'error'

export interface SensorFeed {
  id: string
  label: string              // "Simulated sensor stream"
  source: SourceKind
  intervalMs: number
  subscribe(
    onReadings: (batch: SensorReading[]) => void,
    onStatus: (status: FeedStatus, detail?: string) => void,
  ): () => void              // unsubscribe; must clear all timers/listeners
  pause(): void
  resume(): void
}
```

### 2. Simulator: `createSimulatedFeed({ preset, intervalMs = 3000, seed = 42, now })`

- Deterministic: seeded PRNG (e.g. mulberry32). The same seed and preset always give the same sequence, so tests
  and screenshots are stable.
- Values are a bounded random walk around the preset baseline (the values `getSimulatedReading(preset)` already
  returns), clamped to plausible ranges:
  - soil moisture 5–60 %, drifting by at most about 0.3 per tick;
  - soil temperature follows a gentle day curve, ±2 °C;
  - air temperature follows a day curve, ±4 °C;
  - humidity 30–95 %.
- Changing the preset moves the baseline smoothly over a few ticks, not as a jump.
- Pauses when `document.visibilityState === 'hidden'` and resumes on return.
- Every reading has `source: 'SIMULATED_IOT'`.

### 3. Real feeds (interface only, not wired up)

`createHttpPollingFeed(url)` / `createMqttFeed(...)` are documented stubs that throw "not configured". A real feed
would need a new `SourceKind` such as `"IOT_OBSERVED"`. That is a **contract change request to Shaheem**; do not
edit `src/contracts`. Until then, nothing in the UI may present a reading as real.

### 4. UI in `SoilSensorsPanel`

- A status line with a badge: "Simulated sensor · updates every 3 s", plus a "Last reading 14:32:05" timestamp.
- Pause / Resume button (shared `Button`, `aria-live="polite"` on the values region, announced at most every 30 s).
- A small trend line per metric (last 20 readings) in a `ChartFrame`, dashed or marked as simulated, with a
  data-table toggle.
- States:
  - connecting: skeleton;
  - stale: "No new reading for 15 s" when the tab returns;
  - error: retry and a fallback to static preset values.
- `prefers-reduced-motion`: values still update, with no animated transitions.
- Copy: "Simulated stream" / "demo stream". **Never** use "live", "real-time" or "connected sensor".

### 5. Keep scoring stable (important)

Rotation scores, scenarios and the dashboard keep using the **preset baseline**, not each streamed tick.
Otherwise Moen's scores would flicker every 3 s and the deterministic tests (S-series) would fail.
The stream is for display; only a preset change or an explicit "Use current reading" action updates
shared soil state.

## Tests

- Same seed gives the same first 10 readings (fake timers).
- All values stay within the clamped ranges over 1,000 ticks.
- Unsubscribing clears timers (no ticks afterwards).
- Pause and resume, plus the hidden-tab pause.
- Every reading is labelled `SIMULATED_IOT`, and the badge text is visible.
- A preset change moves the baseline gradually.
- The scoring input does not change on a tick.
- The copy contains no "real-time" or "live" claim (X12).

## Pitch line

"Readings here are simulated. The panel uses a sensor-feed adapter, so a real field gateway can be connected
without changing the UI."
