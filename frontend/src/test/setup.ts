import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Mock react-leaflet for JSDOM test environments where SVG/Canvas layout is unsupported
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () => React.createElement('div', { 'data-testid': 'tile-layer' }),
  Polyline: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'polyline' }, children),
  Marker: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'marker' }, children),
  Popup: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'popup' }, children),
  Tooltip: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'tooltip' }, children),
  useMap: () => ({
    fitBounds: vi.fn(),
    panTo: vi.fn(),
    removeLayer: vi.fn(),
    addLayer: vi.fn(),
  }),
}))

// Mock HTMLCanvasElement.getContext for jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null
}

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver for jsdom
global.IntersectionObserver = class IntersectionObserver {
  root = null
  rootMargin = ''
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  constructor() {}
} as unknown as typeof IntersectionObserver
