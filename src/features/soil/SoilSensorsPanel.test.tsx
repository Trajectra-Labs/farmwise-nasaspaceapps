import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { SoilInput } from '../../contracts/farmwise'
import { FarmWiseProvider } from '../../core'
import { getSimulatedReading } from '../../data/simulated'
import { SoilSensorsPanel } from './SoilSensorsPanel'

function renderSoil(props: ComponentProps<typeof SoilSensorsPanel> = {}) {
  return render(
    <FarmWiseProvider>
      <SoilSensorsPanel {...props} />
    </FarmWiseProvider>,
  )
}

describe('Soil & Sensors', () => {
  it('F05: simulated presets change displayed readings and are labeled as simulated', async () => {
    const user = userEvent.setup()
    const onPresetChange = vi.fn()
    renderSoil({ onPresetChange })
    expect(screen.getByText('42 %')).toBeInTheDocument()
    expect(screen.getAllByText('Simulated sensor')).toHaveLength(2)

    await user.selectOptions(screen.getByLabelText('Simulated soil preset'), 'wet')

    expect(screen.getByText('76 %')).toBeInTheDocument()
    expect(onPresetChange).toHaveBeenLastCalledWith('wet')
    expect(screen.getByText(/no physical sensor is connected/i)).toBeInTheDocument()
  })

  it('F06: soil-test values are validated and saved with USER_SOIL_TEST provenance', async () => {
    const user = userEvent.setup()
    const onSoilTestChange = vi.fn()
    renderSoil({ onSoilTestChange })

    await user.type(screen.getByLabelText('pH (pH)'), '15')
    await user.click(screen.getByRole('button', { name: 'Save soil test' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/pH must be between 0 and 14/)
    expect(onSoilTestChange).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('pH (pH)'))
    await user.type(screen.getByLabelText('pH (pH)'), '6.5')
    await user.type(screen.getByLabelText('Nitrogen (N) (mg/kg)'), '38')
    await user.click(screen.getByRole('button', { name: 'Save soil test' }))

    expect(screen.getByText('6.5 pH')).toBeInTheDocument()
    expect(onSoilTestChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ph: 6.5, n: 38, source: 'USER_SOIL_TEST' }),
    )
    expect(screen.getByText('User soil test')).toBeInTheDocument()
  })

  it('F06: a soil test cannot be saved when all values are blank', async () => {
    const user = userEvent.setup()
    renderSoil()
    await user.click(screen.getByRole('button', { name: 'Save soil test' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter at least one result/)
    expect(screen.getByText('No user soil test saved. Results are Unknown.')).toBeInTheDocument()
  })

  it('F07: missing user soil-test values stay Unknown rather than becoming zero', () => {
    const partialSoilTest: SoilInput = {
      ph: 6.4,
      n: null,
      p: undefined,
      k: null,
      moisturePct: null,
      source: 'USER_SOIL_TEST',
    }
    renderSoil({ soilTest: partialSoilTest })

    expect(screen.getByText('6.4 pH')).toBeInTheDocument()
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('0 mg/kg')).not.toBeInTheDocument()
  })

  it('removing saved user values requires confirmation and reports the clear to the integration callback', async () => {
    const user = userEvent.setup()
    const onSoilTestChange = vi.fn()
    const initialSoilTest: SoilInput = { ph: 6.2, source: 'USER_SOIL_TEST' }
    const { rerender } = renderSoil({ soilTest: initialSoilTest, onSoilTestChange })
    await user.click(screen.getByRole('button', { name: 'Remove saved test' }))
    expect(screen.getByRole('group', { name: 'Confirm removing soil test' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSoilTestChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove saved test' }))
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))
    expect(onSoilTestChange).toHaveBeenLastCalledWith(null)
    rerender(
      <FarmWiseProvider>
        <SoilSensorsPanel soilTest={null} onSoilTestChange={onSoilTestChange} />
      </FarmWiseProvider>,
    )
    expect(screen.getByText('No user soil test saved. Results are Unknown.')).toBeInTheDocument()
  })

  it('getSimulatedReading returns stable labeled readings for each preset', () => {
    const dry = getSimulatedReading('dry')
    const normal = getSimulatedReading('normal')
    const wet = getSimulatedReading('wet')

    expect(dry.source).toBe('SIMULATED_IOT')
    expect(dry.moisturePct).toBeLessThan(normal.moisturePct ?? Infinity)
    expect(normal.moisturePct).toBeLessThan(wet.moisturePct ?? Infinity)
    expect(dry.timestamp).toBeTruthy()
    expect(dry.metrics.moisturePct.unit).toBe('%')
    expect(dry).not.toBe(getSimulatedReading('dry'))
  })
})
