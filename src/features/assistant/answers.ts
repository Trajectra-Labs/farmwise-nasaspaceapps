/**
 * Deterministic, context-aware answers for the Ask FarmWise drawer.
 *
 * No language model is called. Every answer is assembled from the farmer's actual profile, the
 * shared rotation evaluation, the NASA snapshot context, the soil reading, the scenario sliders
 * and the last Plant Check observation. Questions are matched to an intent by keywords; anything
 * that does not match gets an honest "I can't answer that" with the topics that are supported.
 */
import type { ClimateContext, FarmProfile, PlantObservation, ScenarioInputs, SoilInput } from '@/contracts/farmwise';
import {
  formatKes, formatNumber, formatSignedKes, runScenario, DEFAULT_SCENARIO_INPUTS,
  type EvaluatedPlan, type RotationEvaluation,
} from '@/logic/agronomy';
import { cropLabel, seasonLabel } from '@/core/seasons';

export type AssistantContext = {
  farm: FarmProfile | null;
  evaluation: RotationEvaluation | null;
  climate: ClimateContext | null;
  soil: SoilInput | null;
  soilPreset: 'dry' | 'normal' | 'wet';
  activePlanId: 'current' | 'minimum' | 'resilience';
  scenario: ScenarioInputs;
  plantObservation: PlantObservation | null;
};

export type Suggestion = { id: string; question: string };

export const SUGGESTIONS: Suggestion[] = [
  { id: 'change', question: 'What should I change first?' },
  { id: 'why', question: 'Why was this rotation suggested?' },
  { id: 'drought', question: 'Is my farm ready for a dry season?' },
  { id: 'crops', question: 'What crops are in my selected plan?' },
  { id: 'scenario', question: 'What happens in my current scenario?' },
  { id: 'soil', question: 'What do my soil readings mean?' },
  { id: 'plant', question: 'What did my last plant check show?' },
  { id: 'confidence', question: 'How reliable are these numbers?' },
];

const PLAN_NAME: Record<string, string> = {
  current: 'current practice',
  minimum: 'minimum-change plan',
  resilience: 'resilience plan',
};

const INTENTS: { id: string; words: RegExp }[] = [
  { id: 'scenario', words: /scenario|what if|rainfall change|hotter|drier|irrigation|input cost|slider/i },
  { id: 'plant', words: /plant check|leaf|photo|disease|pest|symptom|sick/i },
  { id: 'soil', words: /soil|moisture|\bph\b|nitrogen|sensor|nutrient/i },
  { id: 'drought', words: /drought|dry|rain|water|climate|nasa|weather|temperature/i },
  { id: 'crops', words: /which crops|what crops|crops|sequence|plant when|season/i },
  { id: 'why', words: /why|reason|explain|score/i },
  { id: 'change', words: /change|first|start|recommend|should i|best|improve|do next/i },
  { id: 'confidence', words: /confiden|reliable|accurate|trust|sure|guarantee|certain|limits?/i },
];

export function matchIntent(question: string): string | null {
  const exact = SUGGESTIONS.find((s) => s.question.toLowerCase() === question.trim().toLowerCase());
  if (exact) return exact.id;
  return INTENTS.find((i) => i.words.test(question))?.id ?? null;
}

function activePlan(ctx: AssistantContext): EvaluatedPlan | null {
  return ctx.evaluation?.plans.find((p) => p.id === ctx.activePlanId) ?? ctx.evaluation?.plans[0] ?? null;
}

function recommended(ctx: AssistantContext): EvaluatedPlan | null {
  const id = ctx.evaluation?.recommendedId;
  return ctx.evaluation?.plans.find((p) => p.id === id) ?? null;
}

const first = (xs: string[], fallback: string) => xs[0] ?? fallback;

