import { act, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './routes'
import { FarmWiseProvider } from '../core'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <FarmWiseProvider>
      <RouterProvider router={router} />
    </FarmWiseProvider>,
  )
}

describe('AppShell', () => {
  it('renders primary nav with all six destinations', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const names = ['Dashboard', 'My Farm', 'Rotation', 'Scenarios', 'Plant Check', 'Data & Evidence']
    for (const name of names) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(6)
  })

  it('shows Data & Evidence at /evidence', () => {
    renderAt('/evidence')
    expect(screen.getByRole('heading', { level: 1, name: 'Data & Evidence' })).toBeInTheDocument()
    expect(screen.getByText('NASA POWER snapshot not loaded yet')).toBeInTheDocument()
  })

  it('links the FarmWise brand to the Dashboard in header and sidebar', () => {
    renderAt('/evidence')
    const brands = screen.getAllByRole('link', { name: 'FarmWise' })
    expect(brands).toHaveLength(2)
    for (const a of brands) expect(a).toHaveAttribute('href', '/')
  })

  it('follows OS theme changes live when no theme is stored, and cleans up', () => {
    window.localStorage.removeItem('farmwise-theme')
    let listener: ((e: MediaQueryListEvent) => void) | undefined
    const removeEventListener = vi.fn()
    const mql = {
      matches: false,
      addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
        listener = l
      },
      removeEventListener,
    }
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue(mql)
    try {
      const { unmount } = renderAt('/')
      expect(screen.getByRole('button', { name: 'Switch to dark theme' })).not.toHaveAttribute(
        'aria-pressed',
      )
      act(() => listener?.({ matches: true } as MediaQueryListEvent))
      expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
      unmount()
      expect(removeEventListener).toHaveBeenCalled()
    } finally {
      window.matchMedia = original
    }
  })

  it('shows a 404 page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
