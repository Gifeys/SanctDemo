import { describe, it, expect } from 'vitest'
import { INITIAL_PRESENCE, nextPresence, MIN_DWELL_MS, type GeoParish } from './presence'

const MHCP: GeoParish = {
  id: 'route-mhcp',
  coordinates: { lat: 14.6305, lng: 120.9711 },
  geofenceRadius: 100,
  status: 'live',
}
const PARISHES = [MHCP]

const at = MHCP.coordinates
const far = { lat: 14.9000, lng: 121.2000 }

// ~300m north of the parish: inside approach range, outside the geofence
const approaching = { lat: MHCP.coordinates.lat + 0.0027, lng: MHCP.coordinates.lng }

describe('nextPresence', () => {
  it('starts in diocese mode with no parish', () => {
    expect(INITIAL_PRESENCE.mode).toBe('diocese')
    expect(INITIAL_PRESENCE.parishId).toBeNull()
  })

  it('stays in diocese mode when far away', () => {
    const s = nextPresence(INITIAL_PRESENCE, far, 1000, PARISHES)
    expect(s.mode).toBe('diocese')
    expect(s.parishId).toBeNull()
  })

  it('enters approaching between 100m and 500m', () => {
    const s = nextPresence(INITIAL_PRESENCE, approaching, 1000, PARISHES)
    expect(s.mode).toBe('approaching')
    expect(s.parishId).toBe('route-mhcp')
  })

  it('enters present inside the geofence', () => {
    const s = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    expect(s.mode).toBe('present')
    expect(s.parishId).toBe('route-mhcp')
  })

  it('records the distance in metres', () => {
    const s = nextPresence(INITIAL_PRESENCE, approaching, 1000, PARISHES)
    expect(s.distance).toBeGreaterThan(250)
    expect(s.distance).toBeLessThan(350)
  })

  it('falls back to diocese mode when position is null', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    const s = nextPresence(present, null, 1000 + MIN_DWELL_MS + 1, PARISHES)
    expect(s.mode).toBe('diocese')
    expect(s.parishId).toBeNull()
  })
})

describe('hysteresis', () => {
  it('does not leave present at 120m, between the 100m enter and 150m leave radii', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    // ~120m north
    const edge = { lat: MHCP.coordinates.lat + 0.00108, lng: MHCP.coordinates.lng }
    const s = nextPresence(present, edge, 1000 + MIN_DWELL_MS + 1, PARISHES)
    expect(s.mode).toBe('present')
  })

  it('leaves present beyond 150m', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    // ~200m north
    const out = { lat: MHCP.coordinates.lat + 0.0018, lng: MHCP.coordinates.lng }
    const s = nextPresence(present, out, 1000 + MIN_DWELL_MS + 1, PARISHES)
    expect(s.mode).toBe('approaching')
  })

  it('does not leave approaching at 550m, between the 500m enter and 600m leave radii', () => {
    const appr = nextPresence(INITIAL_PRESENCE, approaching, 1000, PARISHES)
    // ~550m north
    const edge = { lat: MHCP.coordinates.lat + 0.00495, lng: MHCP.coordinates.lng }
    const s = nextPresence(appr, edge, 1000 + MIN_DWELL_MS + 1, PARISHES)
    expect(s.mode).toBe('approaching')
  })
})

describe('dwell debounce', () => {
  it('ignores a mode change that arrives before the dwell time elapses', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    const s = nextPresence(present, far, 1000 + 500, PARISHES)
    expect(s.mode).toBe('present')
  })

  it('accepts the change once the dwell time has elapsed', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    const s = nextPresence(present, far, 1000 + MIN_DWELL_MS + 1, PARISHES)
    expect(s.mode).toBe('diocese')
  })

  it('allows the very first transition immediately', () => {
    const s = nextPresence(INITIAL_PRESENCE, at, 1, PARISHES)
    expect(s.mode).toBe('present')
  })

  it('keeps updating distance even while a mode change is suppressed', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 1000, PARISHES)
    const s = nextPresence(present, far, 1000 + 500, PARISHES)
    expect(s.mode).toBe('present')
    expect(s.distance).toBeGreaterThan(1000)
  })

  it('does not leave the force sentinel armed after a transition at now=0', () => {
    const present = nextPresence(INITIAL_PRESENCE, at, 0, PARISHES)
    expect(present.mode).toBe('present')
    // One millisecond later the debounce must still be in force.
    const s = nextPresence(present, far, 1, PARISHES)
    expect(s.mode).toBe('present')
  })
})
