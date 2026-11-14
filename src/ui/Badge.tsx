import type { SourceKind } from '../contracts/farmwise'
import './ui.css'

export const SOURCE_LABELS: Record<SourceKind, string> = {
  NASA_OBSERVED: 'NASA observed',
  NASA_OFFLINE_SNAPSHOT: 'NASA offline snapshot',
  SIMULATED_IOT: 'Simulated sensor',
  FARMER_REPORTED: 'Farmer input',
  USER_SOIL_TEST: 'User soil test',
  DEMO_IMAGE: 'Demo example',
  MODEL_ESTIMATE: 'Model estimate',
}

export type BadgeProps = { source: SourceKind } | { source?: undefined; label: string }

export function Badge(props: BadgeProps) {
  if (props.source) {
    return (
      <span className={`fw-badge fw-badge--${props.source}`}>{SOURCE_LABELS[props.source]}</span>
    )
  }
  return <span className="fw-badge">{props.label}</span>
}
