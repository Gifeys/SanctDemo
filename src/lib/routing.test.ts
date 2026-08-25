import { describe, it, expect, vi } from 'vitest'
import { fetchWalkingRoute, formatDistance, formatWalkingMinutes, getWalkingDirections, WALK_SPEED_MPS } from './routing'
import { haversineMeters } from './geo'

const MHCP = { lat: 14.637729, lng: 120.973456 }
const SRC = { lat: 14.651647, lng: 120.972648 }

function okResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response
}

describe('fetchWalkingRoute', () => {
  it('returns a routed result using OSRM distance, ignoring OSRM duration', async () => {
    // Mirrors the real response verified against the OSRM demo server for
    // MHCP -> SRC: distance 1850.5m, 82 geometry points, and a duration
    // (240.2s, ~28 km/h) that is wrong for walking and must be discarded.
    const coordinates = Array.from({ length: 82 }, (_, i) => [120.973 + i * 0.0001, 14.638 + i * 0.0001])
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({
        code: 'Ok',
        routes: [
          {
            distance: 1850.5,
            duration: 240.2, // must be ignored
            geometry: { coordinates },
          },
        ],
      }),
    )

    const route = await fetchWalkingRoute(MHCP, SRC, { fetchImpl })

    expect(route.kind).toBe('routed')
    expect(route.distanceMeters).toBe(1850.5)
    expect(route.path).toHaveLength(82)
    // First/last points round-trip lng/lat -> lat/lng correctly.
    expect(route.path[0]).toEqual({ lat: 14.638, lng: 120.973 })

    // Duration must come from distanceMeters / WALK_SPEED_MPS, not from
    // OSRM's duration field (240.2s / 60 = 4.003 min, which this is not).
    const expectedMinutes = 1850.5 / WALK_SPEED_MPS / 60
    expect(route.durationMinutes).toBeCloseTo(expectedMinutes, 6)
    expect(route.durationMinutes).not.toBeCloseTo(240.2 / 60, 1)
  })

  it('falls back to a straight line when the request rejects (network failure / timeout)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'))

    const route = await fetchWalkingRoute(MHCP, SRC, { fetchImpl, timeoutMs: 50 })

    expect(route.kind).toBe('direct')
    expect(route.path).toEqual([MHCP, SRC])
    expect(route.distanceMeters).toBeCloseTo(haversineMeters(MHCP, SRC), 6)
    expect(route.durationMinutes).toBeCloseTo(route.distanceMeters / WALK_SPEED_MPS / 60, 6)
  })

  it('falls back to a straight line on a real timeout (fetch never resolves)', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )

    const route = await fetchWalkingRoute(MHCP, SRC, { fetchImpl, timeoutMs: 20 })

    expect(route.kind).toBe('direct')
    expect(route.distanceMeters).toBeCloseTo(haversineMeters(MHCP, SRC), 6)
  })

  it('falls back to a straight line on a non-OK HTTP response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response)

    const route = await fetchWalkingRoute(MHCP, SRC, { fetchImpl })

    expect(route.kind).toBe('direct')
  })

  it('falls back to a straight line when OSRM reports a non-Ok code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ code: 'NoRoute', routes: [] }))

    const route = await fetchWalkingRoute(MHCP, SRC, { fetchImpl })

    expect(route.kind).toBe('direct')
  })
})

describe('getWalkingDirections', () => {
  // The pure logic behind the map popup's "Get directions" action — see
  // docs/reports/map-fixes-and-directions.md, defect 4.

  it("reports 'no-position' — never fails silently — when the pilgrim's position is unknown", async () => {
    const fetchImpl = vi.fn()
    const result = await getWalkingDirections(null, SRC, { fetchImpl })
    expect(result).toEqual({ status: 'no-position' })
    // Must not even attempt a network call with a null origin.
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('labels a successful routed result with distance and walking time, never OSRM duration', async () => {
    const coordinates = [[120.973, 14.638], [120.9726, 14.6516]]
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({
        code: 'Ok',
        routes: [{ distance: 1850.5, duration: 240.2, geometry: { coordinates } }],
      }),
    )

    const result = await getWalkingDirections(MHCP, SRC, { fetchImpl })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.route.kind).toBe('routed')
    expect(result.label).toBe('1.9 km walk · 22 min walk')
  })

  it('falls back to a clearly-labelled direct/straight-line distance when OSRM is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'))

    const result = await getWalkingDirections(MHCP, SRC, { fetchImpl })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.route.kind).toBe('direct')
    // Must read as a straight-line estimate, never presented as a walking route.
    expect(result.label).toContain('direct')
    expect(result.label).toContain('straight-line')
    expect(result.label).not.toContain('walk ·')
  })
})

describe('formatDistance', () => {
  it('formats sub-kilometre distances in whole metres', () => {
    expect(formatDistance(3)).toBe('3 m')
    expect(formatDistance(999)).toBe('999 m')
  })

  it('formats kilometre-plus distances with one decimal', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
    expect(formatDistance(1850)).toBe('1.9 km')
  })
})

describe('formatWalkingMinutes', () => {
  it('shows a floor label under a minute', () => {
    expect(formatWalkingMinutes(0.4)).toBe('<1 min walk')
  })

  it('rounds to the nearest minute otherwise', () => {
    expect(formatWalkingMinutes(22.2)).toBe('22 min walk')
  })
})
