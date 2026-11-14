import { useId, useState } from 'react'

export type LatLon = { lat: number | null; lon: number | null }
export type FarmMapPickerProps = { value: LatLon; onChange: (next: LatLon) => void }

/** Returns an error message, or null when empty or valid. */
function validate(text: string, min: number, max: number, label: string): string | null {
  if (text.trim() === '') return null
  const n = Number(text)
  if (!Number.isFinite(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return null
}

/** Placeholder - owned by Ted. Manual coordinates only; no map yet. */
export function FarmMapPicker({ value, onChange }: FarmMapPickerProps) {
  const id = useId()
  const [latText, setLatText] = useState(value.lat === null ? '' : String(value.lat))
  const [lonText, setLonText] = useState(value.lon === null ? '' : String(value.lon))
  const latError = validate(latText, -90, 90, 'Latitude')
  const lonError = validate(lonText, -180, 180, 'Longitude')

  function emit(nextLat: string, nextLon: string) {
    const e1 = validate(nextLat, -90, 90, 'Latitude')
    const e2 = validate(nextLon, -180, 180, 'Longitude')
    onChange({
      lat: !e1 && nextLat.trim() !== '' ? Number(nextLat) : null,
      lon: !e2 && nextLon.trim() !== '' ? Number(nextLon) : null,
    })
  }

  return (
    <div>
      <p>Placeholder - owned by Ted. Map selection is not built yet; enter coordinates manually.</p>
      <div className="field">
        <label htmlFor={`${id}-lat`}>Latitude (-90 to 90)</label>
        <input
          id={`${id}-lat`}
          inputMode="decimal"
          value={latText}
          aria-invalid={latError !== null}
          aria-describedby={latError ? `${id}-lat-err` : undefined}
          onChange={(e) => {
            setLatText(e.target.value)
            emit(e.target.value, lonText)
          }}
        />
        {latError ? (
          <p id={`${id}-lat-err`} className="field-error" role="alert">
            {latError}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={`${id}-lon`}>Longitude (-180 to 180)</label>
        <input
          id={`${id}-lon`}
          inputMode="decimal"
          value={lonText}
          aria-invalid={lonError !== null}
          aria-describedby={lonError ? `${id}-lon-err` : undefined}
          onChange={(e) => {
            setLonText(e.target.value)
            emit(latText, e.target.value)
          }}
        />
        {lonError ? (
          <p id={`${id}-lon-err`} className="field-error" role="alert">
            {lonError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
