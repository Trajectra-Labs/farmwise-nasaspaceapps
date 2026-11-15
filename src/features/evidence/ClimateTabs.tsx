import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type TabItem = { id: string; label: string; panel: ReactNode }

/** ARIA tabs with automatic activation: arrow keys, Home and End move focus and selection; only the active tab is in the tab order. */
export function ClimateTabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const base = useId()
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function move(to: number) {
    const next = (to + tabs.length) % tabs.length
    setActive(next)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowRight') move(active + 1)
    else if (e.key === 'ArrowLeft') move(active - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(tabs.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div className="ev-tabs">
      <div role="tablist" aria-label={label} className="ev-tabs__list">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            className="ev-tabs__tab"
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) =>
        i === active ? (
          <div
            key={t.id}
            role="tabpanel"
            id={`${base}-panel-${t.id}`}
            aria-labelledby={`${base}-tab-${t.id}`}
            tabIndex={0}
            className="ev-tabs__panel"
          >
            {t.panel}
          </div>
        ) : null,
      )}
    </div>
  )
}
