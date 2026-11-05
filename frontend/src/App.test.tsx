import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App Component', () => {
  const mockPlanResponse = {
    origin: { label: 'Mumbai, Maharashtra, India', lat: 19.076, lon: 72.877 },
    destination: { label: 'New Delhi, Delhi, India', lat: 28.613, lon: 77.209 },
    departure_at: '2026-11-06T08:00:00Z',
    load_lb: 35000,
    interval_miles: 25,
    routes: [
      {
        id: 0,
        name: 'Route 1 (via NH48)',
        profile: 'driving-hgv',
        geometry: [[72.877, 19.076], [77.209, 28.613]],
        total_miles: 882.5,
        total_minutes: 980.0,
        summary: {
          total_miles: 882.5,
          total_minutes: 980.0,
          severe_miles: 0.0,
          high_miles: 25.0,
          average_risk: 1.65,
          blocked: false,
        },
        checkpoints: [
          {
            id: 0,
            lat: 19.076,
            lon: 72.877,
            mile_marker: 25.0,
            segment_miles: 25.0,
            eta: '2026-11-06T08:28:00Z',
            wind_mph: 18.0,
            rain_in_hr: 0.0,
            snow_in_hr: 0.0,
            level: 'LOW',
          },
        ],
      },
      {
        id: 1,
        name: 'Route 2 (via NH52)',
        profile: 'driving-hgv',
        geometry: [[72.877, 19.076], [77.209, 28.613]],
        total_miles: 910.0,
        total_minutes: 1040.0,
        summary: {
          total_miles: 910.0,
          total_minutes: 1040.0,
          severe_miles: 25.0,
          high_miles: 0.0,
          average_risk: 1.85,
          blocked: false,
        },
        checkpoints: [],
      },
      {
        id: 2,
        name: 'Route 3 (via Valley Highway)',
        profile: 'driving-hgv',
        geometry: [[72.877, 19.076], [77.209, 28.613]],
        total_miles: 890.0,
        total_minutes: 960.0,
        summary: {
          total_miles: 890.0,
          total_minutes: 960.0,
          severe_miles: 0.0,
          high_miles: 0.0,
          average_risk: 5.0,
          blocked: true,
        },
        checkpoints: [],
      },
    ],
    recommended_index: 0,
    recommendation_reason: 'Route 1 (via NH48) has the fewest severe weather hazard miles and lowest average risk.',
    heatmap: [],
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/health/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'ok',
              service: 'weather-aware-truck-routing',
              timestamp: '2026-11-05T12:00:00Z',
            }),
          })
        }
        if (url.includes('/api/trips/plan/')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPlanResponse,
          })
        }
        return Promise.reject(new Error('Unknown url'))
      })
    )
  })

  it('renders application header and title', async () => {
    render(<App />)
    expect(screen.getByText('Weather-Aware Truck Routing')).toBeInTheDocument()
    expect(screen.getByText(/High-Visibility Logistics Risk Management/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('API Connected')).toBeInTheDocument()
      expect(screen.getByText(/Route Risk Comparison/)).toBeInTheDocument()
    })
  })

  it('renders quick presets and updates input on preset click', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('API Connected')).toBeInTheDocument()
      expect(screen.getByText(/Route Risk Comparison/)).toBeInTheDocument()
    })

    const bengaluruPreset = screen.getByRole('button', { name: /Bengaluru ➔ Chennai/ })
    expect(bengaluruPreset).toBeInTheDocument()

    fireEvent.click(bengaluruPreset)
    await waitFor(() => {
      const originInput = screen.getByLabelText(/Origin Location/i) as HTMLInputElement
      expect(originInput.value).toBe('Bengaluru, Karnataka, India')
    })
  })

  it('submits trip planning form and displays route comparison cards', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('API Connected')).toBeInTheDocument()
    })

    const calculateButton = screen.getByRole('button', { name: /Calculate Safest Route/i })
    fireEvent.click(calculateButton)

    await waitFor(() => {
      expect(screen.getByText(/Route Risk Comparison/)).toBeInTheDocument()
      expect(screen.getAllByText(/Route 1 \(via NH48\)/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/RECOMMENDED \(SAFEST\)/)).toBeInTheDocument()
      expect(screen.getByText(/NO TRAVEL \(BLOCKED\)/)).toBeInTheDocument()
      expect(screen.getByText(/Corridor Weather Heatmap Scrubber/)).toBeInTheDocument()
    })
  })

  it('updates selected corridor when preset is clicked', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('API Connected')).toBeInTheDocument()
      expect(screen.getByText(/Route Risk Comparison/)).toBeInTheDocument()
    })

    expect(screen.getByText('India & South Asia Freight Corridors')).toBeInTheDocument()

    const srinagarPreset = screen.getByRole('button', { name: /Delhi ➔ Srinagar/i })
    fireEvent.click(srinagarPreset)

    await waitFor(() => {
      const originInput = screen.getByLabelText(/Origin Location/i) as HTMLInputElement
      expect(originInput.value).toBe('New Delhi, Delhi, India')
      const destInput = screen.getByLabelText(/Destination Location/i) as HTMLInputElement
      expect(destInput.value).toBe('Srinagar, Jammu & Kashmir, India')
    })
  })
})
