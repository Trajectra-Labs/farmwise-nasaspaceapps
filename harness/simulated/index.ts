// HARNESS stand-in for Abdullah's getSimulatedReading(preset). Values are SIMULATED_IOT — synthetic,
// fixed per preset so tests are deterministic. Not a real sensor, not a lab soil test.
import type { SoilInput } from "@fw/contracts";
const TS = "2026-11-01T06:00:00Z";
const PRESETS: Record<"dry" | "normal" | "wet", SoilInput> = {
  dry: { ph: 6.1, n: 18, p: 12, k: 140, moisturePct: 11, source: "SIMULATED_IOT", timestamp: TS },
  normal: { ph: 6.3, n: 28, p: 18, k: 165, moisturePct: 24, source: "SIMULATED_IOT", timestamp: TS },
  wet: { ph: 6.0, n: 22, p: 15, k: 150, moisturePct: 38, source: "SIMULATED_IOT", timestamp: TS },
};
export function getSimulatedReading(preset: "dry" | "normal" | "wet"): SoilInput {
  return { ...PRESETS[preset] };
}
