/**
 * Onboarding Page — Genemor
 * First-run farmer intake: sample farm or manual setup.
 * Supports voice input with text fallback.
 */
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarmWise } from '@/core/store';
import { SAMPLE_FARM } from '@/core/sampleFarm';
import { SEASON_OPTIONS, CROP_OPTIONS } from '@/core/seasons';
import {
  Button, Card, TextField, TextArea, Select, Badge, SectionHeader, Icon, IconButton,
} from '@/ui/components';
import {
  Wheat, Globe, Pencil, MapPin, Mic, Square, X, Plus, Droplets, Wallet, Sprout, CircleCheck, ArrowRight, ArrowLeft,
} from 'lucide-react';
import type { FarmProfile, CropSeason } from '@/contracts/farmwise';
import './OnboardingPage.css';

type Step = 'welcome' | 'location' | 'crops' | 'priorities' | 'complete';

// Shaheem label pass: display labels only; the same strings are used by the form options above.
const IRRIGATION_LABEL: Record<string, string> = {
  rainfed: 'Rainfed only',
  limited: 'Limited irrigation (seasonal)',
  regular: 'Regular irrigation',
};
const PRIORITY_LABEL: Record<string, string> = {
  water: 'Water efficiency',
  cost: 'Lower costs',
  soil: 'Soil health',
};

