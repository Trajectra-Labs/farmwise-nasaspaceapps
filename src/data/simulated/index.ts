import type { PlantObservation, SoilInput } from '../../contracts/farmwise'
import demoLeafEdges from './samples/demo-leaf-edges.svg'
import demoLeafHoles from './samples/demo-leaf-holes.svg'

export type SoilPreset = 'dry' | 'normal' | 'wet'
export type SoilMetricKey = 'ph' | 'n' | 'p' | 'k' | 'moisturePct'

export type SimulatedSoilReading = SoilInput & {
  preset: SoilPreset
  metrics: Record<SoilMetricKey, { unit: string; min: number; max: number }>
  provenanceNote: string
}

const SIMULATED_TIMESTAMP = '2026-11-15T08:00:00.000Z'

const soilReadings: Record<SoilPreset, Omit<SimulatedSoilReading, 'preset'>> = {
  dry: {
    ph: 6.3,
    n: 24,
    p: 18,
    k: 110,
    moisturePct: 18,
    source: 'SIMULATED_IOT',
    timestamp: SIMULATED_TIMESTAMP,
    provenanceNote: 'Illustrative preset values only; no physical sensor is connected.',
    metrics: {
      ph: { unit: 'pH', min: 0, max: 14 },
      n: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      p: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      k: { unit: 'mg/kg (illustrative)', min: 0, max: 500 },
      moisturePct: { unit: '%', min: 0, max: 100 },
    },
  },
  normal: {
    ph: 6.7,
    n: 42,
    p: 28,
    k: 145,
    moisturePct: 42,
    source: 'SIMULATED_IOT',
    timestamp: SIMULATED_TIMESTAMP,
    provenanceNote: 'Illustrative preset values only; no physical sensor is connected.',
    metrics: {
      ph: { unit: 'pH', min: 0, max: 14 },
      n: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      p: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      k: { unit: 'mg/kg (illustrative)', min: 0, max: 500 },
      moisturePct: { unit: '%', min: 0, max: 100 },
    },
  },
  wet: {
    ph: 6.9,
    n: 51,
    p: 31,
    k: 160,
    moisturePct: 76,
    source: 'SIMULATED_IOT',
    timestamp: SIMULATED_TIMESTAMP,
    provenanceNote: 'Illustrative preset values only; no physical sensor is connected.',
    metrics: {
      ph: { unit: 'pH', min: 0, max: 14 },
      n: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      p: { unit: 'mg/kg (illustrative)', min: 0, max: 200 },
      k: { unit: 'mg/kg (illustrative)', min: 0, max: 500 },
      moisturePct: { unit: '%', min: 0, max: 100 },
    },
  },
}

export function getSimulatedReading(preset: SoilPreset): SimulatedSoilReading {
  return { ...soilReadings[preset], metrics: { ...soilReadings[preset].metrics }, preset }
}

export type DemoPlantSample = {
  id: string
  title: string
  imageUrl: string
  credit: string
  alt: string
  observation: PlantObservation
}

export const demoPlantSamples: DemoPlantSample[] = [
  {
    id: 'demo-leaf-edges',
    title: 'Pale leaf edges',
    imageUrl: demoLeafEdges,
    credit: 'FarmWise demo illustration; not a field photograph.',
    alt: 'Illustration of a green leaf with pale areas along the edges.',
    observation: {
      sampleId: 'demo-leaf-edges',
      visibleSigns: ['Pale areas along the leaf edges'],
      possibleConcerns: ['Water or nutrient stress are possibilities to check locally.'],
      certaintyNote:
        'This is a demo illustration, not a diagnosis. A photo alone cannot confirm a cause.',
      source: 'DEMO_IMAGE',
    },
  },
  {
    id: 'demo-leaf-holes',
    title: 'Small holes in leaf',
    imageUrl: demoLeafHoles,
    credit: 'FarmWise demo illustration; not a field photograph.',
    alt: 'Illustration of a green leaf with several small holes.',
    observation: {
      sampleId: 'demo-leaf-holes',
      visibleSigns: ['Several small holes in the leaf surface'],
      possibleConcerns: ['Insect feeding or physical damage are possibilities to inspect locally.'],
      certaintyNote:
        'This is a demo illustration, not a diagnosis. Local inspection is needed to understand the cause.',
      source: 'DEMO_IMAGE',
    },
  },
]

export function evaluateSamplePhoto(sampleId: string): PlantObservation | null {
  return demoPlantSamples.find((sample) => sample.id === sampleId)?.observation ?? null
}
