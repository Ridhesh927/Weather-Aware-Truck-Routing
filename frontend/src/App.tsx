import { useEffect, useState } from 'react'
import { ShieldCheck, CloudRain, Wind, AlertTriangle, Truck, CheckCircle2 } from 'lucide-react'
import './App.css'

interface HealthResponse {
  status: string
  service: string
  timestamp: string
}

function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [healthData, setHealthData] = useState<HealthResponse | null>(null)

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
      <header className="app-header">
        <div className="header-brand">
          <Truck className="brand-icon" size={32} />
          <div>
            <h1>Weather-Aware Truck Routing</h1>
            <p className="subtitle">Safest route first, fastest route second</p>
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

      <main className="main-content">
        <section className="hero-card">
          <h2>Phase 1: Foundation & Pure Risk Engine</h2>
          <p>
            The risk classification engine accurately predicts route weather hazards by combining Spotter risk thresholds with truck load-weight escalation rules.
          </p>
          {healthData && (
            <div className="health-info">
              <CheckCircle2 size={16} />
              <span>Backend Service: <strong>{healthData.service}</strong> (verified)</span>
            </div>
          )}
        </section>

        <div className="grid-cards">
          <div className="card">
            <div className="card-title">
              <Wind className="card-icon" />
              <h3>Wind Hazard Thresholds</h3>
            </div>
            <ul>
              <li><strong>&lt; 25 mph:</strong> Low Risk</li>
              <li><strong>25–34 mph:</strong> Moderate Risk</li>
              <li><strong>35–44 mph:</strong> High Risk</li>
              <li><strong>45–54 mph:</strong> Severe Risk</li>
              <li><strong>≥ 55 mph:</strong> No Travel</li>
            </ul>
          </div>

          <div className="card">
            <div className="card-title">
              <CloudRain className="card-icon" />
              <h3>Precipitation Thresholds</h3>
            </div>
            <ul>
              <li><strong>Rain &gt; 1.00 in/hr:</strong> No Travel</li>
              <li><strong>Rain 0.50–1.00 in/hr:</strong> Severe Risk</li>
              <li><strong>Snow &gt; 3.0 in/hr:</strong> No Travel</li>
              <li><strong>Snow 2.0–3.0 in/hr:</strong> Severe Risk</li>
              <li><strong>Snow 1.0–2.0 in/hr:</strong> High Risk</li>
            </ul>
          </div>

          <div className="card">
            <div className="card-title">
              <AlertTriangle className="card-icon" />
              <h3>Load Escalation Rules</h3>
            </div>
            <ul>
              <li><strong>Wind ≥ 55 mph:</strong> No Travel (any load)</li>
              <li><strong>Wind 45–54 mph &amp; load &gt; 30k lb:</strong> No Travel</li>
              <li><strong>Wind 35–44 mph &amp; load &gt; 40k lb:</strong> Severe</li>
              <li><em>Escalation only: never lowers risk level</em></li>
            </ul>
          </div>

          <div className="card">
            <div className="card-title">
              <ShieldCheck className="card-icon" />
              <h3>Route Priority Order</h3>
            </div>
            <ol>
              <li>Fewest Severe miles</li>
              <li>Fewest High miles</li>
              <li>Lowest average risk</li>
              <li>Shortest travel time</li>
            </ol>
            <p className="note">Any route with a No Travel checkpoint is excluded.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
