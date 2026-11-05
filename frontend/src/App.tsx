import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  CloudRain,
  Wind,
  AlertTriangle,
  Truck,
  CheckCircle2,
  MapPin,
  Compass,
  Clock,
  Gauge,
  Navigation,
  Loader2,
  XCircle,
  Activity,
} from 'lucide-react'
import './App.css'
import { RouteMap } from './components/RouteMap'
import { TimelineSlider } from './components/TimelineSlider'
import { CheckpointTable } from './components/CheckpointTable'
import { TiltCard } from './components/TiltCard'
import { GradientASCII, ASCIIShape } from './components/GradientASCII'

interface HealthResponse {
  status: string
  service: string
  timestamp: string
}

interface CorridorPreset {
  name: string
  origin: string
  destination: string
  terrain: string
  loadLb: number
}

interface Checkpoint {
  id: number
  lat: number
  lon: number
  mile_marker: number
  segment_miles: number
  eta: string
  wind_mph: number
  rain_in_hr: number
  snow_in_hr: number
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'NO_TRAVEL'
}

interface RouteSummary {
  total_miles: number
  total_minutes: number
  severe_miles: number
  high_miles: number
  average_risk: number
  blocked: boolean
}

interface RouteOption {
  id: number
  name: string
  profile: string
  geometry: [number, number][]
  total_miles: number
  total_minutes: number
  summary: RouteSummary
  checkpoints: Checkpoint[]
}

interface PlanResponse {
  origin: { label: string; lat: number; lon: number }
  destination: { label: string; lat: number; lon: number }
  departure_at: string
  load_lb: number
  interval_miles: number
  routes: RouteOption[]
  recommended_index: number | null
  recommendation_reason: string
  heatmap: { lat: number; lon: number; hourly_risks: string[] }[]
}

const SOUTH_ASIA_PRESETS: CorridorPreset[] = [
  {
    name: 'Mumbai ➔ Delhi',
    origin: 'Mumbai, Maharashtra, India',
    destination: 'New Delhi, Delhi, India',
    terrain: 'Western Corridor (NH48) • 1,420 km',
    loadLb: 35000,
  },
  {
    name: 'Delhi ➔ Kolkata',
    origin: 'New Delhi, Delhi, India',
    destination: 'Kolkata, West Bengal, India',
    terrain: 'Grand Trunk Road (NH19) • 1,510 km',
    loadLb: 30000,
  },
  {
    name: 'Bengaluru ➔ Chennai',
    origin: 'Bengaluru, Karnataka, India',
    destination: 'Chennai, Tamil Nadu, India',
    terrain: 'Industrial Expressway • 345 km',
    loadLb: 42000,
  },
  {
    name: 'Delhi ➔ Srinagar',
    origin: 'New Delhi, Delhi, India',
    destination: 'Srinagar, Jammu & Kashmir, India',
    terrain: 'Himalayan Pass (Snow/Freeze Risk) • 810 km',
    loadLb: 28000,
  },
  {
    name: 'Pune ➔ Hyderabad',
    origin: 'Pune, Maharashtra, India',
    destination: 'Hyderabad, Telangana, India',
    terrain: 'Deccan Plateau Corridor • 560 km',
    loadLb: 38000,
  },
]

