import type { ReactNode } from 'react'
import './ui.css'

export type CardProps = {
  title?: string
  headingLevel?: 2 | 3
  children?: ReactNode
  className?: string
}

export function Card({ title, headingLevel = 2, children, className }: CardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section className={['fw-card', className].filter(Boolean).join(' ')}>
      {title ? <Heading className="fw-card__title">{title}</Heading> : null}
      {children}
    </section>
  )
}
