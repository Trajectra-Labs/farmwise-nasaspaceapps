// Moen · formulas shown in the Assumptions drawer. They mirror src/logic/agronomy/scenario.ts and
// model.ts; constants are imported so the text cannot drift from the model.
import { ET_INCREASE_PER_DEG_C, HEAT_YIELD_PENALTY_PER_DEG_C } from "../../logic/agronomy";

export type Formula = { name: string; formula: string; note?: string };
export const SCENARIO_FORMULAS: Formula[] = [
  { name: "Seasonal rainfall", formula: "NASA mean annual rainfall × season share × (1 + rainfall change %)" },
  { name: "Water available (per season)", formula: "seasonal rainfall + irrigation mm × irrigation availability % + soil-moisture adjustment" },
  { name: "Crop water demand", formula: `Σ seasons mid crop water need × (1 + ${ET_INCREASE_PER_DEG_C} × temperature change °C)` },
  { name: "Water index (0–100)", formula: "100 × Σ min(1, available ÷ need) × need ÷ Σ need", note: "Share of crop water demand that is covered." },
  { name: "Yield index (0–100)", formula: `100 × mean of (1 − Ky × (1 − water met)) × heat factor`, note: `Heat factor falls ${Math.round(HEAT_YIELD_PENALTY_PER_DEG_C * 100)} % per °C above each crop’s threshold.` },
  { name: "Estimated cost", formula: "Σ seasons mid input cost per ha × area × (1 + input-cost change %)" },
  { name: "Estimated revenue", formula: "Σ seasons typical yield × yield ratio × mid price × area" },
  { name: "Estimated net return", formula: "estimated revenue − estimated cost", note: "An estimate, never a guaranteed income." },
  { name: "Current vs selected", formula: "both plans are run under the same scenario inputs; change = selected − current" },
];
