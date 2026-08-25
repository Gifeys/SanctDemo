import { haversineMeters, type Coordinates } from './geo'

// OSRM's public demo server — free, keyless, no billing account (the same
// requirement that ruled out Google/Mapbox for the base map itself). It
// carries no uptime guarantee and rate-limits under load, so every call
// here is time-boxed and backed by a straight-line fallback: routing must
// never leave the UI on a spinner or an error where a route should be.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot'
const DEFAULT_TIMEOUT_MS = 5000

// A brisk, sustainable adult walking pace on a paved urban route.
//
// OSRM's own `duration` field is NEVER used, for either a routed or a
// direct result. Verified against the two live parishes: OSRM's demo
// server returned duration: 240s (4 min) for a 1850m foot route — that's
// ~28 km/h, the server's default vehicle-profile speed, not a walking
// pace corrected for the "foot" profile it was asked for. Only
// `distance` from OSRM is trustworthy; duration is always derived from
// distance at WALK_SPEED_MPS instead.
export const WALK_SPEED_MPS = 5000 / 3600 // 5 km/h

export interface WalkingRoute {
  // 'routed': geometry follows OSRM's street path. 'direct': OSRM was
  // unreachable, timed out, or returned no usable route — geometry is a
  // straight line between the two points and callers must label the
  // distance as a direct/straight-line distance, never as "walking route".
  kind: 'routed' | 'direct'
  path: Coordinates[]
  distanceMeters: number
  durationMinutes: number
}

function walkingMinutes(distanceMeters: number): number {
  return distanceMeters / WALK_SPEED_MPS / 60
}

function directRoute(from: Coordinates, to: Coordinates): WalkingRoute {
  const distanceMeters = haversineMeters(from, to)
  return {
    kind: 'direct',
    path: [from, to],
    distanceMeters,
    durationMinutes: walkingMinutes(distanceMeters),
  }
}

interface FetchWalkingRouteOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function fetchWalkingRoute(
  from: Coordinates,
  to: Coordinates,
  options: FetchWalkingRouteOptions = {},
): Promise<WalkingRoute> {
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return directRoute(from, to)

    const data = await res.json()
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates
    if (data?.code !== 'Ok' || !coords || coords.length < 2) {
      return directRoute(from, to)
    }

    const path: Coordinates[] = coords.map(([lng, lat]) => ({ lat, lng }))
    const distanceMeters: number = data.routes[0].distance
    return {
      kind: 'routed',
      path,
      distanceMeters,
      durationMinutes: walkingMinutes(distanceMeters),
    }
  } catch {
    // Network failure, non-JSON body, or the abort() above firing on
    // timeout — all collapse to the same safe outcome.
    return directRoute(from, to)
  } finally {
    clearTimeout(timer)
  }
}

// Metres under 1km, one decimal km above — matches how the app already
// reads distances elsewhere (geofence radii, MapTab station distances).
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatWalkingMinutes(minutes: number): string {
  if (minutes < 1) return '<1 min walk'
  return `${Math.round(minutes)} min walk`
}
