/**
 * Dashboard Page — Shaheem
 *
 * Information order:
 *   1. Farm identity, location and season context
 *   2. The single most important recommendation
 *   3. Key indicators (plan score, confidence, rainfall, soil moisture)
 *   4. The selected crop rotation
 *   5. Climate and soil observations
 *   6. Secondary actions
 *
 * Every value is derived from shared state and the shared data/logic functions.
 * Missing values render as "Unknown"; nothing is hard-coded.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  MapPin, Ruler, Droplets, CalendarDays, Pencil, ArrowRight, Lightbulb, CloudRain, Sprout,
  ChartNoAxesCombined, ScanSearch, MessagesSquare, ChevronRight, ExternalLink, TriangleAlert,
  RefreshCcw, Info, Database, Gauge, ShieldCheck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFarmWise } from '@/core/store';
import { snapshotClimate, powerManifest } from '@/data/nasa';
import { useMoenData } from '@/features/rotation/moenStore';
import { cropLabel, seasonLabel } from '@/core/seasons';
import {
  Card, CardHeader, Stat, SourceBadge, ConfidenceBadge, Button, EmptyState, Dialog, Icon,
  Popover, ChartFrame, InfoTip,
} from '@/ui/components';
import { sourceDescription } from '@/ui/sources';
import { useReducedMotion } from '@/ui/motion';
import { formatLatLon } from '@/ui/format';
import { currentSeason, MONTHS } from './season';
import type { ClimateContext, Evidence, FarmProfile, RotationPlan, SourceKind } from '@/contracts/farmwise';
import './DashboardPage.css';

const PLAN_LABEL: Record<RotationPlan['id'], string> = {
  current: 'Current practice',
  minimum: 'Minimum change',
  resilience: 'Resilience plan',
};

const IRRIGATION_LABEL: Record<FarmProfile['irrigation'], string> = {
  rainfed: 'Rainfed',
  limited: 'Limited irrigation',
  regular: 'Regular irrigation',
};

export default function DashboardPage() {
  const { state } = useFarmWise();
  const navigate = useNavigate();
  const [whyPlan, setWhyPlan] = useState<RotationPlan | null>(null);
  const [loadedAt] = useState(() => new Date());
  const reducedMotion = useReducedMotion();

  const { farm, soilPreset, activePlanId } = state;

  // One evaluation, shared with Rotation Planner and Scenario Studio: same farm, climate and soil in, same plans out.
  const { climate, soil: soilReading, evaluation, climateStatus } = useMoenData();
  const plans: RotationPlan[] = useMemo(() => evaluation?.plans ?? [], [evaluation]);
  const hasClimateValues = climate?.annualRainfallMm != null;
  const monthly = useMemo(
    () => (hasClimateValues ? snapshotClimate.climatology.map(c => ({ month: MONTHS[c.month - 1] ?? c.monthName.slice(0, 3), rain: c.meanRainMm == null ? null : Math.round(c.meanRainMm) })) : []),
    [hasClimateValues],
  );

  if (!farm) return null; // Router redirects to onboarding

  const activePlan = plans.find(p => p.id === activePlanId) ?? plans[0] ?? null;
  const bestPlan = plans.find(p => p.id === evaluation?.recommendedId) ?? null;
  const season = currentSeason(farm, loadedAt);
  const evidenceById = new Map<string, Evidence>([
    ...(climate?.evidence ?? []).map(e => [e.id, e] as [string, Evidence]),
    ...((activePlan as { evidence?: Evidence[] } | null)?.evidence ?? []).map(e => [e.id, e] as [string, Evidence]),
  ]);
  const soilSource: SourceKind = soilReading?.source ?? 'SIMULATED_IOT';
  const soilIsSimulated = soilSource === 'SIMULATED_IOT';

  return (
    <div className="dashboard">
      {/* 1 ── Farm identity ───────────────────────────────── */}
      <header className="dash-header">
        <div className="dash-header__text">
          <span className="fw-eyebrow">Farm overview</span>
          <h1 className="fw-page-title">{farm.name}</h1>
          <ul className="dash-meta" aria-label="Farm details">
            <MetaItem icon={MapPin}>{formatLocation(farm)}</MetaItem>
            {farm.areaHa != null && <MetaItem icon={Ruler}>{farm.areaHa} ha</MetaItem>}
            <MetaItem icon={Droplets}>{IRRIGATION_LABEL[farm.irrigation]}</MetaItem>
            <MetaItem icon={CalendarDays}>{season}</MetaItem>
          </ul>
        </div>
        <Button variant="secondary" icon={<Icon icon={Pencil} size="sm" />} onClick={() => navigate('/farm')}>
          Edit farm
        </Button>
      </header>

      <div className="dash-provenance" aria-label="Data sources">
        <span className="dash-provenance__item">
          <SourceBadge source="NASA_OFFLINE_SNAPSHOT" />
          <span>NASA POWER monthly, {powerManifest.period.start}–{powerManifest.period.end}, retrieved {powerManifest.retrievedAt.slice(0, 10)}</span>
        </span>
        <span className="dash-provenance__item">
          <SourceBadge source={soilSource} />
          <span>{soilIsSimulated ? 'Soil sensors are simulated' : 'Soil values entered by the farmer'}</span>
        </span>
        <span className="dash-provenance__item">
          <span>Last loaded {formatDateTime(loadedAt)}</span>
        </span>
        <Popover label="About the data" icon={Info} title="What the labels mean" align="end">
          <dl className="source-legend">
            {(['NASA_OFFLINE_SNAPSHOT', 'SIMULATED_IOT', 'FARMER_REPORTED', 'MODEL_ESTIMATE'] as SourceKind[]).map(s => (
              <div key={s} className="source-legend__row">
                <dt><SourceBadge source={s} /></dt>
                <dd>{sourceDescription(s).description}</dd>
              </div>
            ))}
          </dl>
        </Popover>
      </div>

      {/* 2 ── Recommendation ──────────────────────────────── */}
      {activePlan ? (
        <Recommendation
          active={activePlan}
          best={bestPlan}
          onReview={() => navigate('/rotation')}
          onScenario={() => navigate('/scenarios')}
          onWhy={plan => setWhyPlan(plan)}
        />
      ) : (
        <Card>
          <EmptyState
            title="No rotation plans yet"
            description="Add your current crop seasons so FarmWise can compare rotation options."
            action={<Button onClick={() => navigate('/farm')}>Add crop seasons</Button>}
          />
        </Card>
      )}

      {/* 3 ── Key indicators ──────────────────────────────── */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">Key indicators</h2>
        <div className="dash-kpis">
          <Card className="dash-kpi">
            <div className="dash-kpi__top">
              <Stat label="Selected plan score" value={activePlan?.score} unit="/ 100" size="lg" />
              <span className="dash-kpi__icon" aria-hidden="true"><Icon icon={Gauge} /></span>
            </div>
            <div className="dash-kpi__footer">
              <SourceBadge source="MODEL_ESTIMATE" />
              {activePlan && (
                <Button variant="ghost" size="sm" onClick={() => setWhyPlan(activePlan)}>Why this score?</Button>
              )}
            </div>
          </Card>
          <Card className="dash-kpi">
            <div className="dash-kpi__top">
              <Stat label="Confidence" value={activePlan ? capitalise(activePlan.confidence) : null} size="lg" />
              <span className="dash-kpi__icon" aria-hidden="true"><Icon icon={ShieldCheck} /></span>
            </div>
            <div className="dash-kpi__footer">
              <span className="fw-meta">Reflects how complete the inputs are, not the chance of success.</span>
            </div>
          </Card>
          <Card className="dash-kpi">
            <div className="dash-kpi__top">
              <Stat label="Mean annual rainfall" value={climate?.annualRainfallMm} unit="mm / yr" size="lg" />
              <span className="dash-kpi__icon" aria-hidden="true"><Icon icon={CloudRain} /></span>
            </div>
            <div className="dash-kpi__footer">
              <SourceBadge source="NASA_OFFLINE_SNAPSHOT" />
              <span className="fw-meta">{climate?.observedPeriod ?? 'Period unknown'} history</span>
            </div>
          </Card>
          <Card className="dash-kpi">
            <div className="dash-kpi__top">
              <Stat label="Soil moisture" value={soilReading?.moisturePct} unit="%" size="lg" />
              <span className="dash-kpi__icon" aria-hidden="true"><Icon icon={Droplets} /></span>
            </div>
            <div className="dash-kpi__footer">
              <SourceBadge source={soilSource} />
              <span className="fw-meta">{soilIsSimulated ? `${capitalise(soilPreset)} preset` : 'Farmer soil test'}</span>
            </div>
          </Card>
        </div>
      </section>

      {/* 4 ── Selected rotation ───────────────────────────── */}
      {activePlan && (
        <Card className="dash-rotation" aria-labelledby="rotation-heading">
          <CardHeader
            id="rotation-heading"
            as="h2"
            icon={RefreshCcw}
            title="Selected rotation"
            subtitle={`${PLAN_LABEL[activePlan.id]} · ${activePlan.seasons.length} seasons`}
            actions={<ConfidenceBadge level={activePlan.confidence} />}
          />
          {!activePlan.feasible && (
            <div className="dash-alert" role="note">
              <Icon icon={TriangleAlert} size="sm" />
              <span>This plan may not be feasible with your current inputs. {activePlan.constraints[0]}</span>
            </div>
          )}
          <ol className="dash-timeline" aria-label="Crop sequence by season">
            {activePlan.seasons.map((s, i) => (
              <li key={i} className="dash-timeline__step">
                <span className="dash-timeline__index" aria-hidden="true">{i + 1}</span>
                <span className="dash-timeline__crop">{cropLabel(s.cropId)}</span>
                <span className="dash-timeline__season">{seasonLabel(s.season)}</span>
                <span className="dash-timeline__year">Year {s.yearOffset + 1}</span>
              </li>
            ))}
          </ol>
          <div className="dash-card-actions">
            <Button variant="secondary" icon={<Icon icon={ArrowRight} size="sm" />} iconPosition="right" onClick={() => navigate('/rotation')}>
              Compare all plans
            </Button>
            <Button variant="ghost" onClick={() => navigate('/scenarios')}>Explore a scenario</Button>
          </div>
        </Card>
      )}

      {/* 5 ── Observations ────────────────────────────────── */}
      <div className="dash-observations">
        <Card className="dash-climate">
          <CardHeader
            as="h2"
            icon={CloudRain}
            title="Climate history"
            subtitle={`${powerManifest.farmName} grid point · regional, not field-level`}
            actions={<SourceBadge source="NASA_OFFLINE_SNAPSHOT" />}
          />
          {climate && hasClimateValues ? (
            <>
              <div className="dash-stat-grid">
                <Stat label="Mean temperature" value={climate.meanTemperatureC} unit="°C" caption="Air at 2 m" />
                <Stat label="Wettest month" value={evidenceById.get('nasa-power-wettest-month')?.value} caption="Ten-year average" />
                <Stat label="Driest month" value={evidenceById.get('nasa-power-driest-month')?.value} caption="Ten-year average" />
              </div>
              <ChartFrame
                title="Average monthly rainfall (mm)"
                source={`NASA POWER PRECTOTCORR · ${climate.observedPeriod} mean`}
                summary={rainSummary(monthly)}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis width={40} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--color-hover)' }}
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-primary)' }}
                      formatter={(v) => [`${v} mm`, 'Mean rainfall']}
                    />
                    <Bar dataKey="rain" name="Mean rainfall" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </>
          ) : (
            <EmptyState
              title={climateStatus === 'loading' ? 'Loading climate history' : 'No NASA snapshot for this location'}
              description={climate?.evidence[0]?.note ?? 'Set the farm location on My Farm to see the nearest NASA POWER snapshot. Plans are not scored with another region\'s climate.'}
              action={<Button variant="secondary" onClick={() => navigate('/farm')}>Set location</Button>}
            />
          )}
          <div className="dash-card-actions">
            <Button variant="ghost" icon={<Icon icon={Database} size="sm" />} onClick={() => navigate('/evidence')}>
              View sources and limitations
            </Button>
          </div>
        </Card>

        <Card className="dash-soil">
          <CardHeader
            as="h2"
            icon={Sprout}
            title="Soil readings"
            subtitle={soilIsSimulated ? `${capitalise(soilPreset)} preset · ${formatDate(soilReading?.timestamp)}` : `Farmer soil test · ${formatDate(soilReading?.timestamp)}`}
            actions={<SourceBadge source={soilSource} />}
          />
          <div className="dash-stat-grid dash-stat-grid--soil">
            {(['ph', 'moisturePct', 'n', 'p', 'k'] as const).map(key => {
              const meta = SOIL_FIELDS[key];
              return (
                <Stat
                  key={key}
                  label={meta.label}
                  value={soilReading?.[key]}
                  unit={meta.unit || undefined}
                />
              );
            })}
          </div>
          <p className="fw-meta dash-note">
            {soilIsSimulated
              ? 'No real sensors are connected: these readings are simulated presets. Lab soil tests entered by the farmer are labelled separately.'
              : 'These values were entered by the farmer from a soil test. Simulated sensor presets are not used while a soil test is on file.'}
          </p>
          <div className="dash-card-actions">
            <Button variant="ghost" icon={<Icon icon={ArrowRight} size="sm" />} iconPosition="right" onClick={() => navigate('/farm', { state: { tab: 'soil' } })}>
              Change soil preset
            </Button>
          </div>
        </Card>
      </div>

      {/* 6 ── Secondary actions ───────────────────────────── */}
      <section aria-labelledby="explore-heading" className="dash-explore">
        <h2 id="explore-heading" className="fw-section-title">More tools</h2>
        <div className="dash-explore__grid">
          <ActionRow icon={ChartNoAxesCombined} title="Scenario Studio" desc="Test a drier, hotter or costlier year" onClick={() => navigate('/scenarios')} />
          <ActionRow icon={ScanSearch} title="Plant Check" desc="Review sample plant photos and symptoms" onClick={() => navigate('/plant')} />
          <ActionRow icon={MapPin} title="My Farm" desc="Update location, crops and priorities" onClick={() => navigate('/farm')} />
          <ActionRow icon={MessagesSquare} title="Ask FarmWise" desc="Plain-language answers about your plan" onClick={() => document.dispatchEvent(new CustomEvent('fw:open-assistant'))} />
        </div>
      </section>

      {whyPlan && (
        <WhyScoreDialog plan={whyPlan} evidence={evidenceById} climate={climate} onClose={() => setWhyPlan(null)} />
      )}
    </div>
  );
}

