import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimelineSlider } from './TimelineSlider'

describe('TimelineSlider Component', () => {
  const mockHeatmap = [
    {
      lat: 19.076,
      lon: 72.877,
      hourly_risks: Array(49).fill('LOW'),
    },
    {
      lat: 28.613,
      lon: 77.209,
      hourly_risks: Array(49).fill('MODERATE'),
    },
  ]

  it('renders slider header, current hour, and playback controls', () => {
    const onChangeHour = vi.fn()
    const onToggleHeatmap = vi.fn()
    const onTogglePlay = vi.fn()

    render(
      <TimelineSlider
        currentHour={6}
        onChangeHour={onChangeHour}
        departureTime="2026-11-06T08:00:00Z"
        heatmap={mockHeatmap}
        showHeatmap={true}
        onToggleHeatmap={onToggleHeatmap}
        isPlaying={false}
        onTogglePlay={onTogglePlay}
      />
    )

    expect(screen.getByText('0–48 Hour Corridor Weather Heatmap Scrubber')).toBeInTheDocument()
    expect(screen.getByText('+6h')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Heatmap ON/i })).toBeInTheDocument()
  })

  it('fires onTogglePlay when play/pause button is clicked', () => {
    const onTogglePlay = vi.fn()
    const { rerender } = render(
      <TimelineSlider
        currentHour={0}
        onChangeHour={vi.fn()}
        departureTime="2026-11-06T08:00:00Z"
        heatmap={mockHeatmap}
        showHeatmap={true}
        onToggleHeatmap={vi.fn()}
        isPlaying={false}
        onTogglePlay={onTogglePlay}
      />
    )

    const playBtn = screen.getByRole('button', { name: /Play/i })
    fireEvent.click(playBtn)
    expect(onTogglePlay).toHaveBeenCalledTimes(1)

    rerender(
      <TimelineSlider
        currentHour={0}
        onChangeHour={vi.fn()}
        departureTime="2026-11-06T08:00:00Z"
        heatmap={mockHeatmap}
        showHeatmap={true}
        onToggleHeatmap={vi.fn()}
        isPlaying={true}
        onTogglePlay={onTogglePlay}
      />
    )

    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
  })

  it('fires onChangeHour when quick hour presets are clicked', () => {
    const onChangeHour = vi.fn()
    render(
      <TimelineSlider
        currentHour={0}
        onChangeHour={onChangeHour}
        departureTime="2026-11-06T08:00:00Z"
        heatmap={mockHeatmap}
        showHeatmap={true}
        onToggleHeatmap={vi.fn()}
        isPlaying={false}
        onTogglePlay={vi.fn()}
      />
    )

    const hour12Btn = screen.getByRole('button', { name: '+12h' })
    fireEvent.click(hour12Btn)
    expect(onChangeHour).toHaveBeenCalledWith(12)
  })

  it('fires onChangeHour when reset button is clicked', () => {
    const onChangeHour = vi.fn()
    render(
      <TimelineSlider
        currentHour={18}
        onChangeHour={onChangeHour}
        departureTime="2026-11-06T08:00:00Z"
        heatmap={mockHeatmap}
        showHeatmap={true}
        onToggleHeatmap={vi.fn()}
        isPlaying={false}
        onTogglePlay={vi.fn()}
      />
    )

    const resetBtn = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetBtn)
    expect(onChangeHour).toHaveBeenCalledWith(0)
  })
})
