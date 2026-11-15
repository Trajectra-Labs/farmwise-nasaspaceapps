import { useState, type FormEvent } from 'react'
import type { SoilInput } from '../../contracts/farmwise'
import {
  getSimulatedReading,
  type SoilMetricKey,
  type SoilPreset,
} from '../../data/simulated'
import { useFarmWise } from '../../core'
import { Badge, Button, Card } from '../../ui'
import './soil.css'

export type SoilSensorsPanelProps = {
  preset?: SoilPreset
  soilTest?: SoilInput | null
  onPresetChange?: (preset: SoilPreset) => void
  onSoilTestChange?: (soil: SoilInput | null) => void
}

type SoilTestDraft = Record<SoilMetricKey, string>

const soilFields: Array<{
  key: SoilMetricKey
  label: string
  unit: string
  min: number
  max: number
  step: number
}> = [
  { key: 'ph', label: 'pH', unit: 'pH', min: 0, max: 14, step: 0.1 },
  { key: 'n', label: 'Nitrogen (N)', unit: 'mg/kg', min: 0, max: 2000, step: 1 },
  { key: 'p', label: 'Phosphorus (P)', unit: 'mg/kg', min: 0, max: 2000, step: 1 },
  { key: 'k', label: 'Potassium (K)', unit: 'mg/kg', min: 0, max: 2000, step: 1 },
  {
    key: 'moisturePct',
    label: 'Moisture',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
  },
]

const emptyDraft: SoilTestDraft = { ph: '', n: '', p: '', k: '', moisturePct: '' }

function isSoilPreset(value: string): value is SoilPreset {
  return value === 'dry' || value === 'normal' || value === 'wet'
}

function soilToDraft(soil: SoilInput | null): SoilTestDraft {
  if (!soil || soil.source !== 'USER_SOIL_TEST') return { ...emptyDraft }
  return {
    ph: soil.ph == null ? '' : String(soil.ph),
    n: soil.n == null ? '' : String(soil.n),
    p: soil.p == null ? '' : String(soil.p),
    k: soil.k == null ? '' : String(soil.k),
    moisturePct: soil.moisturePct == null ? '' : String(soil.moisturePct),
  }
}

function displayValue(value: number | null | undefined, unit: string): string {
  return value == null ? 'Unknown' : `${value} ${unit}`
}

