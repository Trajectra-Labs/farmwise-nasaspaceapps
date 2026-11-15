import { Badge, Button, Card, SourceBadge } from "@fw/ui";
import type { CropSeason } from "@fw/contracts";
import type { EvaluatedPlan } from "../../logic/agronomy/types";
import { PlanSequence } from "./PlanSequence";
import {
  budgetFitText, changeText, confidenceText, formatKesRange, scoreText, soilImplication, topRisk, waterText,
} from "./format";

export type PlanCardProps = {
  plan: EvaluatedPlan;
  selected: boolean;
  recommended: boolean;
  tabbable: boolean;
  currentSeasons: CropSeason[];
  hasBudget: boolean;
  onSelect: () => void;
  onWhy: () => void;
};

export function PlanCard({ plan, selected, recommended, tabbable, currentSeasons, hasBudget, onSelect, onWhy }: PlanCardProps) {
  const titleId = `rot-plan-${plan.id}-title`;
  return (
    <Card selected={selected} className="rot-card" aria-labelledby={titleId} data-plan-id={plan.id} data-testid={`plan-card-${plan.id}`}>
      <div className="rot-card__head">
        <h3 id={titleId} className="rot-card__title">{plan.title}</h3>
        <div className="rot-badges">
          {recommended ? <Badge tone="info" data-testid="recommended-badge">Recommended</Badge> : null}
          {plan.feasible ? <Badge tone="success">Feasible</Badge> : <Badge tone="danger">Not feasible</Badge>}
          {selected ? <Badge tone="neutral">Selected</Badge> : null}
        </div>
      </div>
      <p className="rot-card__summary rot-muted">{plan.summary}</p>

      <PlanSequence seasons={plan.seasons} label={`${plan.title} crop sequence`} changedFrom={plan.id === "current" ? undefined : currentSeasons} />

      <div className="rot-score">
        <div className="rot-score__item">
          <span className="rot-label">Score</span>
          <span className="rot-score__value" data-testid={`score-${plan.id}`}>{scoreText(plan)}</span>
          <SourceBadge source="MODEL_ESTIMATE" />
        </div>
        <div className="rot-score__item">
          <span className="rot-label">Confidence</span>
          <span className="rot-score__conf" data-testid={`confidence-${plan.id}`}>{confidenceText(plan.confidence)}</span>
        </div>
      </div>

      <dl className="rot-facts">
        <div><dt>Change</dt><dd>{changeText(plan.changeSize, plan.changedSeasons, plan.seasons.length)}</dd></div>
        <div>
          <dt>Water need</dt>
          <dd data-testid={`water-${plan.id}`}>{waterText(plan.waterDemandMm)} over the rotation <SourceBadge source="MODEL_ESTIMATE" /></dd>
        </div>
        <div><dt>Soil</dt><dd>{soilImplication(plan)}</dd></div>
        <div>
          <dt>Input costs</dt>
          <dd>{formatKesRange(plan.costRangeKes)} {plan.costBasis === "per_ha" ? "per ha" : "whole farm"} <SourceBadge source="MODEL_ESTIMATE" /></dd>
        </div>
        <div>
          <dt>Budget fit</dt>
          <dd>
            <span className={plan.budgetFit === "over" ? "rot-text-warn" : undefined}>{budgetFitText[plan.budgetFit]}</span>
            {hasBudget ? <> <SourceBadge source="MODEL_ESTIMATE" /></> : null}
          </dd>
        </div>
        <div><dt>Evidence</dt><dd>{plan.evidence.length} {plan.evidence.length === 1 ? "item" : "items"} linked</dd></div>
        <div><dt>Top risk</dt><dd>{topRisk(plan)}</dd></div>
      </dl>

      {!plan.feasible ? (
        <p className="rot-warning" role="note">
          This plan fails a blocking check, so it is not scored and cannot be recommended. You can still view why.
        </p>
      ) : null}

      <div className="rot-card__actions">
        <Button
          variant={selected ? "primary" : "secondary"}
          role="radio"
          aria-checked={selected}
          aria-labelledby={titleId}
          tabIndex={tabbable ? 0 : -1}
          onClick={onSelect}
          data-radio-id={plan.id}
        >
          {selected ? "Selected" : "Select this plan"}
        </Button>
        <Button variant="ghost" onClick={onWhy} aria-haspopup="dialog" aria-label={`Why this plan? ${plan.title}`}>Why this plan?</Button>
      </div>
    </Card>
  );
}
