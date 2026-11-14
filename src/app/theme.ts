import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'farmwise-theme'

function readStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Explicit choice is stored; with no choice, data-theme stays unset so the OS preference applies. */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    if (stored) root.setAttribute('data-theme', stored)
    else root.removeAttribute('data-theme')
  }, [stored])

  const [system, setSystem] = useState<Theme>(systemTheme)

  // Follow the OS live while the user has no explicit choice.
  useEffect(() => {
    let mql: MediaQueryList | undefined
    try {
      mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    if (!mql) return
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light')
    try {
      mql.addEventListener('change', onChange)
    } catch {
      return
    }
    return () => {
      try {
        mql.removeEventListener('change', onChange)
      } catch {
        // Nothing to clean up.
      }
    }
  }, [])

  const theme: Theme = stored ?? system

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setStored(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode, quota): the choice still applies for this session.
    }
  }, [theme])

  return { theme, toggle }
}
