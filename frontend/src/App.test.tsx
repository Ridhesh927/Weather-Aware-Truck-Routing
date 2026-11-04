import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          service: 'weather-aware-truck-routing',
          timestamp: '2026-11-04T12:00:00Z',
        }),
      })
    )
  })

  it('renders application header and title', async () => {
    render(<App />)
    expect(screen.getByText('Weather-Aware Truck Routing')).toBeInTheDocument()
    expect(
      screen.getByText('Safest route first, fastest route second')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('API Connected')).toBeInTheDocument()
    })
  })

  it('renders core risk rules cards', async () => {
    render(<App />)
    expect(screen.getByText('Wind Hazard Thresholds')).toBeInTheDocument()
    expect(screen.getByText('Precipitation Thresholds')).toBeInTheDocument()
    expect(screen.getByText('Load Escalation Rules')).toBeInTheDocument()
    expect(screen.getByText('Route Priority Order')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Backend Service:/)).toBeInTheDocument()
    })
  })
})
