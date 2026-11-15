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
  it('has one h1 "Data & Evidence" with a "Your climate, {farm}" title and the required sections', () => {
    render(<EvidencePage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Data & Evidence' })).toBeInTheDocument()
    expect(screen.getByText('Your climate, Nakuru demo farm, Kenya', { selector: 'p' })).toBeInTheDocument()
    for (const name of ['What this means for your farm', 'Where FarmWise uses this', 'A typical year', 'Details and sources']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('states in the header that the numbers are historical, regional and not a forecast', () => {
    render(<EvidencePage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    const header = h1.closest('header') as HTMLElement
    expect(within(header).getByText('NASA offline snapshot')).toBeInTheDocument()
    expect(header).toHaveTextContent(/NASA POWER monthly data, 2014\u20132023\. Snapshot retrieved \d{1,2} [A-Z][a-z]{2} \d{4}/)
    expect(header).toHaveTextContent(/regional average, not a forecast and not a measurement from your field/)
  })

  it('orders sections: findings, uses, typical year, details and the five reference sections', () => {
    render(<EvidencePage />)
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual([
      'What this means for your farm',
      'Where FarmWise uses this',
      'A typical year',
      'Details and sources',
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
    expect(links).toHaveLength(9)
    for (const a of links) {
      const id = a.getAttribute('href')?.replace('#', '') ?? ''
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('keeps reference sections in closed disclosures, each with a summary label', () => {
    render(<EvidencePage />)
    const details = Array.from(document.querySelectorAll('details'))
    expect(details.map((d) => d.querySelector('summary')?.textContent)).toEqual([
      'Data sources',
      'Field sensors',
      'Other NASA datasets: not used',
      'How to read this',
      'Limitations',
    ])
    for (const d of details) expect(d.open).toBe(false)
  })
})

describe('summary strip', () => {
  it('shows four figures from the snapshot with units', () => {
    render(<EvidencePage />)
    const strip = screen.getByRole('region', { name: 'Summary' })
    const get = (label: string) => within(strip).getByText(label).closest('div') as HTMLElement
    expect(get('Mean annual rain')).toHaveTextContent(/\d,\d{3} mm/)
    expect(get('Mean annual rain')).toHaveTextContent('Mean of 10 complete years')
    expect(get('Driest to wettest year')).toHaveTextContent('914\u20132,164 mm')
    expect(get('Driest to wettest year')).toHaveTextContent('2014 driest, 2020 wettest')
    expect(get('Rainy seasons')).toHaveTextContent(/^Rainy seasons2/)
    expect(get('Rainy seasons')).toHaveTextContent('long rains Mar\u2013May, short rains Sep\u2013Dec')
    expect(get('Mean temperature')).toHaveTextContent(/\d+\.\d \u00b0C/)
    expect(strip).toHaveTextContent('NASA POWER snapshot, 2014\u20132023, regional grid average')
  })

  it('shows Not available rather than a number when there is no data', () => {
    render(<EvidencePage climate={normalizePower({})} />)
    const strip = screen.getByRole('region', { name: 'Summary' })
    expect(within(strip).getAllByText('Not available')).toHaveLength(4)
    expect(strip.textContent).not.toMatch(/\b0\b/)
  })
})

describe('insights', () => {
  it('shows a card per finding with the calculated numbers, a source caption and a link to the screen that uses it', () => {
    render(<EvidencePage />)
    const section = screen.getByRole('heading', { level: 2, name: 'What this means for your farm' }).closest('section') as HTMLElement
    const cards = within(section).getAllByRole('heading', { level: 3 })
    expect(cards).toHaveLength(4)
    const text = section.textContent ?? ''
    for (const s of ['April', '9 of 10', 'March', '3 of 10', '914 mm', '2,164 mm', '25%', 'under 29 \u00b0C', 'about 4.5 \u00b0C']) expect(text).toContain(s)
    expect(within(section).getAllByText('Calculated from NASA snapshot')).toHaveLength(4)
    const links = within(section).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Used in Rotation Planner', '/rotation'],
      ['Used in Rotation Planner', '/rotation'],
      ['Used in Scenario Studio', '/scenarios'],
      ['Used in Rotation Planner', '/rotation'],
    ])
  })

  it('shows an empty state, not a guess, when the snapshot has no data', () => {
    render(<EvidencePage climate={normalizePower({})} />)
    expect(screen.getByText('No findings to show')).toBeInTheDocument()
  })

  it('lists where FarmWise uses the climate data', () => {
    render(<EvidencePage />)
    const section = screen.getByRole('heading', { level: 2, name: 'Where FarmWise uses this' }).closest('section') as HTMLElement
    expect(within(section).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Rotation Planner', '/rotation'],
      ['Scenario Studio', '/scenarios'],
      ['Dashboard', '/'],
    ])
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
    const section = screen.getByRole('heading', { level: 2, name: 'Other NASA datasets: not used' }).closest('details') as HTMLElement
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

async function openTab(name: string) {
  await userEvent.click(screen.getByRole('tab', { name }))
}

describe('climate tabs', () => {
  it('uses ARIA tabs with roving tabindex and arrow-key navigation', async () => {
    render(<EvidencePage />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Typical year', 'Every year', 'Temperature'])
    expect(screen.getByRole('tablist', { name: 'Climate charts' })).toBeInTheDocument()
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id)
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id)

    tabs[0]!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    await userEvent.keyboard('{End}')
    expect(tabs[2]).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(tabs[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(tabs[2]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(tabs[0]).toHaveFocus()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })
})

describe('season calendar (typical year tab)', () => {
  it('is the default tab, with legend, summary and a 12-month data table by season', async () => {
    render(<EvidencePage />)
    const fig = screen.getByRole('heading', { level: 3, name: 'Typical year by season' }).closest('figure') as HTMLElement
    expect(within(fig).getByText(/NASA snapshot \u00b7 \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeInTheDocument()
    const legend = within(fig).getByRole('list', { name: 'Chart legend' })
    expect(legend).toHaveTextContent('Long rains, Mar\u2013May')
    expect(legend).toHaveTextContent('Short rains, Sep\u2013Dec')
    expect(legend).toHaveTextContent('Wettest year')
    expect(legend).toHaveTextContent('Driest year')
    expect(fig).toHaveTextContent(/Summary:/)
    expect(fig).toHaveTextContent(/not a forecast/)
    await userEvent.click(within(fig).getByRole('button', { name: /Show data table/ }))
    const table = screen.getByRole('table', { name: /Average, lowest and highest monthly rainfall/ })
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    expect(within(table).getByRole('row', { name: /Apr/ })).toHaveTextContent('Long rains')
    expect(within(table).getByRole('row', { name: /Nov/ })).toHaveTextContent('Short rains')
    expect(within(table).getByRole('row', { name: /Jul/ })).toHaveTextContent('Below 100 mm on average')
  })

  it('shows unknown months as Unknown in the table, never 0', async () => {
    const raw: PowerResponse = {
      header: { fill_value: -999 },
      parameters: { PRECTOTCORR: { units: 'mm/day' }, T2M: { units: 'C' } },
      properties: { parameter: { PRECTOTCORR: { '202001': 1 }, T2M: {}, T2M_MAX: {}, T2M_MIN: {} } },
    }
    render(<EvidencePage climate={normalizePower(raw)} />)
    await userEvent.click(screen.getByRole('button', { name: /Show data table/ }))
    const table = screen.getByRole('table', { name: /Average, lowest and highest monthly rainfall/ })
    const feb = within(table).getByRole('row', { name: /Feb/ })
    expect(within(feb).getAllByText('Unknown')).toHaveLength(3)
  })
})

describe('climate charts (E02, E07, E08)', () => {
  it('shows the rainfall charts on Every year and temperature on Temperature, each with badge, summary and data table toggle', async () => {
    render(<EvidencePage />)
    await openTab('Every year')
    for (const title of ['Monthly rainfall', 'Annual rainfall']) {
      const fig = screen.getByRole('heading', { level: 3, name: title }).closest('figure') as HTMLElement
      expect(within(fig).getByText(/NASA snapshot \u00b7 \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeInTheDocument()
      expect(fig).toHaveTextContent(/Summary:/)
      expect(fig).toHaveTextContent('2014\u20132023')
    }
    expect(screen.queryByRole('heading', { level: 3, name: 'Monthly temperature' })).not.toBeInTheDocument()
    const toggles = screen.getAllByRole('button', { name: /Show data table/ })
    expect(toggles).toHaveLength(2)
    await userEvent.click(toggles[0]!)
    const table = screen.getByRole('table', { name: /Monthly rainfall from NASA POWER/ })
    expect(within(table).getAllByRole('row')).toHaveLength(121)
    expect(within(table).getByRole('columnheader', { name: 'Rainfall (mm)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide data table/ })).toHaveAttribute('aria-expanded', 'true')

    await openTab('Temperature')
    const fig = screen.getByRole('heading', { level: 3, name: 'Monthly temperature' }).closest('figure') as HTMLElement
    expect(fig).toHaveTextContent(/Summary:/)
    expect(within(fig).getByText(/NASA snapshot/)).toBeInTheDocument()
    await userEvent.click(within(fig).getByRole('button', { name: /Show data table/ }))
    expect(within(screen.getByRole('table', { name: /Monthly air temperature at 2 m/ })).getAllByRole('row')).toHaveLength(121)
  })

  it('renders the annual table with 10 complete years', async () => {
    render(<EvidencePage />)
    await openTab('Every year')
    await userEvent.click(screen.getAllByRole('button', { name: /Show data table/ })[1]!)
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
    await openTab('Every year')
    const buttons = screen.getAllByRole('button', { name: /Show data table/ })
    await userEvent.click(buttons[0]!)
    const rain = screen.getByRole('table', { name: /Monthly rainfall/ })
    const jan = within(rain).getByRole('row', { name: /Jan 2020/ })
    expect(jan).toHaveTextContent('Unknown')
    expect(jan).not.toHaveTextContent(/\b0\b/)
    await userEvent.click(buttons[1]!)
    const annual = screen.getByRole('table', { name: /Annual rainfall totals/ })
    expect(within(annual).getByRole('row', { name: /2020/ })).toHaveTextContent('Unknown')
    expect(screen.getAllByText(/No complete year/).length).toBeGreaterThan(0)
  })

  it('shows an empty state when the snapshot has no data', () => {
    render(<EvidencePage climate={normalizePower({})} />)
    expect(screen.getByText('No climate data in the snapshot')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show data table/ })).not.toBeInTheDocument()
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
