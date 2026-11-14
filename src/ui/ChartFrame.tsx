import { useId, type ReactNode } from 'react'
import type { SourceKind } from '../contracts/farmwise'
import { Badge } from './Badge'
import './ui.css'

export type ChartFrameProps = {
  title: string
  source: SourceKind
  caption: string
  /** Required text alternative of what the chart shows, for keyboard and screen reader users. */
  summary: string
  children?: ReactNode
}

export function ChartFrame({ title, source, caption, summary, children }: ChartFrameProps) {
  const summaryId = useId()
  return (
    <figure className="fw-card" aria-labelledby={`${summaryId}-t`} style={{ margin: 0 }}>
      <div className="fw-chart__header">
        <h3 id={`${summaryId}-t`} className="fw-card__title">
          {title}
        </h3>
        <Badge source={source} />
      </div>
      <div className="fw-chart__body" role="img" aria-describedby={summaryId}>
        {children}
      </div>
      <p id={summaryId}>
        <strong>Summary: </strong>
        {summary}
      </p>
      <figcaption className="fw-chart__caption">{caption}</figcaption>
    </figure>
  )
}
