import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Wind,
  CloudRain,
  Snowflake,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react'

export interface CheckpointItem {
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

interface CheckpointTableProps {
  checkpoints: CheckpointItem[]
  selectedCheckpointId: number | null
  onSelectCheckpoint: (id: number) => void
  routeName: string
}

function formatEta(etaIso: string): string {
  try {
    const d = new Date(etaIso)
    if (isNaN(d.getTime())) return etaIso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return etaIso
  }
}

export const CheckpointTable: React.FC<CheckpointTableProps> = ({
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint,
  routeName,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  if (!checkpoints || checkpoints.length === 0) {
    return null
  }

  return (
    <div className="card checkpoint-table-card" style={{ marginTop: '1.25rem' }}>
      <button
        type="button"
        className="collapse-header-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="card-icon-box" style={{ background: '#f8fafc', color: '#0f172a' }}>
            <MapPin size={18} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
              Corridor Checkpoints Log ({routeName} • {checkpoints.length} sampled points)
            </h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isOpen ? 'Click to collapse checkpoint details' : 'Click to inspect individual miles, arrival ETAs and weather hazards'}
            </span>
          </div>
        </div>
        <div className="collapse-icon">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isOpen && (
        <div className="checkpoint-table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="checkpoint-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Mile</th>
                <th><Clock size={12} style={{ display: 'inline', marginRight: 3 }} /> Arrival ETA</th>
                <th><Wind size={12} style={{ display: 'inline', marginRight: 3 }} /> Wind</th>
                <th><CloudRain size={12} style={{ display: 'inline', marginRight: 3 }} /> Rain</th>
                <th><Snowflake size={12} style={{ display: 'inline', marginRight: 3 }} /> Snow</th>
                <th>Hazard Tier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((cp, idx) => {
                const isSelected = selectedCheckpointId === cp.id
                return (
                  <tr
                    key={cp.id}
                    className={`cp-row ${isSelected ? 'selected-row' : ''}`}
                    onClick={() => onSelectCheckpoint(cp.id)}
                  >
                    <td>
                      <span className={`cp-pin-badge pin-${cp.level.toLowerCase()}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <strong>{cp.mile_marker.toFixed(1)} mi</strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatEta(cp.eta)}
                    </td>
                    <td>
                      <span className={cp.wind_mph >= 35 ? 'highlight-danger' : ''}>
                        {cp.wind_mph.toFixed(1)} mph
                      </span>
                    </td>
                    <td>
                      <span className={cp.rain_in_hr >= 0.5 ? 'highlight-danger' : ''}>
                        {cp.rain_in_hr.toFixed(2)} in/hr
                      </span>
                    </td>
                    <td>
                      <span className={cp.snow_in_hr >= 1.0 ? 'highlight-danger' : ''}>
                        {cp.snow_in_hr.toFixed(2)} in/hr
                      </span>
                    </td>
                    <td>
                      <span className={`level-pill level-${cp.level.toLowerCase()}`}>
                        {cp.level === 'LOW' && <ShieldCheck size={11} style={{ marginRight: 3 }} />}
                        {cp.level === 'SEVERE' && <AlertTriangle size={11} style={{ marginRight: 3 }} />}
                        {cp.level === 'NO_TRAVEL' && '⛔ '}
                        {cp.level.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pin-view-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectCheckpoint(cp.id)
                        }}
                      >
                        {isSelected ? 'Focused' : 'Locate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

