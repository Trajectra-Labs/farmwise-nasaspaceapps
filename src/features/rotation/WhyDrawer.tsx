import { Badge, Button, Drawer, SourceBadge } from "@fw/ui";
import type { Evidence } from "@fw/contracts";
import type { EvaluatedPlan } from "../../logic/agronomy/types";
import { confidenceText, scoreText } from "./format";
import { ruleSource } from "./logicBridge";

function EvidenceItem({ ev }: { ev: Evidence }) {
  const value = ev.value == null ? "Unknown" : `${typeof ev.value === "number" ? Math.round(ev.value * 10) / 10 : ev.value}${ev.unit ? ` ${ev.unit}` : ""}`;
  return (
    <li className="rot-ev">
      <div className="rot-row">
        <strong>{ev.title}</strong>
        <SourceBadge source={ev.source} />
      </div>
      <div className="rot-ev__meta">
        <span>Value: {value}</span>
        {ev.period ? <span>Period: {ev.period}</span> : null}
        {ev.spatialScale ? <span>Scale: {ev.spatialScale}</span> : null}
      </div>
      {ev.note ? <p className="rot-small fw-muted">{ev.note}</p> : null}
      {ev.url ? (
        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="rot-link">
          Open source for “{ev.title}” (external site, opens in new tab)
        </a>
      ) : null}
    </li>
  );
}

export function WhyDrawer({ plan, open, onClose }: { plan: EvaluatedPlan | null; open: boolean; onClose: () => void }) {
  if (!plan) return null;
  const evById = new Map(plan.evidence.map((e) => [e.id, e]));
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Why this plan? ${plan.title}`}
      description="Reasons, the evidence behind them, what we don't know, and how the score differs from confidence."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="rot-why">
        <div className="rot-badges">
          {plan.feasible ? <Badge tone="success">Feasible</Badge> : <Badge tone="danger">Not feasible</Badge>}
          <Badge tone="neutral">Score: {scoreText(plan)}</Badge>
          <Badge tone="neutral">{confidenceText(plan.confidence)}</Badge>
        </div>

        <section aria-labelledby="why-reasons">
          <h3 id="why-reasons">Reasons</h3>
          {plan.reasons.length === 0 ? <p className="fw-muted">No reasons recorded.</p> : (
            <ol className="rot-reasons">
              {plan.reasons.map((r, i) => {
                const evs = r.evidenceIds.map((id) => evById.get(id)).filter((e): e is Evidence => !!e);
                return (
                  <li key={i} className="rot-reason">
                    <p>{r.text}</p>
                    {evs.length > 0 ? (
                      <ul className="rot-ev-list" aria-label="Linked evidence">
                        {evs.map((e) => <EvidenceItem key={e.id} ev={e} />)}
                      </ul>
                    ) : null}
                    {r.ruleIds.length > 0 ? (
                      <ul className="rot-rules" aria-label="Rule sources">
                        {r.ruleIds.map((id) => {
                          const src = ruleSource(id);
                          return (
                            <li key={id} className="rot-rule">
                              <Badge tone={src.kind === "published" ? "info" : "warn"}>
                                {src.kind === "published" ? "Published source" : "Team assumption"}
                              </Badge>
                              {src.url ? (
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="rot-link">
                                  {src.title} (external site, opens in new tab)
                                </a>
                              ) : <span>{src.title}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="why-risks">
          <h3 id="why-risks">Risks</h3>
          {plan.risks.length ? <ul className="rot-list">{plan.risks.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="fw-muted">No major risks flagged.</p>}
        </section>

        <section aria-labelledby="why-unknowns">
          <h3 id="why-unknowns">Unknowns and missing information</h3>
          {plan.missingInfo.length ? <ul className="rot-list">{plan.missingInfo.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="fw-muted">No important inputs are missing.</p>}
        </section>

        <section aria-labelledby="why-evidence">
          <h3 id="why-evidence">All evidence used ({plan.evidence.length})</h3>
          {plan.evidence.length ? <ul className="rot-ev-list">{plan.evidence.map((e) => <EvidenceItem key={e.id} ev={e} />)}</ul> : <p className="fw-muted">No evidence linked.</p>}
        </section>

        <section aria-labelledby="why-score">
          <h3 id="why-score">Score versus confidence</h3>
          <p><strong>Score</strong> is a relative 0–100 model estimate comparing the three plans on water, soil, cost, climate fit and size of change, using the weights shown in Details. It is not a certified soil test and does not guarantee yield or profit. Infeasible plans are not scored.</p>
          <p><strong>Confidence</strong> ({plan.confidence}) says how much real input backs that score: climate evidence, soil readings and farmer inputs. Missing or simulated data lowers confidence even when the score is high.</p>
        </section>
      </div>
    </Drawer>
  );
}
