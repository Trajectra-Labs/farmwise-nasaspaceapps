import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type MapViewProps = {
  position: { lat: number; lon: number } | null
  onPick: (lat: number, lon: number) => void
  onTileError: () => void
  onTileLoad: () => void
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'

// A CSS-drawn marker avoids bundling Leaflet's default PNG icons.
const pinIcon = L.divIcon({ className: 'fm-pin', iconSize: [20, 20], iconAnchor: [10, 10] })

function ClickToPick({ onPick }: Pick<MapViewProps, 'onPick'>) {
  useMapEvents({
    click(e) {
      const ll = e.latlng.wrap()
      onPick(ll.lat, ll.lng)
    },
  })
  return null
}

function Recenter({ position }: Pick<MapViewProps, 'position'>) {
  const map = useMap()
  const lat = position?.lat
  const lon = position?.lon
  useEffect(() => {
    if (lat === undefined || lon === undefined) return
    map.setView([lat, lon], Math.max(map.getZoom(), 8), { animate: false })
  }, [map, lat, lon])
  return null
}

export default function MapView({ position, onPick, onTileError, onTileLoad }: MapViewProps) {
  return (
    <MapContainer
      center={position ? [position.lat, position.lon] : [10, 10]}
      zoom={position ? 8 : 2}
      minZoom={2}
      worldCopyJump
      scrollWheelZoom={false}
      className="fm-map__canvas"
    >
      <TileLayer
        url={OSM_URL}
        attribution={OSM_ATTRIBUTION}
        maxZoom={19}
        eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      />
      <ClickToPick onPick={onPick} />
      <Recenter position={position} />
      {position ? (
        <Marker
          position={[position.lat, position.lon]}
          icon={pinIcon}
          draggable
          // Keyboard users set the location with the latitude/longitude fields; an unnamed focusable marker would only be a tab stop.
          keyboard={false}
          eventHandlers={{
            dragend(e) {
              const ll = (e.target as L.Marker).getLatLng().wrap()
              onPick(ll.lat, ll.lng)
            },
          }}
        />
      ) : null}
    </MapContainer>
  )
}
