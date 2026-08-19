import { describe, it, expect } from 'vitest'
import { haversineMeters } from './geo'

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
