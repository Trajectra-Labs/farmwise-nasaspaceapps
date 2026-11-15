/**
 * My Farm: farm details (edit, save, reset), Soil & Sensors and the location map.
 *
 * Farm details and rotation editing are written here; the map is Ted's FarmMapPicker and the
 * soil tab is Abdullah's SoilSensorsPanel, both wired to the shared FarmWise store so a change
 * on this page updates the Dashboard, Rotation Planner, Scenario Studio and the assistant.
 */
import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Droplets, Wallet, Sprout, MapPin, Map as MapIcon, Plus, X } from 'lucide-react';
import { Tabs, TabPanel, SectionHeader, EmptyState, Button, IconButton, TextField, TextArea, Select, Badge, Dialog, Icon } from '@/ui/components';
import { showToast } from '@/ui/toast';
import { useFarmWise } from '@/core/store';
import { SEASON_OPTIONS, CROP_OPTIONS, seasonLabel } from '@/core/seasons';
import { useMoenData } from '@/features/rotation/moenStore';
import { FarmMapPicker, type LatLon } from './FarmMapPicker';
import { SoilSensorsPanel } from '@/features/soil';
import { formatLatLon } from '@/ui/format';
import type { FarmProfile, CropSeason, SoilInput } from '@/contracts/farmwise';
import './FarmPage.css';

const FARM_TABS = [
  { id: 'details', label: 'Farm Details' },
  { id: 'soil',    label: 'Soil & Sensors' },
  { id: 'map',     label: 'Map' },
];

