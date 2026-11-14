import { Link } from 'react-router-dom'
import { Badge, Card } from '../../ui'

type Row = { label: string; nasa: React.ReactNode; sensor: React.ReactNode }

const ROWS: Row[] = [
  {
    label: 'Coverage',
    nasa: 'A grid area of about 0.5\u00b0 \u00d7 0.625\u00b0, which is tens of kilometres across.',
    sensor: 'One spot in one field.',
  },
  {
    label: 'What it measures',
    nasa: 'Area averages of rainfall and air temperature, built from satellite and weather-model data.',
    sensor: 'Conditions at that spot, such as soil moisture and soil temperature.',
  },
  {
    label: 'Update pattern',
    nasa: 'Monthly values from past years, saved once with the app. They do not change while you use it.',
    sensor: 'Simulated values made by the app. No device sends them.',
  },
  {
    label: 'How FarmWise labels it',
    nasa: <Badge source="NASA_OFFLINE_SNAPSHOT" />,
    sensor: <Badge source="SIMULATED_IOT" />,
  },
]

export function FieldSensors() {
  return (
    <Card title="NASA POWER grid compared with a field sensor" headingLevel={3} className="ev-prose">
      <p>
        The field sensor readings in FarmWise are simulated. They appear under{' '}
        <Link to="/farm">My Farm › Soil &amp; Sensors</Link>. No physical sensor is connected.
      </p>
      <div className="ev-compare-wrap">
        <table className="ev-compare">
          <caption className="ev-visually-hidden">NASA POWER grid compared with a field sensor</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="ev-visually-hidden">Property</span>
              </th>
              <th scope="col">NASA POWER grid</th>
              <th scope="col">Field sensor</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td data-label="NASA POWER grid">{r.nasa}</td>
                <td data-label="Field sensor">{r.sensor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="ev-list">
        <li>
          The app reads sensors through an adapter, so a real gateway could be connected later. It
          would appear with its own label and never as NASA data.
        </li>
        <li>Scores use the soil preset, not each simulated update.</li>
      </ul>
    </Card>
  )
}
