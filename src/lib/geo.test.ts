import { describe, it, expect } from 'vitest'
import { haversineMeters, nearestLiveParish } from './geo'
import type { GeoParish } from './presence'

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    const p = { lat: 14.6497, lng: 120.9722 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it('measures a known short distance', () => {
    // 0.001 degrees of latitude is ~111 metres
    const a = { lat: 14.6497, lng: 120.9722 }
    const b = { lat: 14.6507, lng: 120.9722 }
    expect(haversineMeters(a, b)).toBeGreaterThan(105)
    expect(haversineMeters(a, b)).toBeLessThan(117)
  })

  it('is symmetric', () => {
    const a = { lat: 14.6497, lng: 120.9722 }
    const b = { lat: 14.6510, lng: 120.9686 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6)
  })
})

describe('nearestLiveParish', () => {
  const MHCP: GeoParish = {
    id: 'route-mhcp',
    coordinates: { lat: 14.6305, lng: 120.9711 },
    geofenceRadius: 100,
    status: 'live',
  }
  const SRC: GeoParish = {
    id: 'route-src',
    coordinates: { lat: 14.6510, lng: 120.9686 },
    geofenceRadius: 100,
    status: 'live',
  }
  const PARISHES = [MHCP, SRC]

  it('returns null for a null position', () => {
    expect(nearestLiveParish(null, PARISHES)).toBeNull()
  })

  it('returns MHCP with a sub-metre distance at its own coordinates', () => {
    const result = nearestLiveParish({ lat: 14.6305, lng: 120.9711 }, PARISHES)
    expect(result).not.toBeNull()
    expect(result!.parish.id).toBe('route-mhcp')
    expect(result!.distance).toBeLessThan(1)
  })

  it('returns the nearest parish for a far position', () => {
    const far = { lat: 14.0, lng: 120.0 }
    const result = nearestLiveParish(far, PARISHES)
    expect(result).not.toBeNull()
    expect(result!.distance).toBeGreaterThan(1000)
  })

  it('never returns a coming_soon parish even when it is closer', () => {
    const comingSoon: GeoParish = {
      id: 'route-future',
      coordinates: { lat: 14.6305, lng: 120.9711 },
      geofenceRadius: 100,
      status: 'coming_soon',
    }
    const result = nearestLiveParish(
      { lat: 14.6305, lng: 120.9711 },
      [comingSoon, SRC],
    )
    expect(result).not.toBeNull()
    expect(result!.parish.id).toBe('route-src')
  })
})
