import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { PlantObservation } from '../../contracts/farmwise'
import { demoPlantSamples, evaluateSamplePhoto } from '../../data/simulated'
import { useFarmWise } from '../../core'
import { Badge, Button, Card } from '../../ui'
import './plant.css'

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type PhotoSource = 'sample' | 'upload' | 'camera'

type SelectedPhoto = {
  name: string
  previewUrl: string
  size: number | null
  source: PhotoSource
  sampleId?: string
  credit?: string
}

export type FarmerPlantFeedback = {
  sampleId?: string
  choice: 'confirm' | 'reject' | 'unsure'
  note: string
  updatedAt: string
  source: 'FARMER_REPORTED'
}

export type PlantCheckPageProps = {
  initialObservation?: PlantObservation | null
  onObservationChange?: (observation: PlantObservation | null) => void
  onFeedbackChange?: (feedback: FarmerPlantFeedback | null) => void
}

const checklistItems = [
  { id: 'yellowing', label: 'Yellowing or pale areas' },
  { id: 'spots', label: 'Spots or marks' },
  { id: 'holes', label: 'Holes or missing edges' },
  { id: 'wilting', label: 'Drooping or wilting' },
  { id: 'other', label: 'Something else I can see' },
] as const

type SymptomId = (typeof checklistItems)[number]['id']

function isAcceptedImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())
}

