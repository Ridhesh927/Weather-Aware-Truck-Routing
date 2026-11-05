import React, { useMemo } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Eye,
  EyeOff,
  Flame,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Wind,
} from 'lucide-react'

interface TimelineSliderProps {
  currentHour: number
  onChangeHour: (hour: number) => void
  departureTime: string
  heatmap: { lat: number; lon: number; hourly_risks: string[] }[]
  showHeatmap: boolean
  onToggleHeatmap: () => void
  isPlaying: boolean
  onTogglePlay: () => void
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  currentHour,
  onChangeHour,
  departureTime,
  heatmap,
  showHeatmap,
  onToggleHeatmap,
  isPlaying,
  onTogglePlay,
}) => {
  const quickHours = [0, 6, 12, 18, 24, 36, 48]

  // Format projected time for current hour offset
  const forecastTimeFormatted = useMemo(() => {
    try {
      const depDate = new Date(departureTime)
      if (isNaN(depDate.getTime())) return `+${currentHour}h from departure`
      const targetDate = new Date(depDate.getTime() + currentHour * 3600 * 1000)
      return targetDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return `+${currentHour}h from departure`
    }
  }, [departureTime, currentHour])

  // Count risk distribution across all sampled corridor points at current hour
  const riskCounts = useMemo(() => {
    const counts = { LOW: 0, MODERATE: 0, HIGH: 0, SEVERE: 0, NO_TRAVEL: 0 }
    if (!heatmap || heatmap.length === 0) return counts

    heatmap.forEach((pt) => {
      const tier = pt.hourly_risks && pt.hourly_risks[currentHour]
      if (tier && tier in counts) {
        counts[tier as keyof typeof counts] += 1
      }
    })
    return counts
  }, [heatmap, currentHour])

  const totalPoints = heatmap ? heatmap.length : 0

  return (
    <div className="card timeline-card" style={{ marginTop: '1.25rem' }}>
      <div className="timeline-header">
        <div className="timeline-title-group">
          <div className="card-icon-box" style={{ background: 'var(--yellow-400)', color: '#000' }}>
            <Flame size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
              0–48 Hour Corridor Weather Heatmap Scrubber
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Evaluate how weather fronts evolve along the freight corridor over time (100% client-side instant playback)
            </p>
          </div>
        </div>

        <div className="timeline-actions">
          <button
            type="button"
            className="preset-btn"
            onClick={onToggleHeatmap}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: showHeatmap ? 'var(--yellow-400)' : '#f1f5f9',
              color: showHeatmap ? '#000' : '#475569',
              fontWeight: 700,
            }}
            title={showHeatmap ? 'Hide Heatmap Layer' : 'Show Heatmap Layer'}
          >
            {showHeatmap ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>Heatmap {showHeatmap ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Scrubber Control */}
      <div className="timeline-slider-row" style={{ marginTop: '1rem' }}>
        <div className="timeline-player-controls">
          <button
            type="button"
            className="ctrl-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Timeline' : 'Play 48-Hour Corridor Evolution'}
            aria-label={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            style={{
              background: isPlaying ? 'var(--danger)' : 'var(--yellow-400)',
              color: isPlaying ? '#fff' : '#000',
              fontWeight: 800,
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="ctrl-btn secondary"
            onClick={() => onChangeHour(Math.max(0, currentHour - 1))}
            disabled={currentHour <= 0}
            title="Step Back 1 Hour"
            aria-label="Step Back 1 Hour"
          >
            <SkipBack size={15} />
          </button>

          <button
            type="button"
            className="ctrl-btn secondary"
            onClick={() => onChangeHour(Math.min(48, currentHour + 1))}
            disabled={currentHour >= 48}
            title="Step Forward 1 Hour"
            aria-label="Step Forward 1 Hour"
          >
            <SkipForward size={15} />
          </button>

          <button
            type="button"
            className="ctrl-btn secondary"
            onClick={() => onChangeHour(0)}
            title="Reset to Departure (Hour 0)"
            aria-label="Reset to Departure"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Current Time Display */}
        <div className="current-hour-badge">
          <div className="hour-pill">
            <Clock size={14} />
            <span>
              {currentHour === 0 ? 'Departure (0h)' : `+${currentHour}h from Departure`}
            </span>
          </div>
          <span className="forecast-time-text">{forecastTimeFormatted}</span>
        </div>
      </div>

      {/* Range Input Slider */}
      <div className="slider-container" style={{ margin: '1rem 0 0.5rem 0' }}>
        <input
          type="range"
          min="0"
          max="48"
          step="1"
          value={currentHour}
          onChange={(e) => onChangeHour(Number(e.target.value))}
          className="timeline-range"
          aria-label="Corridor Timeline Hour (0 to 48)"
        />
        <div className="slider-ticks">
          {quickHours.map((h) => (
            <button
              key={h}
              type="button"
              className={`tick-btn ${currentHour === h ? 'active-tick' : ''}`}
              onClick={() => onChangeHour(h)}
            >
              {h === 0 ? '0h' : `+${h}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Risk Metrics at Selected Hour */}
      {totalPoints > 0 && (
        <div className="corridor-summary-row" style={{ marginTop: '0.85rem' }}>
          <div className="summary-stat-label">
            <Wind size={13} style={{ display: 'inline', marginRight: 4 }} />
            <span>Corridor Risk at Hour +{currentHour}:</span>
          </div>
          <div className="risk-pill-row">
            <span className="risk-stat low" title="Low hazard checkpoints">
              <ShieldCheck size={12} /> {riskCounts.LOW} Low
            </span>
            <span className="risk-stat moderate" title="Moderate hazard checkpoints">
              {riskCounts.MODERATE} Moderate
            </span>
            <span className="risk-stat high" title="High hazard checkpoints">
              {riskCounts.HIGH} High
            </span>
            <span className="risk-stat severe" title="Severe hazard checkpoints">
              <AlertTriangle size={12} /> {riskCounts.SEVERE} Severe
            </span>
            {riskCounts.NO_TRAVEL > 0 && (
              <span className="risk-stat blocked" title="Blocked / No Travel checkpoints">
                ⛔ {riskCounts.NO_TRAVEL} No Travel
              </span>
            )}
          </div>
        </div>
      )}

      {/* Heatmap Gradient Legend */}
      <div className="heatmap-legend" style={{ marginTop: '0.75rem' }}>
        <span className="legend-label">Heatmap Risk Scale:</span>
        <div className="legend-bar">
          <div className="legend-grad"></div>
        </div>
        <div className="legend-keys">
          <span style={{ color: '#16a34a' }}>Low</span>
          <span style={{ color: '#ca8a04' }}>Moderate</span>
          <span style={{ color: '#ea580c' }}>High</span>
          <span style={{ color: '#dc2626' }}>Severe</span>
          <span style={{ color: '#7f1d1d' }}>No Travel</span>
        </div>
      </div>
    </div>
  )
}