export function answerQuestion(question: string, ctx: AssistantContext): string {
  const { farm } = ctx;
  if (!farm) {
    return 'There is no farm set up yet. Open Onboarding to try the sample farm or enter your own details, and I can answer from your own data.';
  }
  const intent = matchIntent(question);
  const plan = activePlan(ctx);
  const rec = recommended(ctx);
  const rain = ctx.climate?.annualRainfallMm ?? null;

  switch (intent) {
    case 'change': {
      if (!ctx.evaluation || !plan) return 'I do not have a rotation evaluation yet. Add at least one crop season in My Farm.';
      if (!rec) {
        const blocker = first(plan.constraints, 'one of the feasibility checks fails');
        return `None of the three plans passes every feasibility check right now, so I will not recommend one. For your ${PLAN_NAME[plan.id]}: ${blocker}. Adjusting the budget, irrigation or crops in My Farm may change this.`;
      }
      if (rec.id === plan.id) {
        return `Your selected ${PLAN_NAME[plan.id]} is already the highest-scoring feasible option (${rec.score}/100, ${rec.confidence} confidence). A sensible next step is to test it in Scenario Studio with a drier or costlier year before committing.`;
      }
      return `The ${PLAN_NAME[rec.id]} scores ${rec.score}/100 against ${plan.score ?? 'unknown'}/100 for your selected ${PLAN_NAME[plan.id]}. Reason: ${first(rec.benefits, ctx.evaluation.recommendationReason)} Compare them on the Rotation Planner; this is a model estimate, not a guarantee.`;
    }
    case 'why': {
      if (!plan) return 'There is no plan to explain yet. Add crop seasons in My Farm.';
      const parts = plan.components
        .filter((c) => c.value != null)
        .map((c) => `${c.label} ${Math.round(c.value as number)}/100`)
        .join(', ');
      const priorities = farm.priorities.length ? ` Your priorities (${farm.priorities.join(', ')}) increase the weight of those factors.` : '';
      return `The ${PLAN_NAME[plan.id]} scores ${plan.score ?? 'Unknown'}/100 with ${plan.confidence} confidence. Breakdown: ${parts || 'not enough inputs to score every factor'}.${priorities} ${first(plan.benefits, '')} Open the Why drawer on the Rotation Planner for the evidence behind each point.`.trim();
    }
    case 'drought': {
      if (rain == null) {
        return 'I do not have NASA climate values for this location, because the farm coordinates are missing or far from the bundled snapshot. Set the location in My Farm and I can answer from NASA POWER history.';
      }
      const irrigation = farm.irrigation === 'rainfed' ? 'Your farm is rainfed, so it depends fully on rainfall.' : `Your farm has ${farm.irrigation} irrigation, which cushions a dry year.`;
      const dryRisk = plan?.risks.find((r) => /dry|water|drought|rain/i.test(r));
      return `NASA POWER history (${ctx.climate?.observedPeriod}) shows about ${formatNumber(rain)} mm of rain per year for the nearest grid cell. That describes the past region, not your field and not a forecast. ${irrigation}${dryRisk ? ` Flagged risk for your selected plan: ${dryRisk}` : ''} Try the "Drier year" preset in Scenario Studio to see the estimated effect.`;
    }
    case 'crops': {
      if (!plan) return 'No rotation plan is selected yet.';
      const seq = plan.seasons.map((s) => `${cropLabel(s.cropId)} (${seasonLabel(s.season)}, year ${s.yearOffset + 1})`).join('; ');
      return `Your selected ${PLAN_NAME[plan.id]} is: ${seq}.`;
    }
    case 'scenario': {
      if (!ctx.evaluation || !plan) return 'Scenario results need a rotation evaluation first. Add crop seasons in My Farm.';
      const current = ctx.evaluation.plans.find((p) => p.id === 'current');
      if (!current) return 'I could not find your current plan to compare against.';
      const target = plan.id === 'current' ? (rec && rec.id !== 'current' ? rec : ctx.evaluation.plans.find((p) => p.id === 'minimum') ?? plan) : plan;
      const sc = ctx.scenario;
      const isDefault = JSON.stringify(sc) === JSON.stringify(DEFAULT_SCENARIO_INPUTS);
      const res = runScenario(target, sc, { farm, climate: ctx.climate, soil: ctx.soil, currentPlan: current });
      const label = isDefault ? 'typical conditions' : `rainfall ${sc.rainfallDeltaPct >= 0 ? '+' : ''}${sc.rainfallDeltaPct}%, temperature ${sc.temperatureDeltaC >= 0 ? '+' : ''}${sc.temperatureDeltaC} °C, irrigation ${sc.irrigationPct}%, input costs ${sc.inputCostDeltaPct >= 0 ? '+' : ''}${sc.inputCostDeltaPct}%`;
      const b = res.baseline.estimatedNetReturn;
      const s = res.selected.estimatedNetReturn;
      if (b == null || s == null) {
        return `With ${label}, I cannot estimate net return because some inputs (budget, area or climate) are unknown. Scenario Studio lists what is missing.`;
      }
      return `With ${label}, the model estimates a net return of about ${formatKes(s)} for the ${PLAN_NAME[target.id]} versus ${formatKes(b)} for current practice (difference ${formatSignedKes(s - b)}). These are ranged model estimates built on stated assumptions, not predictions of your actual yield or profit.`;
    }
    case 'soil': {
      const src = ctx.soil?.source;
      if (!ctx.soil) return 'No soil values are available yet. Choose a simulated preset or enter a lab soil test under My Farm, Soil & Sensors.';
      const ph = ctx.soil.ph != null ? `pH ${ctx.soil.ph}` : 'pH unknown';
      const m = ctx.soil.moisturePct != null ? `moisture ${ctx.soil.moisturePct}%` : 'moisture unknown';
      if (src === 'USER_SOIL_TEST') {
        return `The model is using the soil test you entered (${ph}, ${m}). Missing nutrients are treated as unknown, never as zero.`;
      }
      return `The model is using the simulated "${ctx.soilPreset}" sensor preset (${ph}, ${m}). These readings are simulated: no real sensor is connected. A lab soil test entered in My Farm replaces them and raises confidence.`;
    }
    case 'plant': {
      const o = ctx.plantObservation;
      if (!o) return 'You have not run a Plant Check yet. Open Plant Check to try a labelled demo example or tick the signs you can see. FarmWise does not diagnose plants from arbitrary photos.';
      return `Your last Plant Check (${o.source === 'DEMO_IMAGE' ? 'demo example' : 'farmer-reported signs'}) listed: ${o.visibleSigns.join(', ') || 'no visible signs'}. Possible concerns to check locally: ${o.possibleConcerns.join('; ') || 'none listed'}. ${o.certaintyNote}`;
    }
    case 'confidence':
      return `Plan scores are model estimates from simplified agronomy rules, NASA POWER history for a regional grid cell, and ${ctx.soil?.source === 'USER_SOIL_TEST' ? 'your soil test' : 'simulated soil readings'}. Confidence rates how complete the inputs are, not the chance of success. Nothing here is a guaranteed yield or profit; check with a local extension officer before changing what you plant.`;
    default:
      return 'I can answer questions about your rotation plans, why a plan was suggested, NASA climate history for your location, your soil readings, the scenario you set, and your last Plant Check. I cannot give pest or disease diagnoses, weather forecasts or financial advice. Try one of the suggested questions.';
  }
}