export default function FarmPage() {
  // Shaheem integration: other pages deep-link to a tab with navigate('/farm', { state: { tab } }).
  const location = useLocation();
  const requestedTab = (location.state as { tab?: string } | null)?.tab;
  const [activeTab, setActiveTab] = useState(
    requestedTab && FARM_TABS.some(t => t.id === requestedTab) ? requestedTab : 'details',
  );
  const { state } = useFarmWise();
  const { farm } = state;

  if (!farm) return <EmptyState title="No farm data" description="Set up your farm in onboarding." />;

  return (
    <div className="farm-page">
      <SectionHeader title="My Farm" subtitle={farm.name} />
      <Tabs tabs={FARM_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <TabPanel id="details" activeTab={activeTab}>
        <FarmDetailsPanel farm={farm} />
      </TabPanel>

      <TabPanel id="soil" activeTab={activeTab}>
        <SoilTab />
      </TabPanel>

      <TabPanel id="map" activeTab={activeTab}>
        <FarmMapPanel farm={farm} />
      </TabPanel>
    </div>
  );
}

// ─── Farm Details ─────────────────────────────────────────────────────────────

function FarmDetailsPanel({ farm }: { farm: FarmProfile }) {
  const { setFarm } = useFarmWise();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FarmProfile>(farm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [unsavedWarning, setUnsavedWarning] = useState(false);

  const setField = useCallback(<K extends keyof FarmProfile>(key: K, value: FarmProfile[K]) => {
    setDraft(d => ({ ...d, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key as string]; return n; });
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!draft.name.trim()) errs.name = 'Farm name is required';
    if (draft.lat != null && (isNaN(Number(draft.lat)) || Number(draft.lat) < -90 || Number(draft.lat) > 90))
      errs.lat = 'Latitude must be –90 to 90';
    if (draft.lon != null && (isNaN(Number(draft.lon)) || Number(draft.lon) < -180 || Number(draft.lon) > 180))
      errs.lon = 'Longitude must be –180 to 180';
    if (draft.areaHa != null && draft.areaHa <= 0) errs.areaHa = 'Area must be positive';
    if (draft.budget != null && draft.budget < 0) errs.budget = 'Budget cannot be negative';
    if (draft.rotation.length === 0) errs.rotation = 'Add at least one crop season';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setFarm(draft);
    setEditing(false);
    showToast('Farm saved. Plans and scenarios were updated.', 'success');
  };

  const handleCancel = () => {
    // If draft differs from saved, warn
    const changed = JSON.stringify(draft) !== JSON.stringify(farm);
    if (changed) { setUnsavedWarning(true); return; }
    setDraft(farm);
    setEditing(false);
  };

  const confirmCancel = () => {
    setDraft(farm);
    setEditing(false);
    setUnsavedWarning(false);
    setErrors({});
  };

  const handleResetToSample = () => setConfirmReset(true);
  const confirmReset2 = () => {
    // Reset would go to sample farm — imported inline to avoid circular dep
    import('@/core/sampleFarm').then(m => {
      setFarm(m.SAMPLE_FARM);
      setDraft(m.SAMPLE_FARM);
      setConfirmReset(false);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="farm-details-view">
        <div className="farm-details-grid">
          <Detail label="Farm Name"  value={farm.name} />
          <Detail label="Latitude"   value={farm.lat  != null ? `${farm.lat}°`  : 'Not set'} />
          <Detail label="Longitude"  value={farm.lon  != null ? `${farm.lon}°`  : 'Not set'} />
          <Detail label="Area"       value={farm.areaHa != null ? `${farm.areaHa} ha` : 'Unknown'} />
          <Detail label="Irrigation" value={{ rainfed: 'Rainfed', limited: 'Limited irrigation', regular: 'Regular irrigation' }[farm.irrigation]} />
          <Detail label="Budget"     value={farm.budget != null ? `KES ${farm.budget.toLocaleString('en-US')}` : 'Not specified'} />
          <Detail label="Priorities" value={farm.priorities.length ? farm.priorities.join(', ') : 'None selected'} />
        </div>
        <div className="farm-details-notes">
          <span className="detail-label">Crop rotation</span>
          {farm.rotation.length === 0 ? (
            <p className="detail-value">No crop seasons entered</p>
          ) : (
            <ol className="farm-rotation-list">
              {farm.rotation.map((r, i) => (
                <li key={i}>{CROP_OPTIONS.find(c => c.value === r.cropId)?.label ?? r.cropId} · {seasonLabel(r.season)} · Year {r.yearOffset + 1}</li>
              ))}
            </ol>
          )}
        </div>
        {farm.notes && (
          <div className="farm-details-notes">
            <span className="detail-label">Notes</span>
            <p className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{farm.notes}</p>
          </div>
        )}
        <div className="farm-details-actions">
          <Button variant="primary"   onClick={() => { setDraft(farm); setEditing(true); }}>Edit details</Button>
          <Button variant="ghost"     onClick={handleResetToSample}>Reset to sample farm…</Button>
        </div>

        {/* Confirm reset */}
        <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to sample farm?" size="sm"
          actions={<>
            <Button variant="ghost"  onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmReset2}>Reset</Button>
          </>}>
          <p className="text-sm">This will replace your current farm data with the Nakuru Valley sample. This cannot be undone.</p>
        </Dialog>
      </div>
    );
  }

  // ── Edit mode ──
  return (
    <div className="farm-details-edit">
      <div className="farm-details-fields">
        <TextField label="Farm Name" value={draft.name} error={errors.name}
          onChange={e => setField('name', e.target.value)} />

        <div className="farm-coord-row">
          <TextField label="Latitude" type="number" step="0.001"
            value={draft.lat ?? ''} error={errors.lat}
            onChange={e => setField('lat', e.target.value ? Number(e.target.value) : null)}
            hint="Decimal degrees" />
          <TextField label="Longitude" type="number" step="0.001"
            value={draft.lon ?? ''} error={errors.lon}
            onChange={e => setField('lon', e.target.value ? Number(e.target.value) : null)}
            hint="Decimal degrees" />
        </div>

        <TextField label="Area (ha)" type="number" step="0.1"
          value={draft.areaHa ?? ''} error={errors.areaHa}
          onChange={e => setField('areaHa', e.target.value ? Number(e.target.value) : null)} />

        <Select label="Irrigation" value={draft.irrigation}
          onChange={e => setField('irrigation', e.target.value as FarmProfile['irrigation'])}
          options={[
            { value: 'rainfed',  label: 'Rainfed only' },
            { value: 'limited',  label: 'Limited irrigation' },
            { value: 'regular',  label: 'Regular irrigation' },
          ]} />

        <TextField label="Seasonal input budget (KES)" type="number" min={0}
          value={draft.budget ?? ''} error={errors.budget}
          onChange={e => setField('budget', e.target.value ? Number(e.target.value) : null)}
          hint="Used for the budget feasibility check on each plan" />

        <RotationEditor rotation={draft.rotation} error={errors.rotation} onChange={r => setField('rotation', r)} />

        <div className="farm-priorities-edit">
          <span className="fw-field__label">Priorities</span>
          <div className="farm-priority-checks">
            {(['water', 'cost', 'soil'] as const).map(p => (
              <label key={p} className="priority-check-label">
                <input type="checkbox"
                  checked={draft.priorities.includes(p)}
                  onChange={e => setField('priorities', e.target.checked
                    ? [...draft.priorities, p]
                    : draft.priorities.filter(x => x !== p))}
                />
                <Icon icon={p === 'water' ? Droplets : p === 'cost' ? Wallet : Sprout} size="sm" />
                {p === 'water' ? 'Water efficiency' : p === 'cost' ? 'Lower costs' : 'Soil health'}
              </label>
            ))}
          </div>
        </div>

        <TextArea label="Notes" value={draft.notes} rows={4}
          onChange={e => setField('notes', e.target.value)} />
      </div>

      <div className="farm-details-edit-actions">
        <Button variant="primary"   onClick={handleSave}>Save</Button>
        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      {/* Unsaved-changes warning */}
      <Dialog open={unsavedWarning} onClose={() => setUnsavedWarning(false)}
        title="Unsaved changes" size="sm"
        actions={<>
          <Button variant="ghost"  onClick={() => setUnsavedWarning(false)}>Keep editing</Button>
          <Button variant="danger" onClick={confirmCancel}>Discard changes</Button>
        </>}>
        <p className="text-sm">You have unsaved changes. Discard them?</p>
      </Dialog>
    </div>
  );
}

// ─── Soil & Sensors (Abdullah's panel wired to shared state) ─────────────────

function SoilTab() {
  const { state, actions } = useFarmWise();
  const farm = state.farm;
  const soilTest = farm?.knownSoil?.source === 'USER_SOIL_TEST' ? farm.knownSoil : null;
  return (
    <SoilSensorsPanel
      preset={state.soilPreset}
      soilTest={soilTest}
      onPresetChange={actions.setSoilPreset}
      onSoilTestChange={(soil: SoilInput | null) => {
        if (soil) actions.updateFarm({ knownSoil: soil });
        else if (farm) actions.setFarm(withoutSoil(farm));
      }}
    />
  );
}

function withoutSoil(farm: FarmProfile): FarmProfile {
  const copy = { ...farm };
  delete copy.knownSoil;
  return copy;
}

// ─── Map (Ted's picker; saving updates the farm and the NASA context) ────────

function FarmMapPanel({ farm }: { farm: FarmProfile }) {
  const { actions } = useFarmWise();
  const { climate } = useMoenData();
  const saved: LatLon = { lat: farm.lat, lon: farm.lon };
  const [coords, setCoords] = useState<LatLon>(saved);
  const [dirty, setDirty] = useState(false);
  const valid = coords.lat != null && coords.lon != null;

  // F10: warn before the tab is closed with an unsaved location.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = () => {
    if (!valid) return;
    actions.updateFarm({ lat: coords.lat, lon: coords.lon });
    showToast('Farm location saved. Climate context updated.', 'success');
    setDirty(false);
  };

  const locationNote = climate?.evidence.find(e => e.value == null || e.id === 'nasa-power-distance')?.note;

  return (
    <div className="farm-map-panel">
      <div className="farm-map-confirmed">
        <span className="farm-map-confirmed__icon"><Icon icon={MapPin} /></span>
        <div>
          <div className="font-semibold">{saved.lat != null && saved.lon != null ? 'Saved location' : 'Location not set'}</div>
          <div className="text-sm text-muted">{formatLatLon(saved.lat, saved.lon)}</div>
        </div>
        {saved.lat != null && <Badge variant="success">Set</Badge>}
      </div>
      <FarmMapPicker value={coords} onChange={setCoords} onDirtyChange={setDirty} savedValue={saved} />
      <div className="farm-details-actions">
        <Button variant="primary" onClick={save} disabled={!valid || !dirty}>Save location</Button>
        {dirty && <span className="text-sm text-muted" role="status">Unsaved location change</span>}
      </div>
      <p className="farm-map-note text-sm text-muted">
        <Icon icon={MapIcon} size="sm" /> {locationNote ?? 'NASA POWER values on the Dashboard and Evidence page describe the nearest grid cell, not your field.'}
      </p>
    </div>
  );
}

// ─── Rotation editor ─────────────────────────────────────────────────────────

function RotationEditor({ rotation, error, onChange }: { rotation: CropSeason[]; error?: string; onChange: (r: CropSeason[]) => void }) {
  const update = (i: number, patch: Partial<CropSeason>) => onChange(rotation.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="farm-rotation-edit">
      <span className="fw-field__label">Crop rotation</span>
      {error && <span className="fw-field__error" role="alert">{error}</span>}
      {rotation.length === 0 && <p className="text-sm text-muted">No crop seasons yet. Add at least one so FarmWise can compare plans.</p>}
      {rotation.map((r, i) => (
        <div key={i} className="farm-rotation-row">
          <Select label={`Season ${i + 1}`} value={r.season} options={SEASON_OPTIONS} onChange={e => update(i, { season: e.target.value })} />
          <Select label="Crop" value={r.cropId} options={CROP_OPTIONS} onChange={e => update(i, { cropId: e.target.value })} />
          <Select label="Year" value={String(r.yearOffset)} options={[{ value: '0', label: 'Year 1' }, { value: '1', label: 'Year 2' }]} onChange={e => update(i, { yearOffset: Number(e.target.value) })} />
          <IconButton label={`Remove season ${i + 1}`} onClick={() => onChange(rotation.filter((_, idx) => idx !== i))}><Icon icon={X} /></IconButton>
        </div>
      ))}
      <Button variant="secondary" size="sm" icon={<Icon icon={Plus} size="sm" />}
        onClick={() => onChange([...rotation, { season: SEASON_OPTIONS[rotation.length % 2]!.value, cropId: 'maize', yearOffset: rotation.length > 1 ? 1 : 0 }])}>
        Add season
      </Button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
