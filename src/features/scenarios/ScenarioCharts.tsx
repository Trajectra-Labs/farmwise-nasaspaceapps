// Moen · before/after charts. One chart library (recharts) inside the shared ChartFrame.
// Current plan = solid bars; selected plan under the scenario = hatched, dashed-outline bars,
// so the scenario estimate never looks like an observed measurement.
import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Label, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@fw/ui";
import { formatNumber } from "../../logic/agronomy";
import { fmtDelta, fmtValue, deltaOf, isNum, type MetricRow } from "./format";

type Datum = { name: string; current: number | null; selected: number | null };

function Legend({ currentLabel, selectedLabel }: { currentLabel: string; selectedLabel: string }) {
  return (
    <ul className="scn-legend" aria-label="Legend">
      <li><span className="scn-legend__swatch scn-legend__swatch--current" aria-hidden="true" />{currentLabel} <span className="scn-muted">(solid bar)</span></li>
      <li><span className="scn-legend__swatch scn-legend__swatch--selected" aria-hidden="true" />{selectedLabel} <span className="scn-muted">(hatched bar)</span></li>
      <li className="scn-legend__note">Both bars are scenario estimates from the model, not observed measurements.</li>
    </ul>
  );
}

function summarize(rows: MetricRow[], currentLabel: string, selectedLabel: string): string {
  return rows.map((r) => {
    const d = deltaOf(r);
    return `${r.label}: ${currentLabel} ${fmtValue(r.kind, r.baseline)}, ${selectedLabel} ${fmtValue(r.kind, r.selected)}${isNum(d) ? ` (change ${fmtDelta(r.kind, d)})` : ""}.`;
  }).join(" ");
}

function BeforeAfterChart({ data, kind, yLabel, currentLabel, selectedLabel }: {
  data: Datum[]; kind: "index" | "kes"; yLabel: string; currentLabel: string; selectedLabel: string;
}) {
  const hatchId = `scn-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const tick = { fill: "var(--fw-text-2)", fontSize: 12 };
  const fmtTick = (v: number) => (kind === "kes" ? `${formatNumber(v / 1000)}k` : String(v));
  const hasNegative = data.some((d) => (d.current ?? 0) < 0 || (d.selected ?? 0) < 0);
  return (
    <div className="scn-chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barGap={4} barCategoryGap="22%" accessibilityLayer={false}>
          <defs>
            <pattern id={hatchId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--fw-chart-2)" fillOpacity={0.28} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--fw-chart-2)" strokeWidth="3" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--fw-border)" />
          <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: "var(--fw-border-strong)" }} interval={0} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={kind === "kes" ? 64 : 48}
            tickFormatter={fmtTick} domain={kind === "index" ? [0, 100] : [(min: number) => Math.min(0, min), "auto"]}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fill: "var(--fw-text-2)", fontSize: 12, textAnchor: "middle" }} />
          </YAxis>
          {hasNegative ? <ReferenceLine y={0} stroke="var(--fw-border-strong)" /> : null}
          <Tooltip
            cursor={{ fill: "var(--fw-elevated)" }}
            separator=": " wrapperStyle={{ maxWidth: "min(260px, 80vw)", zIndex: 2 }}
            contentStyle={{ background: "var(--fw-surface)", border: "1px solid var(--fw-border)", borderRadius: 12, color: "var(--fw-text)", whiteSpace: "normal" }}
            labelStyle={{ color: "var(--fw-text)", fontWeight: 600 }}
            itemStyle={{ color: "var(--fw-text)" }}
            formatter={(v) => fmtValue(kind, Number(v))}
          />
          <Bar dataKey="current" name={currentLabel} fill="var(--fw-chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="selected" name={selectedLabel} fill={`url(#${hatchId})`} stroke="var(--fw-chart-2)" strokeWidth={1.5}
            strokeDasharray="4 3" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScenarioCharts({ rows, currentLabel, selectedLabel }: { rows: MetricRow[]; currentLabel: string; selectedLabel: string }) {
  const idx = rows.filter((r) => r.kind === "index");
  const kes = rows.filter((r) => r.kind === "kes");
  const toData = (rs: MetricRow[]): Datum[] => rs.map((r) => ({
    name: r.label.replace("Estimated ", "").replace(/^\w/, (c) => c.toUpperCase()), current: r.baseline, selected: r.selected,
  }));
  const kesUnit = kes[0]?.unit ?? "KES";
  const legend = <Legend currentLabel={currentLabel} selectedLabel={selectedLabel} />;
  return (
    <div className="scn-charts">
      <ChartFrame title="Water and yield indices, before vs after" sources={["MODEL_ESTIMATE"]} legend={legend}
        summary={`Relative indices (0–100, higher is better). ${summarize(idx, currentLabel, selectedLabel)}`}>
        <BeforeAfterChart data={toData(idx)} kind="index" yLabel="Index (0–100)" currentLabel={currentLabel} selectedLabel={selectedLabel} />
      </ChartFrame>
      <ChartFrame title="Cost, revenue and net return, before vs after" sources={["MODEL_ESTIMATE"]} legend={legend}
        summary={`Mid-range estimates in ${kesUnit}; axis in thousands of KES. ${summarize(kes, currentLabel, selectedLabel)}`}>
        <BeforeAfterChart data={toData(kes)} kind="kes" yLabel="KES (thousands)" currentLabel={currentLabel} selectedLabel={selectedLabel} />
      </ChartFrame>
    </div>
  );
}
