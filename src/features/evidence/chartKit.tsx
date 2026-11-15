import type { TooltipContentProps } from 'recharts'
import { formatNumber, UNKNOWN } from './format'

export const AXIS = { fontSize: 12, fill: 'var(--color-text-2)' } as const
export const GRID = 'var(--color-border)'
export const S1 = 'var(--color-accent)'
export const S2 = 'var(--fm-series-2)'
export const S3 = 'var(--fm-series-3)'
export const INITIAL = { width: 640, height: 280 }

export type Row = { key: string; cells: (string | null)[] }

export function makeTooltip(unit: string, digits: number, badgeLabel: string, labelFor: (l: string) => string) {
  return function ChartTooltip({ active, payload, label }: TooltipContentProps<number | string | readonly (number | string)[], string | number>) {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="ev-tooltip">
        <p>
          <strong>{labelFor(String(label))}</strong>
        </p>
        {payload.map((p) => (
          <p key={String(p.name)}>
            {p.name}: {typeof p.value === 'number' ? `${formatNumber(p.value, digits)} ${unit}` : UNKNOWN}
          </p>
        ))}
        <p className="ev-unknown">{badgeLabel}</p>
      </div>
    )
  }
}