function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hrs}h ${mins}m`
}

function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [healthData, setHealthData] = useState<HealthResponse | null>(null)

  // Form states
  const [selectedPreset, setSelectedPreset] = useState<CorridorPreset>(SOUTH_ASIA_PRESETS[0])
  const [origin, setOrigin] = useState(SOUTH_ASIA_PRESETS[0].origin)
  const [destination, setDestination] = useState(SOUTH_ASIA_PRESETS[0].destination)
  const [loadLb, setLoadLb] = useState<number>(35000)
  const [intervalMiles, setIntervalMiles] = useState<number>(25)

  // Get local ISO string for datetime-local input
  const defaultDeparture = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  const [departureAt, setDepartureAt] = useState<string>(defaultDeparture)

  // Plan result & UI states
  const [isPlanning, setIsPlanning] = useState<boolean>(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planResult, setPlanResult] = useState<PlanResponse | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0)

  // Heatmap & Timeline playback states
  const [currentHour, setCurrentHour] = useState<number>(0)
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<number | null>(null)

  // Atmospheric Full-Page ASCII Background State
  const [bgShape, setBgShape] = useState<ASCIIShape>('horizon')

  // Auto-advance timeline animation effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentHour((prev) => {
          if (prev >= 48) {
            setIsPlaying(false)
            return 48
          }
          return prev + 1
        })
      }, 600)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isPlaying])

  useEffect(() => {
    fetch('/api/health/')
      .then((res) => {
        if (!res.ok) throw new Error('Health check failed')
        return res.json()
      })
      .then((data: HealthResponse) => {
        setBackendStatus('connected')
        setHealthData(data)
      })
      .catch(() => {
        setBackendStatus('disconnected')
      })
  }, [])

  const handleSelectPreset = (preset: CorridorPreset) => {
    setSelectedPreset(preset)
    setOrigin(preset.origin)
    setDestination(preset.destination)
    setLoadLb(preset.loadLb)
    setPlanError(null)
  }

  const handlePlanTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setPlanError(null)
    setIsPlanning(true)

    try {
      const response = await fetch('/api/trips/plan/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          departure_at: new Date(departureAt).toISOString(),
          load_lb: Number(loadLb),
          interval_miles: Number(intervalMiles),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate trip routes.')
      }

      setPlanResult(data)
      setCurrentHour(0)
      setIsPlaying(false)
      setSelectedCheckpointId(null)
      if (data.recommended_index !== null && data.recommended_index !== undefined) {
        setSelectedRouteId(data.recommended_index)
      } else {
        setSelectedRouteId(0)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while planning the trip.'
      setPlanError(msg)
    } finally {
      setIsPlanning(false)
    }
  }

  return (
    <>
      {/* Full-Page Background GradientASCII WebGL Drift */}
      <div className="app-gradient-ascii-bg" aria-hidden="true">
        <GradientASCII
          colors={['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']}
          shape={bgShape}
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.8}
        />
      </div>

      <div className="app-container">
        {/* Top Header */}
        <header className="app-header">
          <div className="header-brand">
            <div className="brand-icon-box">
              <Truck size={26} />
            </div>
            <div>
              <h1>Weather-Aware Truck Routing</h1>
              <p className="subtitle">High-Visibility Logistics Risk Management • South Asia &amp; India Network</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="ascii-shape-selector">
              <span className="ascii-label">
                <Activity size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Background:
              </span>
              {(['horizon', 'pinch', 'rise', 'eclipse'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBgShape(s)}
                  className={`ascii-preset-pill ${bgShape === s ? 'active-ascii-pill' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className={`status-badge status-${backendStatus}`}>
              <span className="status-dot"></span>
              <span>
                {backendStatus === 'connected' && 'API Connected'}
                {backendStatus === 'checking' && 'Connecting to API...'}
                {backendStatus === 'disconnected' && 'API Offline'}
              </span>
            </div>
          </div>
        </header>

        {/* Regional Freight Corridors (Second Component) with Interactive 3D Movement */}
        <TiltCard tiltMax={5} scale={1.008} glare={true} style={{ marginBottom: '2rem' }}>
        <section className="region-banner" style={{ marginBottom: 0 }}>
          <div className="region-content">
            <h2>
              <Compass size={22} />
              India &amp; South Asia Freight Corridors
            </h2>
            <p>
              Evaluate monsoon precipitation, dust storm wind shears, and Himalayan mountain snow for heavy commercial loads.
            </p>
          </div>
          <div className="presets-container">
            <span className="presets-label">Quick Corridor Presets</span>
            <div className="preset-pills">
              {SOUTH_ASIA_PRESETS.map((preset) => {
                const isSelected = selectedPreset.name === preset.name
                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset-btn ${isSelected ? 'active-preset-btn' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {preset.name}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </TiltCard>

      {/* Trip Planning Form */}
      <section className="card plan-form-card" style={{ marginBottom: '2rem' }}>
        <div className="card-title">
          <div className="card-icon-box">
            <Navigation size={20} />
          </div>
          <h3>Plan Weather-Safe Commercial Haul</h3>
        </div>

        <form onSubmit={handlePlanTrip} className="trip-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="origin-input">Origin Location</label>
              <input
                id="origin-input"
                type="text"
                className="form-input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Mumbai, Maharashtra, India"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="destination-input">Destination Location</label>
              <input
                id="destination-input"
                type="text"
                className="form-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. New Delhi, Delhi, India"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="departure-input">Departure Date &amp; Time</label>
              <input
                id="departure-input"
                type="datetime-local"
                className="form-input"
                value={departureAt}
                onChange={(e) => setDepartureAt(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="load-input">Cargo Load Weight (lb)</label>
              <input
                id="load-input"
                type="number"
                className="form-input"
                value={loadLb}
                onChange={(e) => setLoadLb(Math.max(0, Number(e.target.value)))}
                min="0"
                step="1000"
                placeholder="e.g. 35000"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="interval-select">Sample Interval (miles)</label>
              <select
                id="interval-select"
                className="form-input"
                value={intervalMiles}
                onChange={(e) => setIntervalMiles(Number(e.target.value))}
              >
                <option value={10}>10 miles (High Density)</option>
                <option value={25}>25 miles (Standard Recommended)</option>
                <option value={50}>50 miles (Fast Corridor)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={isPlanning}
              className="preset-btn"
              style={{
                background: 'var(--yellow-400)',
                color: '#000',
                padding: '0.65rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isPlanning ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Evaluating Weather Hazards...
                </>
              ) : (
                <>
                  <Navigation size={18} />
                  Calculate Safest Route
                </>
              )}
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Evaluates 3 alternative routes with OpenRouteService &amp; Open-Meteo forecasts
            </span>
          </div>

          {planError && (
            <div className="error-banner" style={{ marginTop: '1rem' }}>
              <XCircle size={18} />
              <span>{planError}</span>
            </div>
          )}
        </form>
      </section>

      {/* Plan Results Comparison Cards */}
      {planResult && (
        <section className="results-section" style={{ marginBottom: '2.5rem' }}>
          <div className="results-header" style={{ marginBottom: '1.25rem' }}>
            <h2>
              <ShieldCheck size={22} style={{ color: 'var(--yellow-600)', display: 'inline', marginRight: 8 }} />
              Route Risk Comparison ({planResult.routes.length} Alternatives)
            </h2>
            {planResult.recommendation_reason && (
              <p className="recommendation-banner" style={{ marginTop: '0.5rem' }}>
                <strong>Recommendation:</strong> {planResult.recommendation_reason}
              </p>
            )}
          </div>

          <div className="grid-cards">
            {planResult.routes.map((route, idx) => {
              const isRecommended = planResult.recommended_index === idx
              const isBlocked = route.summary.blocked
              const isSelected = selectedRouteId === idx

              return (
                <TiltCard
                  key={route.id}
                  tiltMax={6}
                  scale={1.015}
                  glare={true}
                  className={`card route-card ${isRecommended ? 'recommended-card' : ''} ${isBlocked ? 'blocked-card' : ''} ${isSelected ? 'selected-card' : ''}`}
                  onClick={() => setSelectedRouteId(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{route.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{route.profile}</span>
                    </div>
                    {isRecommended && (
                      <span className="badge badge-recommended">
                        ★ RECOMMENDED (SAFEST)
                      </span>
                    )}
                    {isBlocked && (
                      <span className="badge badge-blocked">
                        ⛔ NO TRAVEL (BLOCKED)
                      </span>
                    )}
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-box">
                      <span className="metric-label"><Gauge size={12} /> Distance</span>
                      <span className="metric-value">{route.summary.total_miles} mi</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label"><Clock size={12} /> Travel Time</span>
                      <span className="metric-value">{formatMinutes(route.summary.total_minutes)}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label"><AlertTriangle size={12} /> Severe Miles</span>
                      <span className="metric-value" style={{ color: route.summary.severe_miles > 0 ? 'var(--danger)' : 'inherit' }}>
                        {route.summary.severe_miles} mi
                      </span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label"><Wind size={12} /> High Miles</span>
                      <span className="metric-value" style={{ color: route.summary.high_miles > 0 ? 'var(--warning)' : 'inherit' }}>
                        {route.summary.high_miles} mi
                      </span>
                    </div>
                    <div className="metric-box" style={{ gridColumn: 'span 2' }}>
                      <span className="metric-label"><ShieldCheck size={12} /> Average Risk Score (1-5)</span>
                      <span className="metric-value" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {route.summary.average_risk.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{route.checkpoints.length} Checkpoints sampled</span>
                    <span style={{ color: isSelected ? 'var(--yellow-700)' : 'inherit', fontWeight: 600 }}>
                      {isSelected ? '✓ Selected for inspection' : 'Click to inspect'}
                    </span>
                  </div>
                </TiltCard>
              )
            })}
          </div>

          {/* Interactive Route Map & Visualizer */}
          <RouteMap
            origin={planResult.origin}
            destination={planResult.destination}
            routes={planResult.routes}
            recommendedIndex={planResult.recommended_index}
            selectedRouteIndex={selectedRouteId}
            onSelectRoute={(idx) => {
              setSelectedRouteId(idx)
              setSelectedCheckpointId(null)
            }}
            heatmap={planResult.heatmap}
            currentHour={currentHour}
            showHeatmap={showHeatmap}
            selectedCheckpointId={selectedCheckpointId}
            onSelectCheckpoint={(id) => setSelectedCheckpointId(id)}
          />

          {/* 0–48 Hour Corridor Weather Heatmap Scrubber */}
          <TimelineSlider
            currentHour={currentHour}
            onChangeHour={(h) => setCurrentHour(h)}
            departureTime={planResult.departure_at}
            heatmap={planResult.heatmap}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((prev) => !prev)}
          />

          {/* Detailed Checkpoint Corridor Log */}
          <CheckpointTable
            checkpoints={planResult.routes[selectedRouteId]?.checkpoints || []}
            selectedCheckpointId={selectedCheckpointId}
            onSelectCheckpoint={(id) => setSelectedCheckpointId(id)}
            routeName={planResult.routes[selectedRouteId]?.name || 'Selected Route'}
          />
        </section>
      )}

      {/* Risk Engine Rules Cards */}
      <main className="grid-cards">
        <div className="card">
          <div className="card-title">
            <div className="card-icon-box">
              <Wind size={20} />
            </div>
            <h3>Wind Hazard Thresholds</h3>
          </div>
          <ul>
            <li><strong>&lt; 25 mph:</strong> Low Risk</li>
            <li><strong>25–34 mph:</strong> Moderate Risk (Lower bound 25)</li>
            <li><strong>35–44 mph:</strong> High Risk (Lower bound 35)</li>
            <li><strong>45–54 mph:</strong> Severe Risk (Lower bound 45)</li>
            <li><strong>≥ 55 mph:</strong> No Travel (Rollover danger)</li>
          </ul>
        </div>

        <div className="card">
          <div className="card-title">
            <div className="card-icon-box">
              <CloudRain size={20} />
            </div>
            <h3>Precipitation Thresholds</h3>
          </div>
          <ul>
            <li><strong>Rain &gt; 1.00 in/hr:</strong> No Travel (Monsoon deluge)</li>
            <li><strong>Rain 0.50–1.00 in/hr:</strong> Severe Risk (Heavy flooding)</li>
            <li><strong>Snow &gt; 3.0 in/hr:</strong> No Travel (Himalayan passes)</li>
            <li><strong>Snow 2.0–3.0 in/hr:</strong> Severe Risk</li>
            <li><strong>Snow 1.0–2.0 in/hr:</strong> High Risk</li>
          </ul>
        </div>

        <div className="card">
          <div className="card-title">
            <div className="card-icon-box">
              <AlertTriangle size={20} />
            </div>
            <h3>Load Escalation Rules</h3>
          </div>
          <ul>
            <li><strong>Wind ≥ 55 mph:</strong> No Travel (any load weight)</li>
            <li><strong>Wind 45–54 mph &amp; load &gt; 30k lb:</strong> No Travel</li>
            <li><strong>Wind 35–44 mph &amp; load &gt; 40k lb:</strong> Severe Risk</li>
            <li><em>Escalation only: never lowers risk level</em></li>
          </ul>
        </div>

        <div className="card priority-card">
          <div className="card-title">
            <div className="card-icon-box" style={{ background: 'var(--yellow-400)', color: '#000' }}>
              <ShieldCheck size={20} />
            </div>
            <h3>Route Priority Order</h3>
          </div>
          <div>
            <div className="priority-step">
              <span className="priority-num">1</span>
              <span><strong>Fewest Severe miles</strong></span>
            </div>
            <div className="priority-step">
              <span className="priority-num">2</span>
              <span><strong>Fewest High miles</strong></span>
            </div>
            <div className="priority-step">
              <span className="priority-num">3</span>
              <span><strong>Lowest average risk</strong></span>
            </div>
            <div className="priority-step">
              <span className="priority-num">4</span>
              <span><strong>Shortest travel time</strong></span>
            </div>
          </div>
          <p className="note">Any route containing a No Travel checkpoint is blocked.</p>
        </div>
      </main>

      {/* Backend Status Verification */}
      {healthData && (
        <footer style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          <CheckCircle2 size={15} style={{ display: 'inline', marginRight: 6, color: 'var(--success)' }} />
          Verified Backend Service: <strong>{healthData.service}</strong> • Phase 2 Trip Planner Active
        </footer>
      )}
    </div>
    </>
  )
}

export default App
