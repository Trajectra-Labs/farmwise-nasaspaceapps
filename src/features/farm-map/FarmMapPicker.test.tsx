import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { FarmMapPicker } from './FarmMapPicker'

describe('FarmMapPicker', () => {
  it('rejects latitude 95 with an inline error', async () => {
    const onChange = vi.fn()
    render(<FarmMapPicker value={{ lat: null, lon: null }} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/Latitude/), '95')
    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be between -90 and 90.')
    expect(onChange).toHaveBeenLastCalledWith({ lat: null, lon: null })
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