/* ── Recommendation ─────────────────────────────────────── */

function Recommendation({ active, best, onReview, onScenario, onWhy }: {
  active: RotationPlan;
  best: RotationPlan | null;
  onReview: () => void;
  onScenario: () => void;
  onWhy: (plan: RotationPlan) => void;
}) {
  const better = best && best.id !== active.id && (best.score ?? 0) > (active.score ?? 0) ? best : null;
  const focus = better ?? active;

  const headline = !active.feasible && !better
    ? 'Review your plan before the next season'
    : better
      ? `Consider the ${PLAN_LABEL[better.id].toLowerCase()}`
      : `Your ${PLAN_LABEL[active.id].toLowerCase()} scores highest`;

  const body = better
    ? `It scores ${better.score}/100, compared with ${active.score}/100 for your selected plan. ${sentence(better.benefits[0])}`
    : `Next, check how it holds up in a drier or costlier year. ${sentence(active.benefits[0])}`;

  return (
    <Card className="dash-reco" aria-labelledby="reco-heading">
      <div className="dash-reco__main">
        <span className="dash-reco__eyebrow">
          <Icon icon={Lightbulb} size="sm" />
          Recommended next step
        </span>
        <h2 id="reco-heading" className="dash-reco__title">{headline}</h2>
        <p className="dash-reco__body">{body}</p>
        <div className="dash-reco__actions">
          {better ? (
            <>
              <Button icon={<Icon icon={ArrowRight} size="sm" />} iconPosition="right" onClick={onReview}>Compare all plans</Button>
              <Button variant="secondary" onClick={() => onWhy(better)}>Why this plan?</Button>
            </>
          ) : (
            <>
              <Button icon={<Icon icon={ArrowRight} size="sm" />} iconPosition="right" onClick={onScenario}>Explore a scenario</Button>
              <Button variant="secondary" onClick={onReview}>Compare all plans</Button>
            </>
          )}
        </div>
        <p className="dash-reco__note">
          <SourceBadge source="MODEL_ESTIMATE" />
          <span>Based on your priorities, NASA climate history and simulated soil readings. Check with a local extension officer before changing what you plant.</span>
        </p>
      </div>
      <dl className="dash-reco__compare" aria-label="Plan scores">
        <ScoreRow label="Your selected plan" sub={PLAN_LABEL[active.id]} score={active.score} highlight={!better} />
        {better && <ScoreRow label="Suggested plan" sub={PLAN_LABEL[focus.id]} score={focus.score} highlight />}
      </dl>
    </Card>
  );
}

