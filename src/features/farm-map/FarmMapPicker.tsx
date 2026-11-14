import { lazy, Suspense, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Button } from '../../ui'
import { MapBoundary } from './MapBoundary'
import { SAMPLE_LOCATION } from './sampleLocation'
import './farm-map.css'

const MapView = lazy(() => import('./MapView'))

export type LatLon = { lat: number | null; lon: number | null }
export type FarmMapPickerProps = {
  value: LatLon
  onChange: (next: LatLon) => void
  /**
   * F10: called with true when the picker holds a location that differs from `savedValue`
   * (or from the value at mount when `savedValue` is not given). The parent decides how to warn,
   * for example with a beforeunload handler or a router blocker while this is true.
   */
  onDirtyChange?: (dirty: boolean) => void
  /** Last saved location, used as the baseline for onDirtyChange. */
  savedValue?: LatLon
}

const TILE_FAILURE_THRESHOLD = 2

/** Text such as "-" or "1." is unfinished typing, not an error. */
function isIncomplete(text: string): boolean {
  return /^[+-]?\.?$|^[+-]?\d+\.$/.test(text.trim())
}

/** Returns an error message, or null when empty, unfinished or valid. */
function validate(text: string, min: number, max: number, label: string): string | null {
  if (text.trim() === '' || isIncomplete(text)) return null
  const n = Number(text)
  if (!Number.isFinite(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return null
}

function parse(text: string, min: number, max: number, label: string): number | null {
  if (text.trim() === '' || validate(text, min, max, label) !== null || isIncomplete(text)) return null
  return Number(text)
}

const fmt = (n: number | null): string => (n === null ? '' : String(n))
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const getOnline = () => navigator.onLine

export function FarmMapPicker({ value, onChange, onDirtyChange, savedValue }: FarmMapPickerProps) {
  const id = useId()
  const online = useSyncExternalStore(subscribeOnline, getOnline, () => true)
  const [latText, setLatText] = useState(fmt(value.lat))
  const [lonText, setLonText] = useState(fmt(value.lon))
  const [seen, setSeen] = useState(value)
  const [baseline] = useState<LatLon>(savedValue ?? value)
  const [tiles, setTiles] = useState({ ok: 0, failed: 0 })
  const [status, setStatus] = useState('')

  const latError = validate(latText, -90, 90, 'Latitude')
  const lonError = validate(lonText, -180, 180, 'Longitude')
  const lat = parse(latText, -90, 90, 'Latitude')
  const lon = parse(lonText, -180, 180, 'Longitude')

  // Follow changes made by the parent (for example a loaded profile) without overwriting typing.
  if (value.lat !== seen.lat || value.lon !== seen.lon) {
    setSeen(value)
    if (value.lat !== lat || value.lon !== lon) {
      setLatText(fmt(value.lat))
      setLonText(fmt(value.lon))
    }
  }

  const base = savedValue ?? baseline
  const dirty = lat !== base.lat || lon !== base.lon || latError !== null || lonError !== null
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  function setText(nextLat: string, nextLon: string) {
    setLatText(nextLat)
    setLonText(nextLon)
    onChange({
      lat: parse(nextLat, -90, 90, 'Latitude'),
      lon: parse(nextLon, -180, 180, 'Longitude'),
    })
  }

  function setPoint(nextLat: number, nextLon: number, message: string) {
    setText(String(round4(nextLat)), String(round4(nextLon)))
    setStatus(message)
  }

  function clear() {
    setText('', '')
    setStatus('Location cleared.')
  }

  const mapFailed = tiles.failed >= TILE_FAILURE_THRESHOLD && tiles.ok === 0
  const showNotice = !online || mapFailed
  const position = lat !== null && lon !== null ? { lat, lon } : null

  return (
    <div className="fm-picker" role="group" aria-label="Farm location">
      <p className="fm-helper" id={`${id}-help`}>
        Click the map to place your farm, or type coordinates below. With a keyboard, use the fields
        below; the map also pans with the arrow keys and zooms with + and −.
      </p>

      {showNotice ? (
        <p className="fm-notice" role="status">
          {!online
            ? 'You appear to be offline, so map tiles may not load.'
            : 'Map tiles could not be loaded.'}{' '}
          Entering latitude and longitude below still works.
        </p>
      ) : null}

      <div className="fm-map">
        <MapBoundary
          fallback={
            <div className="fm-map__placeholder">
              <p>The map could not be loaded. Use the latitude and longitude fields below.</p>
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="fm-map__placeholder" role="status">
                Loading map…
              </div>
            }
          >
            <MapView
              position={position}
              onPick={(la, lo) =>
                setPoint(la, lo, `Location set to ${round4(la)}, ${round4(lo)} from the map.`)
              }
              onTileError={() => setTiles((t) => ({ ...t, failed: t.failed + 1 }))}
              onTileLoad={() => setTiles((t) => (t.ok > 0 ? t : { ...t, ok: 1 }))}
            />
          </Suspense>
        </MapBoundary>
      </div>

      <div className="fm-fields">
        <div className="field">
          <label htmlFor={`${id}-lat`}>Latitude (-90 to 90)</label>
          <input
            id={`${id}-lat`}
            inputMode="decimal"
            autoComplete="off"
            value={latText}
            aria-invalid={latError !== null}
            aria-describedby={latError ? `${id}-lat-err` : `${id}-help`}
            onChange={(e) => setText(e.target.value, lonText)}
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
            autoComplete="off"
            value={lonText}
            aria-invalid={lonError !== null}
            aria-describedby={lonError ? `${id}-lon-err` : `${id}-help`}
            onChange={(e) => setText(latText, e.target.value)}
          />
          {lonError ? (
            <p id={`${id}-lon-err`} className="field-error" role="alert">
              {lonError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="fm-actions">
        <Button
          variant="secondary"
          onClick={() =>
            setPoint(
              SAMPLE_LOCATION.lat,
              SAMPLE_LOCATION.lon,
              `Sample location set: ${SAMPLE_LOCATION.name}.`,
            )
          }
        >
          Use sample location
        </Button>
        <Button
          variant="secondary"
          onClick={clear}
          disabled={latText === '' && lonText === ''}
        >
          Clear
        </Button>
      </div>
      <p className="fm-helper">Sample location: {SAMPLE_LOCATION.name} ({SAMPLE_LOCATION.lat}, {SAMPLE_LOCATION.lon}).</p>

      <p className="fm-selected">
        {position ? (
          <>
            Selected location: {position.lat}, {position.lon}
          </>
        ) : (
          'No location selected. Unknown until you set one.'
        )}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
