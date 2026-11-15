// Moen · metric comparison tiles + accessible before/after data table.
import { SourceBadge } from "@fw/ui";
import { deltaDirection, deltaOf, fmtDelta, fmtRangeOf, fmtValue, type MetricRow } from "./format";

const DIRECTION_TEXT = { better: "better", worse: "worse", same: "no change", unknown: "" } as const;

export function MetricTiles({ rows, currentLabel, selectedLabel }: { rows: MetricRow[]; currentLabel: string; selectedLabel: string }) {
  return (
    <ul className="scn-metrics" aria-label="Metric comparison">
      {rows.map((r) => {
        const dir = deltaDirection(r);
        const selRange = fmtRangeOf(r.kind, r.selectedRange);
        const baseRange = fmtRangeOf(r.kind, r.baselineRange);
        return (
          <li key={r.key} className="scn-metric" data-metric={r.key}>
            <div className="scn-metric__head">
              <h3 className="scn-metric__label">{r.label}</h3>
              <SourceBadge source="MODEL_ESTIMATE" />
            </div>
            <p className="scn-metric__unit">{r.unit}</p>
            <dl className="scn-metric__vals">
              <div>
                <dt>{currentLabel}</dt>
                <dd data-testid={`metric-${r.key}-current`}>{fmtValue(r.kind, r.baseline)}</dd>
                {baseRange ? <dd className="scn-metric__range">Range {baseRange}</dd> : null}
              </div>
              <div className="scn-metric__selected">
                <dt>{selectedLabel}</dt>
                <dd data-testid={`metric-${r.key}-selected`}>{fmtValue(r.kind, r.selected)}</dd>
                {selRange ? <dd className="scn-metric__range">Range {selRange}</dd> : null}
              </div>
            </dl>
            {r.typical !== undefined ? (
              <p className="scn-metric__typical" data-testid={`metric-${r.key}-typical`}>
                {selectedLabel} at Typical conditions: {fmtValue(r.kind, r.typical)}
              </p>
            ) : null}
            <p className={`scn-metric__delta scn-delta--${dir}`} data-testid={`metric-${r.key}-delta`}>
              Change vs current: <strong>{fmtDelta(r.kind, deltaOf(r))}</strong>
              {DIRECTION_TEXT[dir] ? <span> ({DIRECTION_TEXT[dir]})</span> : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function ResultsTable({ rows, currentLabel, selectedLabel }: { rows: MetricRow[]; currentLabel: string; selectedLabel: string }) {
  return (
    <>
    <p className="scn-table-note">
      Current rotation vs the selected plan under this scenario, plus the selected plan at Typical conditions. All values are model
      estimates (mid-range; KES rounded to 1,000); ranges show the low–high estimate.
    </p>
    {/* A scrollable region must be keyboard-focusable
      (WCAG 2.1.1 / axe scrollable-region-focusable). */}
    <div className="scn-table-wrap" role="region" aria-label="Before and after data table (scrolls horizontally on small screens)" tabIndex={0}>
      <table className="scn-table">
        <caption>Before/after numbers (model estimates)</caption>
        <thead>
          <tr>
            <th scope="col">Metric (unit)</th>
            <th scope="col">{currentLabel}</th>
            <th scope="col">{selectedLabel}</th>
            <th scope="col">Change vs current</th>
            <th scope="col">Selected: low–high range</th>
            <th scope="col">Selected at Typical</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}<span className="scn-table__unit">{r.unit}</span></th>
              <td className="scn-num">{fmtValue(r.kind, r.baseline)}</td>
              <td className="scn-num">{fmtValue(r.kind, r.selected)}</td>
              <td className="scn-num">{fmtDelta(r.kind, deltaOf(r))}</td>
              <td className="scn-num scn-num--wrap">{fmtRangeOf(r.kind, r.selectedRange) ?? "Not estimated"}</td>
              <td className="scn-num scn-num--wrap">{r.typical === undefined ? "Same (Typical selected)" : fmtValue(r.kind, r.typical)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
