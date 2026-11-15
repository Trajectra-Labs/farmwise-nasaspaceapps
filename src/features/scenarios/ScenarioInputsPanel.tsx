// Moen · "Observed inputs" (NASA snapshot, simulated soil, farmer input) versus
// "Scenario-adjusted inputs" (model estimates). Kept visually and semantically separate.
import type { ClimateContext, FarmProfile, ScenarioInputs, SoilInput } from "@fw/contracts";
import { SourceBadge } from "@fw/ui";
import { fmtIrrigation, fmtPct, fmtTemp, isNum, UNKNOWN } from "./format";

const IRRIGATION_TEXT: Record<FarmProfile["irrigation"], string> = { rainfed: "Rainfed (no irrigation)", limited: "Limited irrigation", regular: "Regular irrigation" };

export function ScenarioInputsPanel({ climate, soil, farm, inputs, waterSupplyMm }: {
  climate: ClimateContext | null; soil: SoilInput | null; farm: FarmProfile; inputs: ScenarioInputs; waterSupplyMm: number | null;
}) {
  const rain = isNum(climate?.annualRainfallMm) ? climate.annualRainfallMm : null;
  const temp = isNum(climate?.meanTemperatureC) ? climate.meanTemperatureC : null;
  const climateSource = climate && !climate.snapshot ? "NASA_OBSERVED" : "NASA_OFFLINE_SNAPSHOT";
  const adjRain = rain == null ? null : Math.max(0, Math.round(rain * (1 + inputs.rainfallDeltaPct / 100)));
  const adjTemp = temp == null ? null : Math.round((temp + inputs.temperatureDeltaC) * 10) / 10;
  const rainfed = farm.irrigation === "rainfed";
  return (
    <div className="scn-inputs">
      <section className="scn-inputs__panel scn-inputs__panel--observed" aria-labelledby="scn-observed-h">
        <h3 id="scn-observed-h">Observed inputs</h3>
        <p className="scn-inputs__note">What the model starts from. Historical and simulated values, not a forecast.</p>
        <dl className="scn-kv">
          <div>
            <dt>Mean annual rainfall</dt>
            <dd>{rain == null ? UNKNOWN : `${rain.toLocaleString("en-US")} mm/yr`} <SourceBadge source={climateSource} /></dd>
          </div>
          <div>
            <dt>Mean air temperature</dt>
            <dd>{temp == null ? UNKNOWN : `${temp.toFixed(1)} °C`} <SourceBadge source={climateSource} /></dd>
          </div>
          <div>
            <dt>Observation period</dt>
            <dd>{climate?.observedPeriod ?? UNKNOWN}</dd>
          </div>
          <div>
            <dt>Soil moisture</dt>
            <dd>{isNum(soil?.moisturePct) ? `${soil.moisturePct}%` : UNKNOWN} {soil ? <SourceBadge source={soil.source} /> : null}</dd>
          </div>
          <div>
            <dt>Irrigation on this farm</dt>
            <dd>{IRRIGATION_TEXT[farm.irrigation]} <SourceBadge source="FARMER_REPORTED" /></dd>
          </div>
        </dl>
      </section>
      <section className="scn-inputs__panel scn-inputs__panel--estimate" aria-labelledby="scn-adjusted-h">
        <h3 id="scn-adjusted-h">Scenario-adjusted inputs</h3>
        <p className="scn-inputs__note">Observed values after your what-if changes. These are estimates.</p>
        <dl className="scn-kv">
          <div>
            <dt>Rainfall ({fmtPct(inputs.rainfallDeltaPct)})</dt>
            <dd>{adjRain == null ? UNKNOWN : `${adjRain.toLocaleString("en-US")} mm/yr`} <SourceBadge source="MODEL_ESTIMATE" /></dd>
          </div>
          <div>
            <dt>Temperature ({fmtTemp(inputs.temperatureDeltaC)})</dt>
            <dd>{adjTemp == null ? UNKNOWN : `${adjTemp.toFixed(1)} °C`} <SourceBadge source="MODEL_ESTIMATE" /></dd>
          </div>
          <div>
            <dt>Irrigation water available</dt>
            <dd>{rainfed ? "No effect (rainfed farm)" : `${fmtIrrigation(inputs.irrigationPct)} of usual`} <SourceBadge source="MODEL_ESTIMATE" /></dd>
          </div>
          <div>
            <dt>Input costs</dt>
            <dd>{fmtPct(inputs.inputCostDeltaPct)} vs typical prices <SourceBadge source="MODEL_ESTIMATE" /></dd>
          </div>
          <div>
            <dt>Water available to crops</dt>
            <dd>{isNum(waterSupplyMm) ? `${Math.round(waterSupplyMm).toLocaleString("en-US")} mm over rotation` : UNKNOWN} <SourceBadge source="MODEL_ESTIMATE" /></dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
