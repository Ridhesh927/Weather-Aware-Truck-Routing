import React, { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Clock, CloudRain, ShieldCheck, Snowflake, Wind } from 'lucide-react'
import { CheckpointItem } from './CheckpointTable'

// Make Leaflet globally available in browser environment before leaflet.heat
if (typeof window !== 'undefined') {
  ;(window as unknown as { L: typeof L }).L = L
}

// Dynamically import leaflet.heat if available in client runtime
try {
  import('leaflet.heat')
} catch {
  // Graceful fallback for test runners
}

export interface RouteData {
  id: number
  name: string
  profile: string
  geometry: [number, number][] // [lon, lat] pairs from GeoJSON
  total_miles: number
  total_minutes: number
  summary: {
    total_miles: number
    total_minutes: number
    severe_miles: number
    high_miles: number
    average_risk: number
    blocked: boolean
  }
  checkpoints: CheckpointItem[]
}

interface RouteMapProps {
  origin: { label: string; lat: number; lon: number }
  destination: { label: string; lat: number; lon: number }
  routes: RouteData[]
  recommendedIndex: number | null
  selectedRouteIndex: number
  onSelectRoute: (index: number) => void
  heatmap: { lat: number; lon: number; hourly_risks: string[] }[]
  currentHour: number
  showHeatmap: boolean
  selectedCheckpointId: number | null
  onSelectCheckpoint: (id: number) => void
}

const RISK_WEIGHTS: Record<string, number> = {
  LOW: 0.15,
  MODERATE: 0.4,
  HIGH: 0.7,
  SEVERE: 0.9,
  NO_TRAVEL: 1.0,
}

// Helper to create circular custom icons
function createEndpointIcon(letter: string, bg: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-endpoint-icon',
    html: `<div class="endpoint-pin" style="background: ${bg};"><span>${letter}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function createCheckpointIcon(num: number, level: string, isSelected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-cp-icon',
    html: `<div class="cp-pin cp-pin-${level.toLowerCase()} ${isSelected ? 'cp-selected' : ''}"><span>${num}</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

// Subcomponent: Auto-fit map bounds when routes change
function BoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
      } catch {
        // Safe catch for zero-dimension bounds
      }
    }
  }, [map, bounds])
  return null
}

// Subcomponent: Center on selected checkpoint when selected
function CheckpointPanner({
  checkpoint,
}: {
  checkpoint: CheckpointItem | null | undefined
}) {
  const map = useMap()
  useEffect(() => {
    if (checkpoint) {
      map.panTo([checkpoint.lat, checkpoint.lon], { animate: true, duration: 0.5 })
    }
  }, [map, checkpoint])
  return null
}

// Subcomponent: Reactive Leaflet Heatmap Layer
function HeatmapOverlay({
  heatmap,
  currentHour,
  showHeatmap,
}: {
  heatmap: { lat: number; lon: number; hourly_risks: string[] }[]
  currentHour: number
  showHeatmap: boolean
}) {
  const map = useMap()
  const heatLayerRef = useRef<L.HeatLayer | null>(null)

  // Compute [lat, lon, intensity] array for the selected hour
  const heatPoints = useMemo<[number, number, number][]>(() => {
    if (!showHeatmap || !heatmap || heatmap.length === 0) return []
    return heatmap.map((pt) => {
      const riskTier = (pt.hourly_risks && pt.hourly_risks[currentHour]) || 'LOW'
      const intensity = RISK_WEIGHTS[riskTier] ?? 0.15
      return [pt.lat, pt.lon, intensity]
    })
  }, [heatmap, currentHour, showHeatmap])

  useEffect(() => {
    // Only attach if heatLayer plugin is available on L
    if (typeof (L as unknown as { heatLayer?: unknown }).heatLayer !== 'function') {
      return
    }

    if (!showHeatmap || heatPoints.length === 0) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
      return
    }

    if (!heatLayerRef.current) {
      const layer = L.heatLayer(heatPoints, {
        radius: 35,
        blur: 20,
        maxZoom: 11,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.2: '#22c55e',
          0.4: '#eab308',
          0.65: '#f97316',
          0.85: '#ef4444',
          1.0: '#7f1d1d',
        },
      })
      layer.addTo(map)
      heatLayerRef.current = layer
    } else {
      heatLayerRef.current.setLatLngs(heatPoints)
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [map, heatPoints, showHeatmap])

  return null
}

