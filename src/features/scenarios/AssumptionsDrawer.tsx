// Moen · Assumptions drawer (S08): the rules and formulas runScenario() actually used.
import { Button, Drawer, SourceBadge } from "@fw/ui";
import type { DetailedScenarioResult } from "../../logic/agronomy/types";
import { SCENARIO_FORMULAS } from "./formulas";

export type DrawerSource = { title: string; url: string; period?: string };

export function AssumptionsDrawer({ open, onClose, result, planTitle, sources, climateAvailable }: {
  open: boolean; onClose: () => void; result: DetailedScenarioResult | null; planTitle: string; sources: DrawerSource[]; climateAvailable: boolean;
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Scenario assumptions"
      description={<>What the estimate for <strong>{planTitle}</strong> is built on. <SourceBadge source="MODEL_ESTIMATE" /></>}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="scn-drawer">
        <section aria-labelledby="scn-asm-h">
          <h3 id="scn-asm-h">Assumptions used in this run</h3>
          {result && result.assumptions.length > 0 ? (
            <ul className="scn-list">{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          ) : <p className="scn-muted">No result yet, so no assumptions were applied.</p>}
        </section>
        <section aria-labelledby="scn-formula-h">
          <h3 id="scn-formula-h">Formulas</h3>
          {!climateAvailable ? (
            <p className="scn-muted">Climate data is unavailable in this run, so the rainfall, water and yield formulas were not applied; only cost is estimated.</p>
          ) : null}
          <dl className="scn-formulas">
            {SCENARIO_FORMULAS.map((f) => (
              <div key={f.name}><dt>{f.name}</dt><dd><code>{f.formula}</code>{f.note ? <span className="scn-muted"> {f.note}</span> : null}</dd></div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="scn-src-h">
          <h3 id="scn-src-h">Observed data sources</h3>
          {sources.length ? (
            <ul className="scn-list">
              {sources.map((src) => (
                <li key={src.url + src.title}>
                  <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a>
                  {src.period ? <span className="scn-muted"> · {src.period}</span> : null} <SourceBadge source="NASA_OFFLINE_SNAPSHOT" />
                </li>
              ))}
            </ul>
          ) : <p className="scn-muted">Climate data is unavailable, so no observed source was used.</p>}
        </section>
        {result && result.uncertainty.length > 0 ? (
          <section aria-labelledby="scn-asm-unc-h">
            <h3 id="scn-asm-unc-h">Known uncertainty</h3>
            <ul className="scn-list">{result.uncertainty.map((u) => <li key={u}>{u}</li>)}</ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
