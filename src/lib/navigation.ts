// Turn-by-turn navigation: instructions, progress along a route, and knowing
// when the pilgrim has left it.
//
// Pure and sensor-free, like heading.ts and for the same reason — the only
// honest way to test navigation without walking a kilometre with a handset is
// to feed it positions and assert on what it says.
//
// Distances here use a local flat-earth approximation rather than haversine
// for the point-to-segment maths. Over the tens of metres these calculations
// span, inside one diocese, the error is under a centimetre, and projecting to
// metres first is what makes "how far am I from this line" expressible at all.

import { classifyHeading, COMPASS_POINTS_8 } from './heading'
import { haversineMeters, type Coordinates } from './geo'

/** One OSRM step, narrowed to the fields this app actually uses. */
export interface RouteStep {
  /** Street name, empty for unnamed paths. */
  name: string
  /** Metres covered by this step. */
  distanceMeters: number
  maneuver: {
    type: string
    modifier?: string
    /** [lng, lat] — where the manoeuvre happens. */
    location: [number, number]
    bearingAfter?: number
  }
}

/**
 * How far off the line the pilgrim may drift before it counts as off-route.
 *
 * Generous on purpose. A phone in a street of low buildings routinely reports
 * 20–30m of error, and a threshold tight enough to catch a genuine wrong turn
 * quickly is also tight enough to fire constantly while standing still.
 */
export const OFF_ROUTE_METERS = 35

/**
 * Consecutive off-route fixes before a reroute is triggered.
 *
 * The distance threshold alone is not enough: GPS jumps. Requiring several
 * fixes in a row means a single bad reading cannot throw away a good route,
 * at the cost of a second or two before a real wrong turn is noticed — the
 * right trade, since rerouting mid-street is far more disorienting than a
 * moment's delay.
 */
export const OFF_ROUTE_STRIKES = 3

/** Within this distance of a manoeuvre, it counts as reached. */
export const STEP_REACHED_METERS = 18

/** Metres per degree of latitude. Constant enough anywhere on Earth. */
const METERS_PER_DEG_LAT = 111_320

function toLocalMeters(point: Coordinates, origin: Coordinates): { x: number; y: number } {
  const latRadians = (origin.lat * Math.PI) / 180
  return {
    x: (point.lng - origin.lng) * METERS_PER_DEG_LAT * Math.cos(latRadians),
    y: (point.lat - origin.lat) * METERS_PER_DEG_LAT,
  }
}

/**
 * Shortest distance in metres from a point to the segment a–b.
 *
 * Segment, not infinite line: past either end the nearest point is the
 * endpoint itself. Using an infinite line would report a pilgrim standing
 * beyond the end of a street as being on it.
 */
export function distanceToSegment(point: Coordinates, a: Coordinates, b: Coordinates): number {
  const p = toLocalMeters(point, a)
  const q = toLocalMeters(b, a)
  const lengthSquared = q.x * q.x + q.y * q.y

  if (lengthSquared === 0) return Math.hypot(p.x, p.y)

  // How far along a→b the perpendicular lands, clamped into the segment.
  const t = Math.max(0, Math.min(1, (p.x * q.x + p.y * q.y) / lengthSquared))
  return Math.hypot(p.x - t * q.x, p.y - t * q.y)
}

/** Shortest distance from a point to a whole path, in metres. */
export function distanceToPath(point: Coordinates, path: Coordinates[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY
  if (path.length === 1) return haversineMeters(point, path[0])

  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegment(point, path[i], path[i + 1])
    if (d < best) best = d
  }
  return best
}

/**
 * Turns one OSRM manoeuvre into something a walker can act on.
 *
 * OSRM describes a manoeuvre as a type plus a modifier ("turn"/"left"); this
 * is where that becomes English. Two details matter:
 *
 * - An unnamed path is common on foot — alleys, church grounds, cut-throughs.
 *   "Turn left onto " with nothing after it is worse than "Turn left", so the
 *   street name is appended only when there is one.
 * - The departure instruction uses the compass, not a turn: at the start
 *   there is no previous heading to turn from, so "Head northeast" is the
 *   only thing that can be said. That reuses the same eight-point rose the
 *   compass UI shows, so the words match what the dial is displaying.
 */
