import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '../ui'
import { useTheme } from './theme'
import './app.css'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/farm', label: 'My Farm' },
  { to: '/rotation', label: 'Rotation' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/plant', label: 'Plant Check' },
  { to: '/evidence', label: 'Data & Evidence' },
] as const

export function AppShell() {
  const [menuState, setMenuState] = useState<{ open: boolean; path: string }>({
    open: false,
    path: '',
  })
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  // The menu closes automatically when the route changes.
  const menuOpen = menuState.open && menuState.path === pathname

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="shell__header">
        <p className="shell__brand">
          <Link to="/" className="shell__brand-link">
            FarmWise
          </Link>
        </p>
        <Button
          variant="secondary"
          className="shell__menu-button"
          aria-expanded={menuOpen}
          aria-controls="primary-nav-panel"
          onClick={() => setMenuState({ open: !menuOpen, path: pathname })}
        >
          {menuOpen ? 'Close menu' : 'Menu'}
        </Button>
      </header>
      <aside className="shell__sidebar" data-open={menuOpen} id="primary-nav-panel">
        <p className="shell__brand">
          <Link to="/" className="shell__brand-link">
            FarmWise
          </Link>
        </p>
        <nav className="shell__nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className="shell__link">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Button variant="secondary" className="shell__theme" onClick={toggle}>
          {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        </Button>
      </aside>
      <main className="shell__main" id="main-content" tabIndex={-1}>
        <div className="shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
