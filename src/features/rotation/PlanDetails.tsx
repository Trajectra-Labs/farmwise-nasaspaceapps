import { Badge, Button, Card, SourceBadge } from "@fw/ui";
import type { EvaluatedPlan, RotationEvaluation } from "../../logic/agronomy/types";
import { confidenceText, scoreText, weightPct } from "./format";

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="fw-muted">{empty}</p>;
  return <ul className="rot-list">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

export function PlanDetails({ plan, evaluation, recommended, onUse, onWhy }: {
  plan: EvaluatedPlan; evaluation: RotationEvaluation; recommended: boolean; onUse: () => void; onWhy: () => void;
}) {
  const useBlocked = !plan.feasible;
  return (
    <Card className="rot-details" aria-labelledby="rot-details-title" data-testid="plan-details">
      <div className="rot-details__head">
        <div>
          <h2 id="rot-details-title" className="rot-details__title">Details: {plan.title}</h2>
          <div className="rot-badges">
            {recommended ? <Badge tone="info">Recommended</Badge> : null}
            {plan.feasible ? <Badge tone="success">Feasible</Badge> : <Badge tone="danger">Not feasible</Badge>}
            <Badge tone="neutral">Score: {scoreText(plan)}</Badge>
            <Badge tone="neutral">{confidenceText(plan.confidence)}</Badge>
            <SourceBadge source="MODEL_ESTIMATE" />
          </div>
        </div>
        <div className="rot-details__actions">
          <Button variant="primary" onClick={onUse} disabled={useBlocked} aria-describedby={useBlocked ? "rot-use-blocked" : undefined}>
            Use in scenarios
          </Button>
          <Button onClick={onWhy} aria-haspopup="dialog" aria-label={`Why this plan? ${plan.title} (details)`}>Why this plan?</Button>
        </div>
      </div>
      {useBlocked ? (
        <p id="rot-use-blocked" className="rot-warning" role="note">
          “Use in scenarios” is turned off for this plan because it fails a blocking check below. Choose a feasible plan to explore scenarios.
        </p>
      ) : null}

      <div className="rot-details__grid">
        <section aria-labelledby="rot-checks-h">
          <h3 id="rot-checks-h">Feasibility checks</h3>
          {plan.checks.length === 0 ? <p className="fw-muted">No checks were run.</p> : (
            <ul className="rot-checks">
              {plan.checks.map((c) => (
                <li key={c.id} className="rot-check">
                  <Badge tone={c.passed ? "success" : c.blocking ? "danger" : "warn"}>
                    {c.passed ? "Pass" : c.blocking ? "Fail · blocking" : "Warning"}
                  </Badge>
                  <span><strong>{c.label}.</strong> {c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="rot-benefits-h">
          <h3 id="rot-benefits-h">Benefits</h3>
          <List items={plan.benefits} empty="No specific benefits identified." />
          <h3 id="rot-risks-h">Risks</h3>
          <List items={plan.risks} empty="No major risks flagged by the rules." />
          <h3>Constraints</h3>
          <List items={plan.constraints} empty="No constraints recorded." />
        </section>
      </div>

      <section aria-labelledby="rot-breakdown-h" className="rot-breakdown">
        <div className="rot-row">
          <h3 id="rot-breakdown-h">Score breakdown</h3>
          <SourceBadge source="MODEL_ESTIMATE" />
        </div>
        <p className="fw-muted rot-small">
          The score is a relative 0–100 comparison of these three plans for this farm, not a certified soil test or a yield promise.
          Each part is weighted; parts with missing inputs are shown as “Unknown”.
        </p>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-scrollable (WCAG 2.1.1) */}
        <div className="rot-table-scroll" role="region" aria-label="Score breakdown table" tabIndex={0}>
          <table className="rot-table rot-table--stack">
            <thead>
              <tr><th scope="col">Part</th><th scope="col">Weight</th><th scope="col">Sub-score</th><th scope="col">Why</th></tr>
            </thead>
            <tbody>
              {plan.components.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.label}</th>
                  <td data-label="Weight">{weightPct(evaluation.weights[c.key] ?? c.weight)}</td>
                  <td data-label="Sub-score">{c.value == null ? "Unknown" : `${Math.round(c.value)} / 100`}</td>
                  <td data-label="Why" className="rot-table__wide">{c.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rot-missing-h">
        <h3 id="rot-missing-h">Missing information</h3>
        <List items={plan.missingInfo} empty="Nothing important is missing for this plan." />
      </section>
    </Card>
  );
}