function generateId() {
  return `farm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { setFarm, state } = useFarmWise();
  const isRevisit = state.farm !== null;

  const [step, setStep] = useState<Step>('welcome');
  const [profile, setProfile] = useState<Partial<FarmProfile>>({
    id: generateId(),
    name: '',
    lat: null,
    lon: null,
    areaHa: null,
    irrigation: 'rainfed',
    rotation: [],
    priorities: ['water'],
    budget: null,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'unsupported' | 'denied'>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<unknown>(null);

  // ---- Sample farm path ----
  const handleSampleFarm = useCallback(() => {
    setFarm(SAMPLE_FARM);
    navigate('/');
  }, [setFarm, navigate]);

  // ---- Field updaters ----
  const setField = useCallback(<K extends keyof FarmProfile>(key: K, value: FarmProfile[K]) => {
    setProfile(p => ({ ...p, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key as string]; return n; });
  }, []);

  // ---- Voice input ----
  const startVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) { setVoiceStatus('unsupported'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SRClass();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setVoiceStatus('listening');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ');
      setTranscript(text);
      setVoiceStatus('idle');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      setVoiceStatus(e.error === 'not-allowed' ? 'denied' : 'idle');
    };
    recognition.onend = () => setVoiceStatus('idle');
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    setVoiceStatus('idle');
  }, []);

  const applyTranscript = useCallback(() => {
    if (!transcript) return;
    setField('notes', (profile.notes ? profile.notes + '\n' : '') + transcript);
    setTranscript('');
  }, [transcript, profile.notes, setField]);

  // ---- Crop rotation management ----
  const addCrop = useCallback(() => {
    setField('rotation', [
      ...(profile.rotation ?? []),
      { season: SEASON_OPTIONS[(profile.rotation?.length ?? 0) % 2]!.value, cropId: 'maize', yearOffset: (profile.rotation?.length ?? 0) > 1 ? 1 : 0 },
    ]);
  }, [profile.rotation, setField]);

  const updateCrop = useCallback((idx: number, field: keyof CropSeason, value: string | number) => {
    const updated = (profile.rotation ?? []).map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    );
    setField('rotation', updated);
  }, [profile.rotation, setField]);

  const removeCrop = useCallback((idx: number) => {
    setField('rotation', (profile.rotation ?? []).filter((_, i) => i !== idx));
  }, [profile.rotation, setField]);

  // ---- Validation ----
  const validateStep = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (step === 'location') {
      if (!profile.name?.trim()) errs.name = 'Farm name is required';
      if (profile.lat !== null && (isNaN(Number(profile.lat)) || Number(profile.lat) < -90 || Number(profile.lat) > 90))
        errs.lat = 'Latitude must be between -90 and 90';
      if (profile.lon !== null && (isNaN(Number(profile.lon)) || Number(profile.lon) < -180 || Number(profile.lon) > 180))
        errs.lon = 'Longitude must be between -180 and 180';
    }
    if (step === 'crops' && (profile.rotation?.length ?? 0) === 0) {
      errs.rotation = 'Add at least one crop season';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, profile]);

  const nextStep = useCallback(() => {
    if (!validateStep()) return;
    const steps: Step[] = ['welcome', 'location', 'crops', 'priorities', 'complete'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1] as Step);
  }, [step, validateStep]);

  const prevStep = useCallback(() => {
    const steps: Step[] = ['welcome', 'location', 'crops', 'priorities', 'complete'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1] as Step);
  }, [step]);

  const handleSave = useCallback(() => {
    if (!profile.name?.trim()) { setErrors({ name: 'Farm name required' }); return; }
    const farm: FarmProfile = {
      id: profile.id ?? generateId(),
      name: profile.name,
      lat: profile.lat ?? null,
      lon: profile.lon ?? null,
      areaHa: profile.areaHa ?? null,
      irrigation: profile.irrigation ?? 'rainfed',
      rotation: profile.rotation ?? [],
      priorities: profile.priorities ?? ['water'],
      budget: profile.budget ?? null,
      notes: profile.notes ?? '',
    };
    setFarm(farm);
    navigate('/');
  }, [profile, setFarm, navigate]);

  // ---- Render steps ----
  return (
    <div className="onboarding">
      {/* Progress */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="onboarding__progress">
          {['location', 'crops', 'priorities'].map((s, i) => (
            <div key={s} className={`onboarding__step-dot ${step === s ? 'active' : (i < ['location','crops','priorities'].indexOf(step) ? 'done' : '')}`} />
          ))}
        </div>
      )}

      {/* Welcome */}
      {step === 'welcome' && (
        <div className="onboarding__welcome">
          <div className="onboarding__hero">
            <span className="onboarding__hero-icon" aria-hidden="true"><Wheat size={28} strokeWidth={1.75} /></span>
            <h1 className="onboarding__hero-title">Welcome to FarmWise</h1>
            <p className="onboarding__hero-sub">
              A crop-rotation decision companion powered by NASA climate data and your farming knowledge.
              Get three tailored rotation plans with evidence-backed recommendations.
            </p>
          </div>

          {isRevisit && (
            <div className="onboarding__revisit-notice">
              <Badge variant="info">Farm already set up</Badge>
              <span>You're revisiting onboarding. Your current farm data is safe.</span>
            </div>
          )}

          <div className="onboarding__welcome-actions">
            <Button variant="primary" size="lg" onClick={handleSampleFarm} icon={<Icon icon={Globe} />} iconPosition="left">
              Try Sample Farm
            </Button>
            <Button variant="secondary" size="lg" onClick={nextStep} icon={<Icon icon={Pencil} />} iconPosition="left">
              Set Up My Farm
            </Button>
          </div>

          <div className="onboarding__welcome-note">
            <Icon icon={MapPin} size="sm" />
            <span>Sample farm: Nakuru Valley, Kenya. It uses real NASA POWER climate history.</span>
          </div>
        </div>
      )}

      {/* Location step */}
      {step === 'location' && (
        <Card className="onboarding__card">
          <SectionHeader title="Farm Location & Details" subtitle="Tell us about your farm" />

          <div className="onboarding__fields">
            <TextField
              label="Farm Name"
              value={profile.name ?? ''}
              onChange={e => setField('name', e.target.value)}
              error={errors.name}
              placeholder="e.g. Nakuru Valley Farm"
            />

            <div className="onboarding__coord-row">
              <TextField
                label="Latitude (optional)"
                type="number"
                step="0.001"
                value={profile.lat ?? ''}
                onChange={e => setField('lat', e.target.value ? Number(e.target.value) : null)}
                error={errors.lat}
                placeholder="-0.3"
                hint="Decimal degrees, e.g. -0.3"
              />
              <TextField
                label="Longitude (optional)"
                type="number"
                step="0.001"
                value={profile.lon ?? ''}
                onChange={e => setField('lon', e.target.value ? Number(e.target.value) : null)}
                error={errors.lon}
                placeholder="36.1"
                hint="Decimal degrees, e.g. 36.1"
              />
            </div>

            <TextField
              label="Farm Area (hectares, optional)"
              type="number"
              step="0.1"
              value={profile.areaHa ?? ''}
              onChange={e => setField('areaHa', e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 4.5"
            />

            <Select
              label="Irrigation"
              value={profile.irrigation ?? 'rainfed'}
              onChange={e => setField('irrigation', e.target.value as FarmProfile['irrigation'])}
              options={[
                { value: 'rainfed', label: 'Rainfed only' },
                { value: 'limited', label: 'Limited irrigation (seasonal)' },
                { value: 'regular', label: 'Regular irrigation' },
              ]}
            />

            {/* Voice input for notes */}
            <div className="onboarding__notes-section">
              <div className="onboarding__notes-header">
                <span className="fw-field__label">Farming Notes (optional)</span>
                <div className="onboarding__voice-controls">
                  {voiceStatus === 'unsupported' && <Badge variant="warning">Voice not supported</Badge>}
                  {voiceStatus === 'denied' && <Badge variant="error">Microphone denied — use text below</Badge>}
                  {voiceStatus !== 'unsupported' && voiceStatus !== 'denied' && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={voiceStatus === 'listening' ? stopVoice : startVoice}
                      aria-label={voiceStatus === 'listening' ? 'Stop recording' : 'Start voice recording'}
                    >
                      <Icon icon={voiceStatus === 'listening' ? Square : Mic} size="sm" />
                      {voiceStatus === 'listening' ? 'Stop' : 'Voice input'}
                    </Button>
                  )}
                </div>
              </div>

              {voiceStatus === 'listening' && (
                <div className="onboarding__listening-indicator" role="status" aria-live="polite">
                  <span className="pulse-dot" aria-hidden="true" /> Listening…
                </div>
              )}

              {transcript && (
                <div className="onboarding__transcript">
                  <div className="onboarding__transcript-label">Transcript (review before applying):</div>
                  <p className="onboarding__transcript-text">{transcript}</p>
                  <div className="onboarding__transcript-actions">
                    <Button variant="secondary" size="sm" onClick={applyTranscript}>Apply to Notes</Button>
                    <Button variant="ghost" size="sm" onClick={() => setTranscript('')}>Discard</Button>
                  </div>
                </div>
              )}

              <TextArea
                label=""
                value={profile.notes ?? ''}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Describe your farming experience, soil conditions, local challenges…"
                rows={4}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Crops step */}
      {step === 'crops' && (
        <Card className="onboarding__card">
          <SectionHeader title="Current Crop Rotation" subtitle="Add your existing crop seasons" />

          {errors.rotation && <div className="fw-field__error mb-4" role="alert">{errors.rotation}</div>}

          <div className="onboarding__crops-list">
            {(profile.rotation ?? []).map((crop, idx) => (
              <div key={idx} className="onboarding__crop-row">
                <span className="onboarding__crop-num">{idx + 1}</span>
                <Select
                  label="Season"
                  value={crop.season}
                  onChange={e => updateCrop(idx, 'season', e.target.value)}
                  options={SEASON_OPTIONS}
                  className="onboarding__crop-select"
                />
                <Select
                  label="Crop"
                  value={crop.cropId}
                  onChange={e => updateCrop(idx, 'cropId', e.target.value)}
                  options={CROP_OPTIONS}
                  className="onboarding__crop-select"
                />
                <Select
                  label="Year"
                  value={String(crop.yearOffset)}
                  onChange={e => updateCrop(idx, 'yearOffset', Number(e.target.value))}
                  options={[{ value: '0', label: 'Year 1' }, { value: '1', label: 'Year 2' }]}
                  className="onboarding__crop-select-sm"
                />
                <IconButton label={`Remove season ${idx + 1}`} onClick={() => removeCrop(idx)}><Icon icon={X} /></IconButton>
              </div>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={addCrop} className="mt-4" icon={<Icon icon={Plus} size="sm" />} iconPosition="left">
            Add Season
          </Button>
        </Card>
      )}

      {/* Priorities step */}
      {step === 'priorities' && (
        <Card className="onboarding__card">
          <SectionHeader title="Your Priorities" subtitle="Help us tailor recommendations" />

          <div className="onboarding__priorities">
            {(['water', 'cost', 'soil'] as const).map(p => (
              <label key={p} className={`onboarding__priority-option ${(profile.priorities ?? []).includes(p) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={(profile.priorities ?? []).includes(p)}
                  onChange={e => {
                    const current = profile.priorities ?? [];
                    if (e.target.checked) setField('priorities', [...current, p]);
                    else setField('priorities', current.filter(x => x !== p));
                  }}
                />
                <span className="onboarding__priority-icon">
                  <Icon icon={p === 'water' ? Droplets : p === 'cost' ? Wallet : Sprout} />
                </span>
                <span className="onboarding__priority-label">
                  {p === 'water' ? 'Water efficiency' : p === 'cost' ? 'Lower costs' : 'Soil health'}
                </span>
              </label>
            ))}
          </div>

          <TextField
            label="Seasonal input budget (KES, optional)"
            type="number"
            value={profile.budget ?? ''}
            onChange={e => setField('budget', e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 120000"
            hint="Used for feasibility checks only. Keep blank if unknown."
            className="mt-6"
          />
        </Card>
      )}

      {/* Complete */}
      {step === 'complete' && (
        <div className="onboarding__complete">
          <span className="onboarding__complete-icon" aria-hidden="true"><CircleCheck size={28} strokeWidth={1.75} /></span>
          <h2>Your farm is ready!</h2>
          <p>FarmWise will analyze your data and generate three rotation plans.</p>
          <div className="onboarding__complete-summary">
            <div><span>Farm</span><strong>{profile.name}</strong></div>
            {profile.lat && <div><span>Location</span><strong>{profile.lat}°, {profile.lon}°</strong></div>}
            {/* Shaheem label pass: readable labels instead of raw stored values. */}
            <div><span>Irrigation</span><strong>{IRRIGATION_LABEL[profile.irrigation ?? 'rainfed'] ?? profile.irrigation}</strong></div>
            <div><span>Seasons</span><strong>{profile.rotation?.length ?? 0} {(profile.rotation?.length ?? 0) === 1 ? 'season' : 'seasons'}</strong></div>
            <div><span>Priorities</span><strong>{(profile.priorities ?? []).map(p => PRIORITY_LABEL[p] ?? p).join(', ') || 'None'}</strong></div>
          </div>
          <Button variant="primary" size="lg" onClick={handleSave} icon={<Icon icon={ArrowRight} />} iconPosition="right">Go to Dashboard</Button>
        </div>
      )}

      {/* Navigation */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="onboarding__nav">
          <Button variant="ghost" onClick={prevStep} icon={<Icon icon={ArrowLeft} size="sm" />}>Back</Button>
          <Button variant="primary" onClick={step === 'priorities' ? nextStep : nextStep} icon={<Icon icon={ArrowRight} size="sm" />} iconPosition="right">
            {step === 'priorities' ? 'Review' : 'Continue'}
          </Button>
        </div>
      )}
    </div>
  );
}