function ScoreRow({ label, sub, score, highlight }: { label: string; sub: string; score: number | null; highlight?: boolean }) {
  return (
    <div className={`dash-score ${highlight ? 'dash-score--highlight' : ''}`}>
      <dt>
        <span className="dash-score__label">{label}</span>
        <span className="dash-score__sub">{sub}</span>
      </dt>
      <dd className="dash-score__value">
        {score ?? 'Unknown'}
        {score != null && <span className="dash-score__unit">/100</span>}
      </dd>
      <div className="dash-score__bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
      </div>
    </div>
  );
}

/* ── Why-score dialog: readable evidence, not IDs ───────── */

function WhyScoreDialog({ plan, evidence, climate, onClose }: {
  plan: RotationPlan;
  evidence: Map<string, Evidence>;
  climate: ClimateContext | null;
  onClose: () => void;
}) {
  const items = plan.evidenceIds.map(id => evidence.get(id)).filter((e): e is Evidence => Boolean(e));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${PLAN_LABEL[plan.id]}: ${plan.score ?? 'Unknown'}/100`}
      description="How FarmWise arrived at this score"
      size="lg"
      actions={<Button onClick={onClose}>Done</Button>}
    >
      <div className="why">
        <div className="why__intro">
          <SourceBadge source="MODEL_ESTIMATE" />
          <ConfidenceBadge level={plan.confidence} />
          <InfoTip
            label="About the score"
            content="The score (0–100) rates fit with your priorities, water needs, soil impact and crop diversity. It is not a certified agronomic rating."
          />
        </div>

        <div className="why__columns">
          <WhyList title="Benefits" tone="positive" items={plan.benefits} />
          <WhyList title="Risks" tone="warning" items={plan.risks} />
        </div>
        {plan.constraints.length > 0 && <WhyList title="Constraints" tone="error" items={plan.constraints} />}

        <section className="why__section">
          <h3 className="why__heading">Evidence used</h3>
          {items.length === 0 ? (
            <p className="fw-meta">No linked evidence for this plan.</p>
          ) : (
            <ul className="why__evidence">
              {items.map(e => (
                <li key={e.id} className="why__evidence-item">
                  <div className="why__evidence-main">
                    <span className="why__evidence-title">{e.title}</span>
                    <span className="why__evidence-meta">
                      {e.period}{e.spatialScale ? ` · ${e.spatialScale}` : ''}
                    </span>
                  </div>
                  <span className="why__evidence-value">
                    {e.value ?? 'Unknown'}{e.value != null && e.unit ? ` ${e.unit}` : ''}
                  </span>
                  <SourceBadge source={e.source} />
                  {e.url && (
                    <a className="why__link" href={e.url} target="_blank" rel="noopener noreferrer">
                      Source <Icon icon={ExternalLink} size="sm" />
                      <span className="sr-only">(opens NASA POWER request in a new tab)</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {climate?.snapshot && (
            <p className="fw-meta why__footnote">Values come from an offline NASA POWER snapshot. They describe past conditions, not a forecast.</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function WhyList({ title, items, tone }: { title: string; items: string[]; tone: 'positive' | 'warning' | 'error' }) {
  if (items.length === 0) return null;
  return (
    <section className="why__section">
      <h3 className="why__heading">{title}</h3>
      <ul className={`why__list why__list--${tone}`}>
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </section>
  );
}

/* ── Small pieces ───────────────────────────────────────── */

function MetaItem({ icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="dash-meta__item">
      <Icon icon={icon} size="sm" />
      <span>{children}</span>
    </li>
  );
}

function ActionRow({ icon, title, desc, onClick }: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" className="dash-action" onClick={onClick}>
      <span className="dash-action__icon" aria-hidden="true"><Icon icon={icon} /></span>
      <span className="dash-action__text">
        <span className="dash-action__title">{title}</span>
        <span className="dash-action__desc">{desc}</span>
      </span>
      <Icon icon={ChevronRight} size="sm" className="dash-action__chevron" />
    </button>
  );
}

/* ── Formatting helpers ─────────────────────────────────── */

function formatLocation(farm: FarmProfile): string {
  return formatLatLon(farm.lat, farm.lon);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function formatDate(iso?: string): string {
  if (!iso) return 'date unknown';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'date unknown' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

const SOIL_FIELDS = {
  ph: { label: 'Soil pH', unit: '' },
  moisturePct: { label: 'Soil moisture', unit: '%' },
  n: { label: 'Nitrogen', unit: 'mg/kg' },
  p: { label: 'Phosphorus', unit: 'mg/kg' },
  k: { label: 'Potassium', unit: 'mg/kg' },
} as const;

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sentence(s?: string): string {
  if (!s) return '';
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function rainSummary(monthly: { month: string; rain: number | null }[]): string {
  const known = monthly.filter(m => m.rain != null) as { month: string; rain: number }[];
  if (known.length === 0) return 'Monthly rainfall data unavailable.';
  const sorted = [...known].sort((a, b) => b.rain - a.rain);
  const first = sorted[0]!;
  const second = sorted[1] ?? first;
  const last = sorted[sorted.length - 1]!;
  return `Wettest months on average: ${first.month} (${first.rain} mm) and ${second.month} (${second.rain} mm). Driest: ${last.month} (${last.rain} mm). Ten-year means, not a forecast.`;
}

export { DashboardPage };
