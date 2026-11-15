import { describe, expect, it } from 'vitest'
import { answerQuestion, matchIntent, type AssistantContext } from './answers'
import { SAMPLE_FARM } from '@/core/sampleFarm'
import { getClimateContext } from '@/data/nasa'
import { getSimulatedReading } from '@/data/simulated'
import { evaluateRotations } from '@/logic/agronomy'

function ctx(over: Partial<AssistantContext> = {}): AssistantContext {
  const climate = getClimateContext(SAMPLE_FARM)
  const soil = getSimulatedReading('normal')
  return {
    farm: SAMPLE_FARM,
    evaluation: evaluateRotations(SAMPLE_FARM, climate, soil),
    climate,
    soil,
    soilPreset: 'normal',
    activePlanId: 'current',
    scenario: { rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigationPct: 100, inputCostDeltaPct: 0 },
    plantObservation: null,
    ...over,
  }
}

describe('assistant answers use the actual farm state', () => {
  it('recommends the highest-scoring feasible plan with its real score', () => {
    const c = ctx()
    const best = c.evaluation!.plans.find((p) => p.id === c.evaluation!.recommendedId)!
    const a = answerQuestion('What should I change first?', c)
    expect(a).toContain(`${best.score}/100`)
    expect(a).toMatch(/not a guarantee/)
  })

  it('answers from the scenario sliders and labels the result as a model estimate', () => {
    const c = ctx({ scenario: { rainfallDeltaPct: -20, temperatureDeltaC: 2, irrigationPct: 100, inputCostDeltaPct: 0 } })
    const a = answerQuestion('What happens in my current scenario?', c)
    expect(a).toContain('rainfall -20%')
    expect(a).toMatch(/model estimate|model estimates/)
    expect(a).toMatch(/not predictions/)
  })

  it('says the soil is simulated unless a soil test is on file', () => {
    expect(answerQuestion('what do my soil readings mean', ctx({ soilPreset: 'wet' }))).toMatch(/simulated "wet"/)
    const test = { ph: 6.1, moisturePct: 30, source: 'USER_SOIL_TEST' as const }
    expect(answerQuestion('soil', ctx({ soil: test }))).toMatch(/soil test you entered/)
  })

  it('does not invent a diagnosis when no plant check has been done', () => {
    expect(answerQuestion('What did my last plant check show?', ctx())).toMatch(/not run a Plant Check|have not run/)
  })

  it('refuses NASA claims for a location without snapshot values', () => {
    const farm = { ...SAMPLE_FARM, lat: 51.5, lon: -0.1 }
    const c = ctx({ farm, climate: getClimateContext(farm) })
    expect(answerQuestion('is my farm ready for a dry season', c)).toMatch(/do not have NASA climate values/)
  })

  it('handles no farm and unsupported questions honestly', () => {
    expect(answerQuestion('anything', ctx({ farm: null }))).toMatch(/no farm set up/i)
    expect(answerQuestion('lottery numbers', ctx())).toMatch(/cannot give pest or disease diagnoses/)
    expect(matchIntent('lottery numbers')).toBeNull()
  })
})