export const RouteMap: React.FC<RouteMapProps> = ({
  origin,
  destination,
  routes,
  recommendedIndex,
  selectedRouteIndex,
  onSelectRoute,
  heatmap,
  currentHour,
  showHeatmap,
  selectedCheckpointId,
  onSelectCheckpoint,
}) => {
  // Convert [lon, lat] GeoJSON coordinates to Leaflet [lat, lon]
  const polylines = useMemo(() => {
    return routes.map((r) => {
      const latLngs = r.geometry.map(([lon, lat]) => [lat, lon] as [number, number])
      return {
        id: r.id,
        name: r.name,
        latLngs,
        totalMiles: r.total_miles,
        totalMinutes: r.total_minutes,
        severeMiles: r.summary.severe_miles,
        blocked: r.summary.blocked,
      }
    })
  }, [routes])

  // Compute map bounds encompassing all coordinates
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const allPoints: [number, number][] = []
    if (origin.lat && origin.lon) allPoints.push([origin.lat, origin.lon])
    if (destination.lat && destination.lon) allPoints.push([destination.lat, destination.lon])

    polylines.forEach((p) => {
      allPoints.push(...p.latLngs)
    })

    if (allPoints.length === 0) return null
    return L.latLngBounds(allPoints)
  }, [origin, destination, polylines])

  // Currently selected route and checkpoint
  const activeRoute = routes[selectedRouteIndex] || routes[0]
  const activeCheckpoint = useMemo(() => {
    if (!activeRoute || selectedCheckpointId === null) return null
    return activeRoute.checkpoints.find((c) => c.id === selectedCheckpointId)
  }, [activeRoute, selectedCheckpointId])

  // Center coordinate for fallback
  const centerLat = origin.lat || 20.5937
  const centerLon = origin.lon || 78.9629

  // Route styling parameters
  const getPolylineStyles = (index: number) => {
    const isRecommended = index === recommendedIndex
    const isSelected = index === selectedRouteIndex

    if (isRecommended) {
      return {
        strokeColor: '#eab308', // Industrial Safety Yellow
        casingColor: '#854d0e',
        weight: isSelected ? 7 : 5,
        opacity: isSelected ? 1.0 : 0.75,
      }
    }
    // Alternative routes
    const colors = ['#0284c7', '#6366f1', '#10b981']
    const color = colors[index % colors.length]
    return {
      strokeColor: color,
      casingColor: '#0f172a',
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 0.9 : 0.6,
    }
  }

  return (
    <div className="map-wrapper card" style={{ padding: '0.75rem', position: 'relative' }}>
      <div className="map-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
            Interactive Route &amp; Hazard Visualizer
          </span>
          <span className="route-count-pill">{routes.length} Route Alternatives</span>
        </div>

        <div className="route-select-tabs">
          {routes.map((r, idx) => {
            const isRec = idx === recommendedIndex
            const isSel = idx === selectedRouteIndex
            return (
              <button
                key={r.id}
                type="button"
                className={`route-tab-btn ${isSel ? 'active-tab' : ''} ${isRec ? 'recommended-tab' : ''}`}
                onClick={() => onSelectRoute(idx)}
              >
                {isRec && <span style={{ marginRight: 4 }}>★</span>}
                {r.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="leaflet-container-box">
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={5}
          scrollWheelZoom={true}
          style={{ height: '480px', width: '100%', borderRadius: '10px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <BoundsFitter bounds={bounds} />
          <CheckpointPanner checkpoint={activeCheckpoint} />

          {/* 0–48h Corridor Weather Heatmap Layer */}
          <HeatmapOverlay
            heatmap={heatmap}
            currentHour={currentHour}
            showHeatmap={showHeatmap}
          />

          {/* Route Polylines */}
          {polylines.map((p, idx) => {
            const isSelected = idx === selectedRouteIndex
            const isRec = idx === recommendedIndex
            const style = getPolylineStyles(idx)

            return (
              <React.Fragment key={`route-${p.id}`}>
                {/* Underlay casing for selected route for high contrast */}
                {isSelected && (
                  <Polyline
                    positions={p.latLngs}
                    pathOptions={{
                      color: style.casingColor,
                      weight: style.weight + 4,
                      opacity: 0.35,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}

                {/* Main Route Polyline */}
                <Polyline
                  positions={p.latLngs}
                  pathOptions={{
                    color: style.strokeColor,
                    weight: style.weight,
                    opacity: style.opacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{
                    click: () => onSelectRoute(idx),
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                      <strong>{p.name}</strong> {isRec && '(Recommended)'}
                      <br />
                      Distance: {p.totalMiles} mi • Duration: {Math.round(p.totalMinutes / 60)}h{' '}
                      {Math.round(p.totalMinutes % 60)}m
                      <br />
                      Severe Weather Miles: {p.severeMiles} mi
                      {p.blocked && <span style={{ color: '#ef4444' }}> • BLOCKED</span>}
                      <br />
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Click route to inspect checkpoints
                      </span>
                    </div>
                  </Tooltip>
                </Polyline>
              </React.Fragment>
            )
          })}

          {/* Origin Marker (A) */}
          {origin.lat && origin.lon && (
            <Marker
              position={[origin.lat, origin.lon]}
              icon={createEndpointIcon('A', '#16a34a')}
            >
              <Popup>
                <div style={{ padding: '4px' }}>
                  <strong style={{ color: '#16a34a' }}>Origin (Point A)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>{origin.label}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination Marker (B) */}
          {destination.lat && destination.lon && (
            <Marker
              position={[destination.lat, destination.lon]}
              icon={createEndpointIcon('B', '#0f172a')}
            >
              <Popup>
                <div style={{ padding: '4px' }}>
                  <strong style={{ color: '#0f172a' }}>Destination (Point B)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>{destination.label}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Checkpoint Pins for Selected Route */}
          {activeRoute &&
            activeRoute.checkpoints.map((cp, idx) => {
              const isSelected = selectedCheckpointId === cp.id
              const pinIcon = createCheckpointIcon(idx + 1, cp.level, isSelected)

              return (
                <Marker
                  key={`cp-${cp.id}`}
                  position={[cp.lat, cp.lon]}
                  icon={pinIcon}
                  eventHandlers={{
                    click: () => onSelectCheckpoint(cp.id),
                  }}
                >
                  <Popup>
                    <div className="checkpoint-popup-content">
                      <div className="popup-header">
                        <strong>Checkpoint #{idx + 1}</strong>
                        <span className={`popup-tier-badge tier-${cp.level.toLowerCase()}`}>
                          {cp.level.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="popup-meta">
                        <div>
                          <strong>Mile Marker:</strong> {cp.mile_marker.toFixed(1)} mi
                        </div>
                        <div>
                          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                          <strong>Arrival ETA:</strong>{' '}
                          {new Date(cp.eta).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>

                      <div className="popup-weather-grid">
                        <div className="popup-weather-item">
                          <span className="w-label"><Wind size={12} /> Wind</span>
                          <span className="w-val">{cp.wind_mph.toFixed(1)} mph</span>
                        </div>
                        <div className="popup-weather-item">
                          <span className="w-label"><CloudRain size={12} /> Rain</span>
                          <span className="w-val">{cp.rain_in_hr.toFixed(2)} in/hr</span>
                        </div>
                        <div className="popup-weather-item">
                          <span className="w-label"><Snowflake size={12} /> Snow</span>
                          <span className="w-val">{cp.snow_in_hr.toFixed(2)} in/hr</span>
                        </div>
                      </div>

                      {cp.level === 'NO_TRAVEL' && (
                        <div className="popup-alert-blocked">
                          <AlertTriangle size={14} />
                          <span>NO TRAVEL ZONE: Critical safety limit breached</span>
                        </div>
                      )}

                      {cp.level === 'LOW' && (
                        <div className="popup-safe-notice">
                          <ShieldCheck size={14} />
                          <span>Clear driving conditions expected at ETA</span>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
        </MapContainer>
      </div>

      {/* Map Legend Overlay */}
      <div className="map-floating-legend">
        <span className="legend-title">Route Checkpoint Hazard Legend:</span>
        <div className="legend-items">
          <span className="legend-chip"><span className="chip-dot dot-low"></span> Low (&lt;25 mph)</span>
          <span className="legend-chip"><span className="chip-dot dot-moderate"></span> Moderate (25-34 mph)</span>
          <span className="legend-chip"><span className="chip-dot dot-high"></span> High (35-44 mph)</span>
          <span className="legend-chip"><span className="chip-dot dot-severe"></span> Severe (45-54 mph)</span>
          <span className="legend-chip"><span className="chip-dot dot-blocked"></span> No Travel (≥55 mph / heavy precip)</span>
        </div>
      </div>
    </div>
  )
}
