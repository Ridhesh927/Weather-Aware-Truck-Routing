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
} from 'lucide-react'
import './App.css'

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
}

const SOUTH_ASIA_PRESETS: CorridorPreset[] = [
  {
    name: 'Mumbai ➔ Delhi',
    origin: 'Mumbai, Maharashtra, India',
    destination: 'New Delhi, Delhi, India',
    terrain: 'Western Corridor (NH48) • 1,420 km',
  },
  {
    name: 'Delhi ➔ Kolkata',
    origin: 'New Delhi, Delhi, India',
    destination: 'Kolkata, West Bengal, India',
    terrain: 'Grand Trunk Road (NH19) • 1,510 km',
  },
  {
    name: 'Bengaluru ➔ Chennai',
    origin: 'Bengaluru, Karnataka, India',
    destination: 'Chennai, Tamil Nadu, India',
    terrain: 'Industrial Expressway • 345 km',
  },
  {
    name: 'Delhi ➔ Srinagar',
    origin: 'New Delhi, Delhi, India',
    destination: 'Srinagar, Jammu & Kashmir, India',
    terrain: 'Himalayan Pass (Snow/Freeze Risk) • 810 km',
  },
  {
    name: 'Pune ➔ Hyderabad',
    origin: 'Pune, Maharashtra, India',
    destination: 'Hyderabad, Telangana, India',
    terrain: 'Deccan Plateau Corridor • 560 km',
  },
]

function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [healthData, setHealthData] = useState<HealthResponse | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<CorridorPreset | null>(SOUTH_ASIA_PRESETS[0])

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

  return (
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
        <div className={`status-badge status-${backendStatus}`}>
          <span className="status-dot"></span>
          <span>
            {backendStatus === 'connected' && 'API Connected'}
            {backendStatus === 'checking' && 'Connecting to API...'}
            {backendStatus === 'disconnected' && 'API Offline'}
          </span>
        </div>
      </header>

      {/* Regional Freight Corridors Banner */}
      <section className="region-banner">
        <div className="region-content">
          <h2>
            <Compass size={20} />
            India &amp; South Asia Freight Corridors
          </h2>
          <p>
            Evaluate monsoon precipitation, dust storm wind shears, and Himalayan mountain snow for heavy commercial loads.
          </p>
          {selectedPreset && (
            <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Active Corridor: <span style={{ color: 'var(--yellow-700)' }}>{selectedPreset.name}</span> ({selectedPreset.terrain})
            </p>
          )}
        </div>
        <div className="presets-container">
          <span className="presets-label">Quick Corridor Presets</span>
          <div className="preset-pills">
            {SOUTH_ASIA_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="preset-btn"
                onClick={() => setSelectedPreset(preset)}
              >
                <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </section>

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
        <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <CheckCircle2 size={15} style={{ display: 'inline', marginRight: 6, color: 'var(--success)' }} />
          Verified Backend Service: <strong>{healthData.service}</strong> • Ready for Phase 2 Routing
        </footer>
      )}
    </div>
  )
}

export default App
