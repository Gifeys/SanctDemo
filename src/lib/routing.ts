import { haversineMeters, type Coordinates } from './geo'
import type { RouteStep } from './navigation'

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
  /**
   * Turn-by-turn manoeuvres, when they were asked for and OSRM supplied them.
   * Always empty for a 'direct' route: a straight line across the map has no
   * turns, and inventing "head north, then arrive" for one would be worse
   * than saying nothing.
   */
  steps: RouteStep[]
}

/**
 * Narrows OSRM's steps to the fields this app uses.
 *
 * Defensive about shape rather than trusting the response: this is a public
 * demo server, the legs/steps nesting is easy to get wrong, and a malformed
 * step would otherwise crash navigation mid-walk. Anything unparseable is
 * dropped, and an empty list simply means no turn-by-turn — which the UI
 * already has to handle for direct routes.
 */
function parseSteps(route: any): RouteStep[] {
  const legs = Array.isArray(route?.legs) ? route.legs : []
  const steps: RouteStep[] = []

  for (const leg of legs) {
    for (const raw of Array.isArray(leg?.steps) ? leg.steps : []) {
      const location = raw?.maneuver?.location
      if (!Array.isArray(location) || location.length < 2) continue
      if (typeof raw?.maneuver?.type !== 'string') continue

      steps.push({
        name: typeof raw.name === 'string' ? raw.name : '',
        distanceMeters: typeof raw.distance === 'number' ? raw.distance : 0,
        maneuver: {
          type: raw.maneuver.type,
          modifier: typeof raw.maneuver.modifier === 'string' ? raw.maneuver.modifier : undefined,
          location: [location[0], location[1]],
          bearingAfter:
            typeof raw.maneuver.bearing_after === 'number' ? raw.maneuver.bearing_after : undefined,
        },
      })
    }
  }

  return steps
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
    steps: [],
  }
}

interface FetchWalkingRouteOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /**
   * Ask OSRM for turn-by-turn steps. Off by default: the map's own route
   * line and the distance readouts do not need them, and the response is
   * substantially larger with them.
   */
  withSteps?: boolean
}

export async function fetchWalkingRoute(
  from: Coordinates,
  to: Coordinates,
  options: FetchWalkingRouteOptions = {},
): Promise<WalkingRoute> {
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, withSteps = false } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url =
      `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson${withSteps ? '&steps=true' : ''}`
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
      steps: withSteps ? parseSteps(data.routes[0]) : [],
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

// Pure result + label logic behind the map popup's "Get directions" action,
// extracted so it's unit-testable without MapLibre/DOM (mirrors mapSearch.ts
// and mapMarkers.ts, extracted for the same reason). The caller (
// DioceseMapLive.tsx) is responsible for everything this can't express as a
// pure function: reading the pilgrim's *current* position at click time,
// superseding a stale in-flight request with a newer one, drawing/updating
// the map layer, and fitting the camera to the route.
export type DirectionsResult =
  // No known position yet — the caller must say why it can't route rather
  // than failing silently (no position, no button spinner that never ends).
  | { status: 'no-position' }
  | { status: 'ok'; route: WalkingRoute; label: string }

export async function getWalkingDirections(
  from: Coordinates | null,
  to: Coordinates,
  options: FetchWalkingRouteOptions = {},
): Promise<DirectionsResult> {
  if (!from) return { status: 'no-position' }

  const route = await fetchWalkingRoute(from, to, options)
  const label =
    route.kind === 'routed'
      ? `${formatDistance(route.distanceMeters)} walk · ${formatWalkingMinutes(route.durationMinutes)}`
      // OSRM was unreachable/timed out/returned nothing usable — this is a
      // straight-line distance, never presented as a walking route.
      : `${formatDistance(route.distanceMeters)} direct (straight-line — walking route unavailable)`

  return { status: 'ok', route, label }
}