export function instructionFor(step: RouteStep): string {
  const { type, modifier, bearingAfter } = step.maneuver
  const onto = step.name ? ` onto ${step.name}` : ''
  const on = step.name ? ` on ${step.name}` : ''

  const turn = (verb: string) => {
    switch (modifier) {
      case 'left':
        return `${verb} left${onto}`
      case 'right':
        return `${verb} right${onto}`
      case 'slight left':
        return `${verb} slightly left${onto}`
      case 'slight right':
        return `${verb} slightly right${onto}`
      case 'sharp left':
        return `${verb} sharply left${onto}`
      case 'sharp right':
        return `${verb} sharply right${onto}`
      case 'uturn':
        return `Turn around${onto}`
      case 'straight':
      default:
        return `Continue straight${onto}`
    }
  }

  switch (type) {
    case 'depart':
      return bearingAfter != null
        ? `Head ${classifyHeading(bearingAfter, COMPASS_POINTS_8).name.toLowerCase()}${on}`
        : `Set off${on}`
    case 'arrive':
      return 'Arrive at your destination'
    case 'turn':
    case 'end of road':
      return turn('Turn')
    case 'fork':
      return turn('Keep')
    case 'merge':
      return turn('Merge')
    case 'new name':
      return step.name ? `Continue onto ${step.name}` : 'Continue straight'
    case 'continue':
      return `Continue${on}`
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${onto}`
    default:
      return turn('Turn')
  }
}

export interface NavigationProgress {
  /** Index of the step currently being followed. */
  stepIndex: number
  /** Metres to the next manoeuvre. */
  metersToManeuver: number
  /** Metres remaining to the destination. */
  metersRemaining: number
  /** True once the destination has been reached. */
  arrived: boolean
}

/**
 * Where the pilgrim is along a route.
 *
 * `stepIndex` only ever moves forward. Walking back past a manoeuvre — which
 * happens constantly from GPS noise near a corner — must not rewind the
 * instruction, or the app spends the whole junction flipping between "turn
 * left" and "continue".
 */
export function progressAlong(
  position: Coordinates,
  steps: RouteStep[],
  destination: Coordinates,
  previousStepIndex = 0,
): NavigationProgress {
  if (steps.length === 0) {
    const metersRemaining = haversineMeters(position, destination)
    return { stepIndex: 0, metersToManeuver: metersRemaining, metersRemaining, arrived: metersRemaining <= STEP_REACHED_METERS }
  }

  let stepIndex = Math.min(previousStepIndex, steps.length - 1)

  // Scan forward for the LAST manoeuvre already reached, rather than
  // advancing only while the current one is in reach.
  //
  // The difference matters when a fix arrives late, or when steps are short
  // enough that two are passed between updates: the current step's manoeuvre
  // is then already behind the pilgrim and far away, a "stop as soon as the
  // current one is out of reach" loop breaks immediately, and the app keeps
  // showing an instruction for a turn that was taken two corners ago.
  let lastReached = -1
  for (let i = stepIndex; i < steps.length; i++) {
    const [lng, lat] = steps[i].maneuver.location
    if (haversineMeters(position, { lat, lng }) <= STEP_REACHED_METERS) lastReached = i
  }
  if (lastReached >= 0) stepIndex = Math.min(lastReached + 1, steps.length - 1)

  const [lng, lat] = steps[stepIndex].maneuver.location
  const metersToManeuver = haversineMeters(position, { lat, lng })
  const metersRemaining = haversineMeters(position, destination)

  return {
    stepIndex,
    metersToManeuver,
    metersRemaining,
    arrived: metersRemaining <= STEP_REACHED_METERS,
  }
}

export interface OffRouteState {
  strikes: number
  offRoute: boolean
}

/**
 * Tracks whether the pilgrim has genuinely left the route.
 *
 * Returns the next state; the caller keeps it between fixes. A single fix
 * inside the corridor resets the count completely — a wrong turn produces a
 * run of off-route fixes, whereas noise produces one or two among good ones.
 */
export function nextOffRouteState(
  position: Coordinates,
  path: Coordinates[],
  previous: OffRouteState = { strikes: 0, offRoute: false },
  { thresholdMeters = OFF_ROUTE_METERS, strikesNeeded = OFF_ROUTE_STRIKES } = {},
): OffRouteState {
  const distance = distanceToPath(position, path)

  if (distance <= thresholdMeters) return { strikes: 0, offRoute: false }

  const strikes = previous.strikes + 1
  return { strikes, offRoute: strikes >= strikesNeeded }
}

/** "In 40 m, turn left onto A. Mabini Street" — the spoken-style line. */
export function announcementFor(step: RouteStep, metersToManeuver: number): string {
  const instruction = instructionFor(step)
  if (step.maneuver.type === 'arrive') return instruction
  if (metersToManeuver <= STEP_REACHED_METERS) return instruction
  return `In ${Math.round(metersToManeuver / 10) * 10} m, ${instruction[0].toLowerCase()}${instruction.slice(1)}`
}
