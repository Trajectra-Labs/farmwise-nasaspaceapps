import type { ReactNode } from "react";
import { Badge, Button, Dialog, SourceBadge } from "@fw/ui";
import type { EvaluatedPlan, RotationEvaluation } from "../../logic/agronomy/types";
import { PlanSequence } from "./PlanSequence";
import { budgetFitText, changeText, confidenceText, formatKesRange, scoreText, soilImplication, waterText } from "./format";

type Row = { key: string; label: string; render: (p: EvaluatedPlan) => ReactNode };

export function CompareDialog({ open, onClose, evaluation }: { open: boolean; onClose: () => void; evaluation: RotationEvaluation }) {
  const current = evaluation.plans.find((p) => p.id === "current")?.seasons;
  const rows: Row[] = [
    { key: "seq", label: "Crop sequence", render: (p) => <PlanSequence seasons={p.seasons} label={`${p.title} sequence`} changedFrom={p.id === "current" ? undefined : current} /> },
    { key: "feasible", label: "Feasible", render: (p) => (p.feasible ? <Badge tone="success">Yes</Badge> : <Badge tone="danger">No</Badge>) },
    { key: "change", label: "Change size", render: (p) => changeText(p.changeSize, p.changedSeasons, p.seasons.length) },
    { key: "water", label: "Water need (rotation total)", render: (p) => <>{waterText(p.waterDemandMm)} <SourceBadge source="MODEL_ESTIMATE" /></> },
    { key: "soil", label: "Soil effect", render: (p) => soilImplication(p) },
    { key: "cost", label: `Input cost range (${evaluation.currency})`, render: (p) => <>{formatKesRange(p.costRangeKes)} {p.costBasis === "per_ha" ? "per ha" : "whole farm"} <SourceBadge source="MODEL_ESTIMATE" /></> },
    { key: "budget", label: "Budget fit (per season)", render: (p) => <>{budgetFitText[p.budgetFit]}{p.budgetFit !== "unknown" ? <> <SourceBadge source="MODEL_ESTIMATE" /></> : null}</> },
    { key: "risks", label: "Risks flagged", render: (p) => String(p.risks.length) },
    { key: "score", label: "Score", render: (p) => <>{scoreText(p)} <SourceBadge source="MODEL_ESTIMATE" /></> },
    { key: "confidence", label: "Confidence", render: (p) => confidenceText(p.confidence) },
    { key: "recommended", label: "Recommended", render: (p) => (p.id === evaluation.recommendedId ? <Badge tone="info">Recommended</Badge> : "No") },
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Compare all plans"
      description="Every number is a rounded model estimate. Costs are input costs in Kenyan shillings (KES), not guaranteed income."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="rot-compare-wide">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-scrollable (WCAG 2.1.1) */}
        <div className="rot-table-scroll" role="region" aria-label="Plan comparison table" tabIndex={0}>
          <table className="rot-table rot-compare-table">
            <caption className="rot-sr-only">Comparison of the three rotation plans</caption>
            <thead>
              <tr>
                <th scope="col">Attribute</th>
                {evaluation.plans.map((p) => <th key={p.id} scope="col">{p.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  {evaluation.plans.map((p) => <td key={p.id}>{r.render(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rot-compare-stack">
        {evaluation.plans.map((p) => (
          <section key={p.id} className="rot-compare-plan" aria-labelledby={`cmp-${p.id}`}>
            <h3 id={`cmp-${p.id}`}>{p.title}</h3>
            <dl className="rot-facts">
              {rows.map((r) => <div key={r.key}><dt>{r.label}</dt><dd>{r.render(p)}</dd></div>)}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
