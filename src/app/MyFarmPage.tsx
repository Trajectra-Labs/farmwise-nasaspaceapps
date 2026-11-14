import { useState } from 'react'
import { Card } from '../ui'
import { FarmMapPicker } from '../features/farm-map'
import { SoilSensorsPanel } from '../features/soil'

/** Provisional My Farm route: composes Ted's map and Abdullah's soil panel. Farm Details (Genemor) is not built yet. */
export function MyFarmPage() {
  const [coords, setCoords] = useState<{ lat: number | null; lon: number | null }>({
    lat: null,
    lon: null,
  })
  return (
    <>
      <h1>My Farm</h1>
      <Card title="Farm Details">
        <p>Placeholder - owned by Genemor. Farm details editing is not built yet.</p>
      </Card>
      <Card title="Location">
        <FarmMapPicker value={coords} onChange={setCoords} />
      </Card>
      <SoilSensorsPanel />
    </>
  )
}