export function SoilSensorsPanel({
  preset,
  soilTest,
  onPresetChange,
  onSoilTestChange,
}: SoilSensorsPanelProps) {
  const farmWise = useFarmWise()
  const [localPreset, setLocalPreset] = useState<SoilPreset>(farmWise.soilPreset)
  const [localSoilTest, setLocalSoilTest] = useState<SoilInput | null>(
    farmWise.farm?.knownSoil?.source === 'USER_SOIL_TEST' ? farmWise.farm.knownSoil : null,
  )
  const [previousSoilTest, setPreviousSoilTest] = useState(soilTest)
  const selectedPreset = preset ?? localPreset
  const savedSoilTest = soilTest === undefined ? localSoilTest : soilTest
  const [draft, setDraft] = useState<SoilTestDraft>(() => soilToDraft(savedSoilTest))
  const [validationMessage, setValidationMessage] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  if (soilTest !== undefined && soilTest !== previousSoilTest) {
    setPreviousSoilTest(soilTest)
    setDraft(soilToDraft(soilTest))
  }

  const reading = getSimulatedReading(selectedPreset)

  function changePreset(nextPreset: SoilPreset) {
    setLocalPreset(nextPreset)
    onPresetChange?.(nextPreset)
  }

  function changeDraft(key: SoilMetricKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setValidationMessage('')
  }

  function saveSoilTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values: Partial<Record<SoilMetricKey, number | null>> = {}
    for (const field of soilFields) {
      const rawValue = draft[field.key].trim()
      if (!rawValue) {
        values[field.key] = null
        continue
      }
      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        setValidationMessage(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`)
        return
      }
      values[field.key] = value
    }

    if (Object.values(values).every((value) => value == null)) {
      setValidationMessage('Enter at least one result from your soil test.')
      return
    }

    const saved: SoilInput = {
      ...values,
      source: 'USER_SOIL_TEST',
      timestamp: new Date().toISOString(),
    }
    setLocalSoilTest(saved)
    onSoilTestChange?.(saved)
    setValidationMessage('')
  }

  function clearSoilTest() {
    setLocalSoilTest(null)
    setDraft({ ...emptyDraft })
    onSoilTestChange?.(null)
    setConfirmClear(false)
  }

  return (
    <Card title="Soil & Sensors" className="soil-panel">
      <div className="soil-panel__provenance">
        <Badge source="SIMULATED_IOT" />
        <p>These offline presets are examples, not readings from connected farm equipment.</p>
      </div>

      <div className="soil-panel__control">
        <label htmlFor="soil-preset">Simulated soil preset</label>
        <select
          id="soil-preset"
          value={selectedPreset}
          onChange={(event) => {
            const value = event.currentTarget.value
            if (isSoilPreset(value)) changePreset(value)
          }}
        >
          <option value="dry">Dry</option>
          <option value="normal">Normal</option>
          <option value="wet">Wet</option>
        </select>
      </div>
      {!onPresetChange ? (
        <p className="soil-panel__integration-note" role="note">
          Preset changes stay in this panel until the shared store provides a soil-preset update action.
        </p>
      ) : null}

      <section aria-labelledby="simulated-reading-heading">
        <div className="soil-panel__section-heading">
          <h3 id="simulated-reading-heading">Simulated reading</h3>
          <Badge source={reading.source} />
        </div>
        <p className="soil-panel__timestamp">
          Sample timestamp: <time dateTime={reading.timestamp}>{reading.timestamp}</time> (demo)
        </p>
        <dl className="soil-panel__metrics">
          {soilFields.map((field) => {
            const value = reading[field.key]
            const range = reading.metrics[field.key]
            return (
              <div className="soil-panel__metric" key={field.key}>
                <dt>{field.label}</dt>
                <dd>{displayValue(value, range.unit)}</dd>
                <small>Illustrative range: {range.min}–{range.max} {range.unit}</small>
              </div>
            )
          })}
        </dl>
        <p className="soil-panel__note">{reading.provenanceNote}</p>
      </section>

      <section className="soil-panel__test" aria-labelledby="soil-test-heading">
        <div className="soil-panel__section-heading">
          <h3 id="soil-test-heading">Enter a soil-test result</h3>
          <Badge source="USER_SOIL_TEST" />
        </div>
        <p>Enter only values from a soil test. Leave unavailable results blank; they stay Unknown.</p>
        {!onSoilTestChange ? (
          <p className="soil-panel__integration-note" role="note">
            Soil-test entries stay in this panel until the shared store provides a soil update action.
          </p>
        ) : null}
        <form onSubmit={saveSoilTest} noValidate>
          <div className="soil-panel__form-grid">
            {soilFields.map((field) => (
              <div className="soil-panel__control" key={field.key}>
                <label htmlFor={`soil-test-${field.key}`}>
                  {field.label} <span>({field.unit})</span>
                </label>
                <input
                  id={`soil-test-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={draft[field.key]}
                  onChange={(event) => changeDraft(field.key, event.target.value)}
                />
                <small className="soil-panel__range">
                  Valid range: {field.min}–{field.max} {field.unit}
                </small>
              </div>
            ))}
          </div>
          {validationMessage ? (
            <p className="soil-panel__error" role="alert">
              {validationMessage}
            </p>
          ) : null}
          <div className="soil-panel__actions">
            <Button type="submit" variant="primary">Save soil test</Button>
            {savedSoilTest ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmClear(true)}
              >
                Remove saved test
              </Button>
            ) : null}
          </div>
        </form>

        {savedSoilTest ? (
          <div className="soil-panel__saved" aria-live="polite">
            <p><strong>Saved user soil test</strong></p>
            <dl className="soil-panel__saved-values">
              {soilFields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{displayValue(savedSoilTest[field.key], field.unit)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="soil-panel__unknown">No user soil test saved. Results are Unknown.</p>
        )}

        {confirmClear ? (
          <div className="soil-panel__confirm" role="group" aria-label="Confirm removing soil test">
            <p>Remove the saved soil-test values?</p>
            <Button type="button" onClick={clearSoilTest}>Yes, remove</Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </section>
    </Card>
  )
}
