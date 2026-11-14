import type { ReactNode } from 'react'
import './ui.css'

export type EmptyStateProps = { title: string; description?: string; action?: ReactNode }

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="fw-empty" role="status">
      <p className="fw-empty__title">
        <strong>{title}</strong>
      </p>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}
