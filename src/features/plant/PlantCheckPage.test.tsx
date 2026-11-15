import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { FarmWiseProvider } from '../../core'
import { demoPlantSamples, evaluateSamplePhoto } from '../../data/simulated'
import { PlantCheckPage } from './PlantCheckPage'

function renderPlant(props: ComponentProps<typeof PlantCheckPage> = {}) {
  return render(
    <FarmWiseProvider>
      <PlantCheckPage {...props} />
    </FarmWiseProvider>,
  )
}

describe('Plant Check', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:plant-test'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('P01: accepts a valid upload and shows a preview and file details', async () => {
    const user = userEvent.setup()
    renderPlant()
    const file = new File(['plant image'], 'leaf.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText('Upload a plant photo'), file)

    expect(await screen.findByAltText('Preview: leaf.png')).toBeInTheDocument()
    expect(screen.getByText('leaf.png')).toBeInTheDocument()
    expect(screen.getByText(/0\.00 MB · Uploaded by you/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Guided symptom checklist' })).toBeInTheDocument()
  })

  it('P02/P05: replace and remove clear the prior demo interpretation; uploads are not classified', async () => {
    const user = userEvent.setup()
    renderPlant()
    await user.click(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' }))
    expect(screen.getByText('Pale areas along the leaf edges')).toBeInTheDocument()

    await user.upload(
      screen.getByLabelText('Upload a plant photo'),
      new File(['unknown image'], 'unknown.webp', { type: 'image/webp' }),
    )
    expect(screen.queryByText('Pale areas along the leaf edges')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Guided symptom checklist' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(screen.queryByAltText('Preview: unknown.webp')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Guided symptom checklist' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Observations and uncertainty' })).not.toBeInTheDocument()
  })

  it('P03: camera permission denial provides upload and demo-image fallbacks', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
    })
    renderPlant()

    await user.click(screen.getByRole('button', { name: 'Use camera' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Camera access was not granted/)
    expect(screen.getByLabelText('Upload a plant photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' })).toBeInTheDocument()
  })

  it('P03: unsupported camera browser explains the upload fallback', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    renderPlant()

    await user.click(screen.getByRole('button', { name: 'Use camera' }))

    expect(screen.getByRole('status')).toHaveTextContent(/Camera is unavailable/)
  })

  it('P03: a supported camera can capture a local preview', async () => {
    const user = userEvent.setup()
    const stopTrack = vi.fn()
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
      configurable: true,
      set: vi.fn(),
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      value: 640,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      value: 480,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({ drawImage: vi.fn() }),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback) => callback(new Blob(['captured'], { type: 'image/jpeg' })),
    })
    renderPlant()

    await user.click(screen.getByRole('button', { name: 'Use camera' }))
    expect(await screen.findByLabelText('Live camera preview')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Capture photo' }))

    expect(await screen.findByAltText('Preview: plant-camera-capture.jpg')).toBeInTheDocument()
    expect(stopTrack).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Guided symptom checklist' })).toBeInTheDocument()
  })

  it('P04/P06: sample cases are credited and show distinct signs, concerns, and uncertainty', async () => {
    const user = userEvent.setup()
    renderPlant()

    await user.click(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' }))
    expect(screen.getByText('Pale areas along the leaf edges')).toBeInTheDocument()
    expect(screen.getByText(/Water or nutrient stress are possibilities/)).toBeInTheDocument()
    expect(screen.getAllByText(/demo illustration; not a field photograph/i)).toHaveLength(3)
    expect(screen.getAllByText(/not a diagnosis/i).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: 'Use sample image: Small holes in leaf' }))
    expect(screen.getByText('Several small holes in the leaf surface')).toBeInTheDocument()
    expect(screen.getByText(/Insect feeding or physical damage/)).toBeInTheDocument()
    expect(screen.queryByText('Pale areas along the leaf edges')).not.toBeInTheDocument()
  })

  it('P05/P10: unknown photos use only farmer-selected checklist observations', async () => {
    const user = userEvent.setup()
    const onObservationChange = vi.fn()
    renderPlant({ onObservationChange })
    await user.upload(
      screen.getByLabelText('Upload a plant photo'),
      new File(['unknown image'], 'field.jpg', { type: 'image/jpeg' }),
    )
    await user.click(screen.getByLabelText('Holes or missing edges'))
    await user.click(screen.getByRole('button', { name: 'Save my observations' }))

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toContain(
      'Holes or missing edges',
    )
    expect(screen.getByText(/These are your observations, not an automatic photo classification/)).toBeInTheDocument()
    expect(onObservationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'FARMER_REPORTED', visibleSigns: ['Holes or missing edges'] }),
    )
    expect(screen.queryByText(/confidence %|accuracy %/i)).not.toBeInTheDocument()
  })

  it('P07: farmer feedback is reported to the integration callback and can be changed with an editable note', async () => {
    const user = userEvent.setup()
    const onFeedbackChange = vi.fn()
    renderPlant({ onFeedbackChange })
    await user.click(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' }))
    await user.click(screen.getByRole('button', { name: 'Yes, it matches' }))

    expect(onFeedbackChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ choice: 'confirm', source: 'FARMER_REPORTED' }),
    )
    await user.type(screen.getByLabelText('Add or edit a note'), 'Observed on two plants')
    expect(onFeedbackChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ choice: 'confirm', note: 'Observed on two plants' }),
    )

    await user.click(screen.getByRole('button', { name: 'No, it does not' }))
    expect(onFeedbackChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ choice: 'reject', note: 'Observed on two plants' }),
    )
    expect(screen.getByRole('button', { name: 'No, it does not' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('P08: next steps stay observational and do not recommend treatment', async () => {
    const user = userEvent.setup()
    renderPlant()
    await user.click(screen.getByRole('button', { name: 'Use sample image: Small holes in leaf' }))

    expect(screen.getByText(/Compare with nearby healthy plants/)).toBeInTheDocument()
    expect(screen.getByText(/No diagnosis or pesticide recommendation is provided/)).toBeInTheDocument()
    expect(screen.queryByText(/apply pesticide|spray/i)).not.toBeInTheDocument()
  })

  it('P09: invalid type and oversized images produce explicit errors without replacing the current photo', async () => {
    const user = userEvent.setup()
    renderPlant()
    await user.click(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' }))
    const input = screen.getByLabelText('Upload a plant photo')

    fireEvent.change(input, {
      target: { files: [new File(['not an image'], 'notes.txt', { type: 'text/plain' })] },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Choose a JPG, PNG, or WebP/)
    expect(screen.getByText('Pale areas along the leaf edges')).toBeInTheDocument()

    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })],
      },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/8 MB or smaller/)
    expect(screen.getByText('Pale areas along the leaf edges')).toBeInTheDocument()
  })

  it('P09: an image that cannot be decoded is rejected with a useful fallback', async () => {
    const user = userEvent.setup()
    renderPlant()
    await user.upload(
      screen.getByLabelText('Upload a plant photo'),
      new File(['not really an image'], 'broken.png', { type: 'image/png' }),
    )
    fireEvent.error(screen.getByAltText('Preview: broken.png'))

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be opened as an image/)
    expect(screen.queryByAltText('Preview: broken.png')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' })).toBeInTheDocument()
  })

  it('P11: photo previews are local to the page and are not sent through observation state', async () => {
    const user = userEvent.setup()
    const onObservationChange = vi.fn()
    const { unmount } = renderPlant({ onObservationChange })
    await user.upload(
      screen.getByLabelText('Upload a plant photo'),
      new File(['local photo'], 'private.png', { type: 'image/png' }),
    )
    expect(screen.getByAltText('Preview: private.png')).toBeInTheDocument()
    expect(onObservationChange).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'private.png' }))

    unmount()
    renderPlant({ onObservationChange })
    expect(screen.queryByAltText('Preview: private.png')).not.toBeInTheDocument()
  })

  it('P12: visible controls are keyboard operable and feedback state is announced semantically', async () => {
    const user = userEvent.setup()
    renderPlant()
    const sampleButton = screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' })
    sampleButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('heading', { name: 'Observations and uncertainty' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, it matches' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Upload a plant photo')).toBeInTheDocument()
  })

  it('P07 integration: clearing a photo sends an explicit cleared observation and feedback', async () => {
    const user = userEvent.setup()
    const onObservationChange = vi.fn()
    const onFeedbackChange = vi.fn()
    renderPlant({ onObservationChange, onFeedbackChange })
    await user.click(screen.getByRole('button', { name: 'Use sample image: Pale leaf edges' }))
    await user.click(screen.getByRole('button', { name: 'Yes, it matches' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo' }))

    expect(onObservationChange).toHaveBeenLastCalledWith(null)
    expect(onFeedbackChange).toHaveBeenLastCalledWith(null)
  })

  it('sample evaluation function returns distinct demo cases and null for unknown IDs', () => {
    expect(demoPlantSamples).toHaveLength(2)
    expect(evaluateSamplePhoto('demo-leaf-edges')?.visibleSigns).not.toEqual(
      evaluateSamplePhoto('demo-leaf-holes')?.visibleSigns,
    )
    expect(evaluateSamplePhoto('not-a-sample')).toBeNull()
    expect(evaluateSamplePhoto('demo-leaf-edges')?.source).toBe('DEMO_IMAGE')
  })
})