function formatFileSize(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function PlantCheckPage({
  initialObservation,
  onObservationChange: onObservationChangeProp,
  onFeedbackChange: onFeedbackChangeProp,
}: PlantCheckPageProps) {
  const { state: farmWise, actions } = useFarmWise()
  // Integration: results and farmer feedback are saved to the shared FarmWise state by default,
  // so the assistant and Dashboard see the latest Plant Check. Props still override for tests.
  const onObservationChange = onObservationChangeProp ?? actions.setPlantObservation
  const onFeedbackChange = onFeedbackChangeProp ?? actions.setPlantFeedback
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null)
  const [observation, setObservation] = useState<PlantObservation | null>(
    initialObservation ?? farmWise.lastPlantObservation ?? null,
  )
  const [feedback, setFeedback] = useState<FarmerPlantFeedback | null>(farmWise.plantFeedback ?? null)
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomId[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [cameraMessage, setCameraMessage] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraStarting, setCameraStarting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (cameraStream && videoRef.current) videoRef.current.srcObject = cameraStream
  }, [cameraStream])

  useEffect(
    () => () => {
      if (photo && photo.source !== 'sample') URL.revokeObjectURL(photo.previewUrl)
      stopStream(streamRef.current)
    },
    [photo],
  )

  function clearInterpretation() {
    setObservation(null)
    setFeedback(null)
    setSelectedSymptoms([])
    onObservationChange?.(null)
    onFeedbackChange?.(null)
  }

  function closeCamera() {
    stopStream(streamRef.current)
    streamRef.current = null
    setCameraStream(null)
    setCameraMessage('')
  }

  function selectSample(sampleId: string) {
    const sample = demoPlantSamples.find((item) => item.id === sampleId)
    const sampleObservation = evaluateSamplePhoto(sampleId)
    if (!sample || !sampleObservation) return
    closeCamera()
    setPhoto({
      name: sample.title,
      previewUrl: sample.imageUrl,
      size: null,
      source: 'sample',
      sampleId: sample.id,
      credit: sample.credit,
    })
    setErrorMessage('')
    setFeedback(null)
    setSelectedSymptoms([])
    setObservation(sampleObservation)
    onObservationChange?.(sampleObservation)
    onFeedbackChange?.(null)
  }

  function validateAndSelectFile(file: File, source: 'upload' | 'camera' = 'upload') {
    if (!isAcceptedImage(file)) {
      setErrorMessage('Choose a JPG, PNG, or WebP image. The previous photo has not been changed.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('The image must be 8 MB or smaller. The previous photo has not been changed.')
      return
    }
    closeCamera()
    clearInterpretation()
    setPhoto({
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      size: file.size,
      source,
    })
    setErrorMessage('')
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file) validateAndSelectFile(file)
    event.currentTarget.value = ''
  }

  async function startCamera() {
    setCameraMessage('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera is unavailable in this browser. You can upload a photo or use a demo image instead.')
      return
    }
    setCameraStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      setCameraStream(stream)
      setErrorMessage('')
    } catch {
      setCameraMessage('Camera access was not granted. You can upload a photo or use a demo image instead.')
    } finally {
      setCameraStarting(false)
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraMessage('The camera image is not ready yet. Try again or use photo upload.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraMessage('This browser could not prepare the camera image. Use photo upload instead.')
      return
    }
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg'))
    if (!blob) {
      setCameraMessage('This browser could not capture the image. Use photo upload instead.')
      return
    }
    const file = new File([blob], 'plant-camera-capture.jpg', { type: 'image/jpeg' })
    validateAndSelectFile(file, 'camera')
  }

  function removePhoto() {
    closeCamera()
    setPhoto(null)
    setErrorMessage('')
    clearInterpretation()
  }

  function toggleSymptom(symptom: SymptomId) {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom],
    )
  }

  function saveGuidedObservation() {
    const visibleSigns = checklistItems
      .filter((item) => selectedSymptoms.includes(item.id))
      .map((item) => item.label)
    if (visibleSigns.length === 0) return
    const nextObservation: PlantObservation = {
      visibleSigns,
      possibleConcerns: [
        'Several causes are possible. Compare with nearby healthy plants and ask a local agricultural adviser if the change continues.',
      ],
      certaintyNote:
        'These are your observations, not an automatic photo classification or a diagnosis.',
      source: 'FARMER_REPORTED',
    }
    setObservation(nextObservation)
    setFeedback(null)
    onObservationChange?.(nextObservation)
    onFeedbackChange?.(null)
  }

  function updateFeedback(choice: FarmerPlantFeedback['choice']) {
    const nextFeedback: FarmerPlantFeedback = {
      sampleId: observation?.sampleId,
      choice,
      note: feedback?.note ?? '',
      updatedAt: new Date().toISOString(),
      source: 'FARMER_REPORTED',
    }
    setFeedback(nextFeedback)
    onFeedbackChange?.(nextFeedback)
  }

  function updateFeedbackNote(note: string) {
    if (!feedback) return
    const nextFeedback = { ...feedback, note, updatedAt: new Date().toISOString() }
    setFeedback(nextFeedback)
    onFeedbackChange?.(nextFeedback)
  }

  return (
    <div className="plant-check">
      <h1>Plant Check</h1>
      <p className="plant-check__intro">
        Review visible signs or record what you notice. Photos are not used to diagnose disease,
        measure soil, or recommend treatment.
      </p>

      <Card title="Choose a photo">
        <div className="plant-check__actions">
          <label className="plant-check__upload">
            <span>Upload photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload a plant photo"
              onChange={handleFileChange}
            />
          </label>
          <Button variant="secondary" onClick={startCamera} disabled={cameraStarting || !!cameraStream}>
            {cameraStarting ? 'Opening camera…' : 'Use camera'}
          </Button>
        </div>
        <p className="plant-check__hint">
          JPG, PNG, or WebP; maximum 8 MB. Camera access is optional and requested only after you select Use camera.
        </p>
        {errorMessage ? <p className="plant-check__error" role="alert">{errorMessage}</p> : null}
        {cameraMessage ? <p className="plant-check__notice" role="status">{cameraMessage}</p> : null}

        {cameraStream ? (
          <div className="plant-check__camera">
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
            <div className="plant-check__actions">
              <Button onClick={capturePhoto}>Capture photo</Button>
              <Button variant="secondary" onClick={closeCamera}>Close camera</Button>
            </div>
          </div>
        ) : null}

        <div className="plant-check__samples">
          <h3>Try a credited demo image</h3>
          <p>These are original illustrations for demonstrating the workflow, not field photos.</p>
          <div className="plant-check__sample-grid">
            {demoPlantSamples.map((sample) => (
              <article className="plant-check__sample" key={sample.id}>
                <img src={sample.imageUrl} alt={sample.alt} />
                <p><strong>{sample.title}</strong></p>
                <p className="plant-check__hint">{sample.credit}</p>
                <Button
                  variant="secondary"
                  aria-label={`Use sample image: ${sample.title}`}
                  onClick={() => selectSample(sample.id)}
                >
                  Review this sample
                </Button>
              </article>
            ))}
          </div>
        </div>
      </Card>

      {photo ? (
        <Card title="Selected photo">
          <div className="plant-check__photo-layout">
            <img
              className="plant-check__preview"
              src={photo.previewUrl}
              alt={`Preview: ${photo.name}`}
              onError={() => {
                if (photo.source === 'sample') return
                setPhoto(null)
                clearInterpretation()
                setErrorMessage('This file could not be opened as an image. Choose a valid JPG, PNG, or WebP file.')
              }}
            />
            <div className="plant-check__photo-details">
              <p><strong>{photo.name}</strong></p>
              {photo.size == null ? (
                <Badge source="DEMO_IMAGE" />
              ) : (
                <p>{formatFileSize(photo.size)} · {photo.source === 'camera' ? 'Camera capture' : 'Uploaded by you'}</p>
              )}
              {photo.credit ? <p className="plant-check__hint">{photo.credit}</p> : null}
              {photo.source !== 'sample' ? (
                <p className="plant-check__hint" role="note">
                  The photo preview stays on this page and is not uploaded or saved to shared farm data.
                </p>
              ) : null}
              <div className="plant-check__actions">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Replace photo
                </Button>
                <Button variant="secondary" onClick={removePhoto}>Remove photo</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {photo && !observation ? (
        <Card title="Guided symptom checklist">
          <Badge source="FARMER_REPORTED" />
          <p>Select only signs you can see. FarmWise will record your observations; it will not classify the image.</p>
          <fieldset className="plant-check__checklist">
            <legend>What do you notice?</legend>
            {checklistItems.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={selectedSymptoms.includes(item.id)}
                  onChange={() => toggleSymptom(item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <Button onClick={saveGuidedObservation} disabled={selectedSymptoms.length === 0}>
            Save my observations
          </Button>
        </Card>
      ) : null}

      {observation ? (
        <Card title="Observations and uncertainty">
          <Badge source={observation.source} />
          <div className="plant-check__result">
            <section>
              <h3>Visible observations</h3>
              <ul>{observation.visibleSigns.map((sign) => <li key={sign}>{sign}</li>)}</ul>
            </section>
            <section>
              <h3>Possible concern to check</h3>
              <ul>{observation.possibleConcerns.map((concern) => <li key={concern}>{concern}</li>)}</ul>
            </section>
            <section>
              <h3>Uncertainty</h3>
              <p>{observation.certaintyNote}</p>
            </section>
            <section>
              <h3>Observational next steps</h3>
              <p>Compare with nearby healthy plants, note whether the sign changes, and seek local expert guidance if it persists.</p>
              <p className="plant-check__notice">No diagnosis or pesticide recommendation is provided.</p>
            </section>
          </div>
          {photo?.source === 'sample' ? (
            <section className="plant-check__feedback" aria-labelledby="plant-feedback-heading">
              <h3 id="plant-feedback-heading">Does this match what you see?</h3>
              <p>Your response is farmer-reported feedback, not a diagnosis.</p>
              <div className="plant-check__actions">
                <Button
                  variant={feedback?.choice === 'confirm' ? 'primary' : 'secondary'}
                  aria-pressed={feedback?.choice === 'confirm'}
                  onClick={() => updateFeedback('confirm')}
                >
                  Yes, it matches
                </Button>
                <Button
                  variant={feedback?.choice === 'reject' ? 'primary' : 'secondary'}
                  aria-pressed={feedback?.choice === 'reject'}
                  onClick={() => updateFeedback('reject')}
                >
                  No, it does not
                </Button>
                <Button
                  variant={feedback?.choice === 'unsure' ? 'primary' : 'secondary'}
                  aria-pressed={feedback?.choice === 'unsure'}
                  onClick={() => updateFeedback('unsure')}
                >
                  Not sure
                </Button>
              </div>
              {feedback ? (
                <label className="plant-check__feedback-note">
                  Add or edit a note
                  <textarea
                    value={feedback.note}
                    rows={3}
                    onChange={(event) => updateFeedbackNote(event.target.value)}
                  />
                </label>
              ) : null}
            </section>
          ) : null}
          {!onObservationChange ? (
            <p className="plant-check__integration-note" role="note">
              Observations stay on this page until the shared store provides a plant-observation update action.
            </p>
          ) : null}
          {feedback && !onFeedbackChange ? (
            <p className="plant-check__integration-note" role="note">
              Feedback is held for this page session; the shared store does not yet expose a feedback save action.
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
