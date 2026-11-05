import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckpointTable, CheckpointItem } from './CheckpointTable'

describe('CheckpointTable Component', () => {
  const mockCheckpoints: CheckpointItem[] = [
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
    {
      id: 1,
      lat: 20.123,
      lon: 73.456,
      mile_marker: 50.0,
      segment_miles: 25.0,
      eta: '2026-11-06T09:00:00Z',
      wind_mph: 42.0,
      rain_in_hr: 0.6,
      snow_in_hr: 0.0,
      level: 'SEVERE',
    },
  ]

  it('renders collapsed state initially and expands on click', () => {
    const onSelectCheckpoint = vi.fn()
    render(
      <CheckpointTable
        checkpoints={mockCheckpoints}
        selectedCheckpointId={null}
        onSelectCheckpoint={onSelectCheckpoint}
        routeName="Route 1 (via NH48)"
      />
    )

    expect(screen.getByText(/Corridor Checkpoints Log/i)).toBeInTheDocument()
    // Collapsed initially, table body not shown
    expect(screen.queryByText(/25\.0 mi/)).not.toBeInTheDocument()

    // Expand
    const expandBtn = screen.getByRole('button', { name: /Corridor Checkpoints Log/i })
    fireEvent.click(expandBtn)

    expect(screen.getByText(/25\.0 mi/)).toBeInTheDocument()
    expect(screen.getByText(/50\.0 mi/)).toBeInTheDocument()
    expect(screen.getByText(/18\.0 mph/)).toBeInTheDocument()
    expect(screen.getByText(/42\.0 mph/)).toBeInTheDocument()
  })

  it('triggers onSelectCheckpoint when a table row is clicked', () => {
    const onSelectCheckpoint = vi.fn()
    render(
      <CheckpointTable
        checkpoints={mockCheckpoints}
        selectedCheckpointId={null}
        onSelectCheckpoint={onSelectCheckpoint}
        routeName="Route 1 (via NH48)"
      />
    )

    const expandBtn = screen.getByRole('button', { name: /Corridor Checkpoints Log/i })
    fireEvent.click(expandBtn)

    const cell = screen.getByText(/50\.0 mi/)
    const row = cell.closest('tr')
    expect(row).toBeInTheDocument()
    if (row) {
      fireEvent.click(row)
      expect(onSelectCheckpoint).toHaveBeenCalledWith(1)
    }
  })
})
