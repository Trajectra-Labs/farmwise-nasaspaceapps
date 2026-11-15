import { CalendarDays, ChartColumn, CloudRain, Thermometer, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Insight } from '../../data/nasa/insights'
import { Card } from '../../ui'

const ICONS: Record<Insight['id'], LucideIcon> = {
  'start-month': CalendarDays,
  'two-seasons': CloudRain,
  variability: ChartColumn,
  temperature: Thermometer,
}

/** One card per finding. Every number in the text is calculated from the snapshot; nothing here is hand-written. */
export function InsightCards({ insights }: { insights: Insight[] }) {
  return (
    <div className="ev-grid ev-insights">
      {insights.map((insight) => {
        const Icon = ICONS[insight.id]
        return (
          <Card key={insight.id} title={insight.title} headingLevel={3} className="ev-insight">
            <span className="ev-insight__icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <p className="ev-insight__body">{insight.body}</p>
            <p className="ev-caption">Calculated from NASA snapshot</p>
            <Link className="ev-insight__link" to={insight.link.to}>
              Used in {insight.link.label}
            </Link>
          </Card>
        )
      })}
    </div>
  )
}
