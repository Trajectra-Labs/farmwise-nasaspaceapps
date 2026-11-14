import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { FarmMapPicker, type LatLon } from './FarmMapPicker'
import { SAMPLE_LOCATION } from './sampleLocation'

// Leaflet needs a real layout engine, so the map view is replaced by a stub that exposes its callbacks.
vi.mock('./MapView', () => ({
  default: (p: {
    position: { lat: number; lon: number } | null
    onPick: (lat: number, lon: number) => void
    onTileError: () => void
    onTileLoad: () => void
  }) => (
    <div data-testid="map" data-position={p.position ? `${p.position.lat},${p.position.lon}` : 'none'}>
      <button onClick={() => p.onPick(-1.123456, 36.987654)}>stub-click-map</button>
      <button onClick={p.onTileError}>stub-tile-error</button>
      <button onClick={p.onTileLoad}>stub-tile-load</button>
    </div>
  ),
}))

function Harness({ initial = { lat: null, lon: null }, onDirty }: { initial?: LatLon; onDirty?: (d: boolean) => void }) {
  const [v, setV] = useState<LatLon>(initial)
  return <FarmMapPicker value={v} onChange={setV} onDirtyChange={onDirty} />
}

describe('FarmMapPicker validation (F08)', () => {
  it('rejects latitude 95 with an inline error and emits null', async () => {
    const onChange = vi.fn()
    render(<FarmMapPicker value={{ lat: null, lon: null }} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/Latitude/), '95')
    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be between -90 and 90.')
    expect(screen.getByLabelText(/Latitude/)).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).toHaveBeenLastCalledWith({ lat: null, lon: null })
  })

  it('rejects longitude 181 and non-numbers', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText(/Longitude/), '181')
    expect(screen.getByRole('alert')).toHaveTextContent('Longitude must be between -180 and 180.')
    await userEvent.clear(screen.getByLabelText(/Longitude/))
    await userEvent.type(screen.getByLabelText(/Longitude/), 'abc')
    expect(screen.getByRole('alert')).toHaveTextContent('Longitude must be a number.')
  })

  it('does not flag unfinished typing such as "-"', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText(/Latitude/), '-')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('accepts -1.29 / 36.82', async () => {
    const onChange = vi.fn()
    render(<FarmMapPicker value={{ lat: null, lon: null }} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/Latitude/), '-1.29')
    await userEvent.type(screen.getByLabelText(/Longitude/), '36.82')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith({ lat: -1.29, lon: 36.82 })
  })
})

describe('FarmMapPicker map, sample and clear (F08)', () => {
  it('sets coordinates from a map click, rounded to 4 decimals, and syncs the fields', async () => {
    render(<Harness />)
    await userEvent.click(await screen.findByText('stub-click-map'))
    expect(screen.getByLabelText(/Latitude/)).toHaveValue('-1.1235')
    expect(screen.getByLabelText(/Longitude/)).toHaveValue('36.9877')
    expect(screen.getByTestId('map')).toHaveAttribute('data-position', '-1.1235,36.9877')
  })

  it('uses the labelled sample location', async () => {
    const onChange = vi.fn()
    render(<FarmMapPicker value={{ lat: null, lon: null }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use sample location' }))
    expect(onChange).toHaveBeenLastCalledWith({ lat: SAMPLE_LOCATION.lat, lon: SAMPLE_LOCATION.lon })
    expect(screen.getAllByText(/Nakuru demo farm, Kenya/).length).toBeGreaterThan(0)
  })

  it('clears both fields and reports null', async () => {
    const onChange = vi.fn()
    function H() {
      const [v, setV] = useState<LatLon>({ lat: -1.29, lon: 36.82 })
      return <FarmMapPicker value={v} onChange={(n) => { onChange(n); setV(n) }} />
    }
    render(<H />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText(/Latitude/)).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith({ lat: null, lon: null })
    expect(screen.getByText(/No location selected/)).toBeInTheDocument()
  })

  it('follows a change made by the parent', async () => {
    const { rerender } = render(<FarmMapPicker value={{ lat: null, lon: null }} onChange={() => {}} />)
    rerender(<FarmMapPicker value={{ lat: 5, lon: 6 }} onChange={() => {}} />)
    expect(screen.getByLabelText(/Latitude/)).toHaveValue('5')
  })
})

describe('FarmMapPicker fallback without tiles (F09, E09)', () => {
  it('shows a calm notice after repeated tile errors and manual entry still works', async () => {
    render(<Harness />)
    const err = await screen.findByText('stub-tile-error')
    await userEvent.click(err)
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
    await userEvent.click(err)
    expect(screen.getByText(/Map tiles could not be loaded/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Latitude/), '-0.3')
    await userEvent.type(screen.getByLabelText(/Longitude/), '36.1')
    expect(screen.getByText(/Selected location: -0.3, 36.1/)).toBeInTheDocument()
  })

  it('does not show the notice when some tiles load', async () => {
    render(<Harness />)
    await userEvent.click(await screen.findByText('stub-tile-load'))
    await userEvent.click(screen.getByText('stub-tile-error'))
    await userEvent.click(screen.getByText('stub-tile-error'))
    expect(screen.queryByText(/Map tiles could not be loaded/)).not.toBeInTheDocument()
  })

  it('shows an offline notice when the browser reports offline', async () => {
    const spy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    render(<Harness />)
    expect(screen.getByText(/appear to be offline/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Latitude/)).toBeEnabled()
    spy.mockRestore()
  })
})

describe('FarmMapPicker dirty state (F10)', () => {
  it('reports dirty after an edit and clean when returned to the saved value', async () => {
    const onDirty = vi.fn()
    render(<Harness initial={{ lat: 1, lon: 2 }} onDirty={onDirty} />)
    await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false))
    await userEvent.click(screen.getByRole('button', { name: 'Use sample location' }))
    await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(true))
    await userEvent.type(screen.getByLabelText(/Latitude/), '{Control>}a{/Control}1')
    await userEvent.type(screen.getByLabelText(/Longitude/), '{Control>}a{/Control}2')
    await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false))
  })
})
