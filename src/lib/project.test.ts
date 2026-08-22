import { describe, it, expect } from 'vitest'
import { projectToMap, DIOCESE_BOUNDS } from './project'

const B = DIOCESE_BOUNDS

describe('projectToMap', () => {
  it('puts the south-west corner at the bottom-left', () => {
    const p = projectToMap({ lat: B.latMin, lng: B.lngMin }, B, 300, 400)
    expect(p!.x).toBeCloseTo(0)
    expect(p!.y).toBeCloseTo(400)
  })

  it('puts the north-east corner at the top-right', () => {
    const p = projectToMap({ lat: B.latMax, lng: B.lngMax }, B, 300, 400)
    expect(p!.x).toBeCloseTo(300)
    expect(p!.y).toBeCloseTo(0)
  })

  it('puts the centre in the middle', () => {
    const mid = { lat: (B.latMin + B.latMax) / 2, lng: (B.lngMin + B.lngMax) / 2 }
    const p = projectToMap(mid, B, 300, 400)
    expect(p!.x).toBeCloseTo(150)
    expect(p!.y).toBeCloseTo(200)
  })

  it('increases y as latitude decreases, because SVG y grows downward', () => {
    const north = projectToMap({ lat: 14.68, lng: 120.96 }, B, 300, 400)
    const south = projectToMap({ lat: 14.63, lng: 120.96 }, B, 300, 400)
    expect(south!.y).toBeGreaterThan(north!.y)
  })

  it('returns null for a position outside the bounds', () => {
    expect(projectToMap({ lat: 15.2, lng: 121.4 }, B, 300, 400)).toBeNull()
  })

  it('places both live parishes inside the frame', () => {
    // route-mhcp (Mary Help of Christians) and route-src (San Roque Cathedral),
    // from src/data.ts.
    const mhc = projectToMap({ lat: 14.637702, lng: 120.97344 }, B, 300, 400)
    const sr = projectToMap({ lat: 14.651647, lng: 120.972648 }, B, 300, 400)
    for (const p of [mhc, sr]) {
      expect(p!.x).toBeGreaterThan(0)
      expect(p!.x).toBeLessThan(300)
      expect(p!.y).toBeGreaterThan(0)
      expect(p!.y).toBeLessThan(400)
    }
  })
})
