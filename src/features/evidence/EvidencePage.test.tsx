import { render as rtlRender, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'
import { normalizePower, type PowerResponse } from '../../data/nasa/normalize'
import { EvidencePage } from './EvidencePage'
import { UNUSED_SOURCES } from './unusedSources'

function render(ui: ReactElement) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeAll(() => {
  // Recharts warns that jsdom containers have no size; the data tables carry the assertions here.
  const warn = console.warn.bind(console)
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
    if (!String(a[0]).includes('of chart should be greater than 0')) warn(...a)
  })
  // jsdom has no ResizeObserver, which Recharts' ResponsiveContainer needs.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name })
  return heading.closest('section') as HTMLElement
}

describe('EvidencePage structure', () => {
  it('has one h1 "Data & Evidence" and the required sections', () => {
    render(<EvidencePage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Data & Evidence' })).toBeInTheDocument()
    for (const name of ['Data sources', 'Climate history', 'Key figures', 'How to read this', 'Limitations']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('orders sections: figures, charts, NASA POWER, field sensors, unused datasets, how to read, limits', () => {
    render(<EvidencePage />)
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual([
      'Key figures',
      'Climate history',
      'Data sources',
      'Field sensors',
      'Other NASA datasets: not used',
      'How to read this',
      'Limitations',
    ])
  })

  it('has an in-page contents list whose links point at existing section ids', () => {
    render(<EvidencePage />)
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(7)
    for (const a of links) {
      const id = a.getAttribute('href')?.replace('#', '') ?? ''
      expect(document.getElementById(id)).not.toBeNull()
    }
  })
})

describe('source cards (E01, E03)', () => {
  it('shows the NASA POWER card as used, with coordinates, period, parameters and units', () => {
    render(<EvidencePage />)
    const card = cardFor('NASA POWER')
    expect(within(card).getByText(/Used \u00b7 offline snapshot retrieved \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeInTheDocument()
    expect(card).toHaveTextContent('2014\u20132023')
    expect(card).toHaveTextContent('-0.3031, 36.08')
    expect(card).toHaveTextContent('PRECTOTCORR: Precipitation Corrected, mm/day')
    expect(card).toHaveTextContent('T2M: Temperature at 2 Meters, \u00b0C')
    expect(card).toHaveTextContent(/0\.5.*0\.625/)
    expect(card.textContent).not.toMatch(/, C\b/)
  })

  it('lists SMAP, GPM IMERG, MODIS, Landsat and ECOSTRESS in one compact card, each Not used, with no values', () => {
    render(<EvidencePage />)
    expect(UNUSED_SOURCES.map((s) => s.name)).toEqual(['SMAP', 'GPM IMERG', 'MODIS', 'Landsat', 'ECOSTRESS'])
    const section = screen.getByRole('heading', { level: 2, name: 'Other NASA datasets: not used' }).closest('section') as HTMLElement
    const rows = within(section).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    UNUSED_SOURCES.forEach((s, i) => {
      const row = rows[i]!
      expect(row).toHaveTextContent(s.name)
      expect(within(row).getByText('Not used')).toBeInTheDocument()
      expect(within(row).getByRole('link', { name: s.linkText })).toBeInTheDocument()
      expect(row.textContent).not.toMatch(/\d/)
      expect(row.textContent).not.toMatch(/\bUsed\b/)
    })
    expect(screen.queryByRole('heading', { level: 3, name: 'SMAP' })).not.toBeInTheDocument()
    // The section h2 is the only title; the card does not repeat it.
    expect(screen.getAllByText('Other NASA datasets: not used', { selector: 'h1,h2,h3,h4' })).toHaveLength(1)
    expect(within(section).queryAllByRole('heading', { level: 3 })).toHaveLength(0)
    expect(within(section).getByText(/has not retrieved any of these/)).toBeInTheDocument()
  })
})

describe('field sensors card', () => {
  it('compares the NASA POWER grid with a simulated field sensor and links to My Farm', () => {
    render(<EvidencePage />)
    const card = cardFor('NASA POWER grid compared with a field sensor')
    expect(card).toHaveTextContent(/0\.5\u00b0 \u00d7 0\.625\u00b0/)
    expect(card).toHaveTextContent(/No physical sensor is connected/)
    expect(card).toHaveTextContent(/adapter/)
    expect(card).toHaveTextContent(/never as NASA data/)
    expect(card).toHaveTextContent(/soil preset, not each simulated update/)
    expect(within(card).getByText('Simulated sensor')).toBeInTheDocument()
    expect(within(card).getByText('NASA offline snapshot')).toBeInTheDocument()
    const table = within(card).getByRole('table')
    for (const label of ['Coverage', 'What it measures', 'Update pattern', 'How FarmWise labels it']) {
      expect(within(table).getByRole('rowheader', { name: label })).toBeInTheDocument()
    }
    expect(within(card).getByRole('link', { name: /My Farm/ })).toHaveAttribute('href', '/farm')
  })
})

describe('source links (E04)', () => {
  it('are https, open in a new tab safely, and have descriptive text', () => {
    render(<EvidencePage />)
    const links = screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('https:'))
    expect(links.length).toBeGreaterThanOrEqual(8)
    expect(screen.getAllByRole('link').length).toBeGreaterThan(links.length)
    for (const a of links) {
      const href = a.getAttribute('href') ?? ''
      expect(() => new URL(href)).not.toThrow()
      expect(new URL(href).protocol).toBe('https:')
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toMatch(/noopener/)
      const text = a.textContent?.trim() ?? ''
      expect(text.split(/\s+/).length).toBeGreaterThanOrEqual(3)
      expect(text).not.toMatch(/^(click )?here$|^https?:/i)
    }
    const request = screen.getByRole('link', { name: /Exact NASA POWER request/ })
    expect(request.getAttribute('href')).toContain('power.larc.nasa.gov/api/temporal/monthly/point')
  })
})

describe('climate charts (E02, E07, E08)', () => {
  it('shows three charts with the snapshot badge, unit axes captions and data table toggles', async () => {
    render(<EvidencePage />)
    for (const title of ['Monthly rainfall', 'Monthly temperature', 'Annual rainfall']) {
      const fig = screen.getByRole('heading', { level: 3, name: title }).closest('figure') as HTMLElement
      expect(within(fig).getByText(/NASA snapshot \u00b7 \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeInTheDocument()
      expect(fig).toHaveTextContent(/Summary:/)
      expect(fig).toHaveTextContent('2014\u20132023')
    }
    const toggles = screen.getAllByRole('button', { name: /Show data table/ })
    expect(toggles).toHaveLength(3)
    await userEvent.click(toggles[0]!)
    const table = screen.getByRole('table', { name: /Monthly rainfall from NASA POWER/ })
    expect(within(table).getAllByRole('row')).toHaveLength(121)
    expect(within(table).getByRole('columnheader', { name: 'Rainfall (mm)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide data table/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders the annual table with 10 complete years', async () => {
    render(<EvidencePage />)
    await userEvent.click(screen.getAllByRole('button', { name: /Show data table/ })[2]!)
    const table = screen.getByRole('table', { name: /Annual rainfall totals/ })
    expect(within(table).getAllByRole('row')).toHaveLength(11)
  })

  it('shows missing months as Unknown, never 0, and drops the annual total for incomplete years', async () => {
    const raw: PowerResponse = {
      header: { fill_value: -999 },
      parameters: { PRECTOTCORR: { units: 'mm/day' }, T2M: { units: 'C' } },
      properties: {
        parameter: {
          PRECTOTCORR: { '202001': -999, '202002': 1, '202003': 1 },
          T2M: { '202001': 18, '202002': -999, '202003': 19 },
          T2M_MAX: {},
          T2M_MIN: {},
        },
      },
    }
    render(<EvidencePage climate={normalizePower(raw)} />)
    const buttons = screen.getAllByRole('button', { name: /Show data table/ })
    await userEvent.click(buttons[0]!)
    const rain = screen.getByRole('table', { name: /Monthly rainfall/ })
    const jan = within(rain).getByRole('row', { name: /Jan 2020/ })
    expect(jan).toHaveTextContent('Unknown')
    expect(jan).not.toHaveTextContent(/\b0\b/)
    await userEvent.click(buttons[2]!)
    const annual = screen.getByRole('table', { name: /Annual rainfall totals/ })
    expect(within(annual).getByRole('row', { name: /2020/ })).toHaveTextContent('Unknown')
    expect(screen.getAllByText(/No complete year/).length).toBeGreaterThan(0)
  })

  it('shows an empty state when the snapshot has no data', () => {
    render(<EvidencePage climate={normalizePower({})} />)
    expect(screen.getByText('No climate data in the snapshot')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show data table/ })).not.toBeInTheDocument()
  })
})

describe('key figures', () => {
  it('shows rainfall, temperature and wettest/driest month with provenance and period', () => {
    render(<EvidencePage />)
    const rain = cardFor('Mean annual rainfall')
    expect(rain).toHaveTextContent(/\d[\d,]* mm per year/)
    expect(rain).toHaveTextContent('NASA offline snapshot')
    expect(rain).toHaveTextContent('10 complete years')
    expect(cardFor('Mean air temperature')).toHaveTextContent(/\d+\.\d \u00b0C/)
    expect(cardFor('Wettest month on average')).toHaveTextContent(/April|May|March|November|December/)
    expect(cardFor('Driest month on average')).toHaveTextContent('2014\u20132023')
  })

  it('shows Unknown rather than a number when there is no data', () => {
    render(<EvidencePage climate={normalizePower({})} />)
    expect(cardFor('Mean annual rainfall')).toHaveTextContent('Unknown')
    expect(cardFor('Mean air temperature')).toHaveTextContent('Unknown')
  })
})

describe('explanations (E05, E06, E10)', () => {
  it('explains score vs confidence, satellite vs soil scale, and that disease is not diagnosed', () => {
    render(<EvidencePage />)
    const score = cardFor('Score and confidence are separate')
    expect(score).toHaveTextContent(/relative ranking from 0 to 100/)
    expect(score).toHaveTextContent(/how complete and reliable the inputs/)
    const scale = cardFor('Satellite data and soil readings are different scales')
    expect(scale).toHaveTextContent(/soil test/)
    expect(scale).toHaveTextContent(/0\.5\u00b0 by 0\.625\u00b0/)
    expect(screen.getByText(/does not diagnose plant disease/)).toBeInTheDocument()
    expect(screen.getByText(/not a weather forecast/)).toBeInTheDocument()
  })

  it('defines every source label', () => {
    render(<EvidencePage />)
    const card = cardFor('What the source labels mean')
    for (const t of ['NASA observed', 'NASA offline snapshot', 'Simulated sensor', 'Farmer input', 'Your soil test', 'Demo example', 'Model estimate']) {
      expect(within(card).getByText(t)).toBeInTheDocument()
    }
  })

  it('lists limitations', () => {
    render(<EvidencePage />)
    const card = cardFor('Known limits of this data')
    expect(within(card).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    expect(card).toHaveTextContent(/Grid averaging/)
    expect(card).toHaveTextContent(/No field check/)
    expect(card).toHaveTextContent(/Data gaps/)
  })
})

describe('copy rules', () => {
  it('has no "real-time", "live", "AI-powered" or emoji, and "forecast" only in negations', () => {
    const { container } = render(<EvidencePage />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/real-?time|\blive\b|AI-powered|\bsmart\b|magic/i)
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
    const sentences = text.split(/(?<=[.!?])\s+/)
    for (const s of sentences.filter((x) => /forecast/i.test(x))) expect(s).toMatch(/\bnot\b|\bno\b/i)
  })
})
