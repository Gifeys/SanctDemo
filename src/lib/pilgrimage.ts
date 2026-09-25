import { haversineMeters, type Coordinates } from './geo'
import { fetchWalkingRoute, walkingMinutesFor, type WalkingRoute } from './routing'

/**
 * Planning a visit to several churches in one go — a Bisita Iglesia.
 *
 * The tradition is seven churches on Maundy Thursday, and the app already
 * knows where all 31 parishes in the diocese are, so the useful thing it can
 * do is answer the question nobody can answer standing in the street with a
 * list: which one first, and which one after that.
 *
 * Everything here is pure. The ordering is what decides whether a group
 * walks 6km or 11km, so it is worth being able to test without a map, a
 * network or a browser.
 */

export interface TripStop {
  /** The diocese parish id, so a church cannot be added twice. */
  id: string
  name: string
  coordinates: Coordinates
  /** The tour route id when the parish has one, for the parish page link. */
  routeId?: string | null
}

/** One church-to-church hop, once the order has been decided. */
export interface TripLeg {
  from: Coordinates
  to: Coordinates
  /** The stop this leg ARRIVES at. The first leg starts at the pilgrim. */
  stop: TripStop
  route: WalkingRoute | null
}

export const MAX_TRIP_STOPS = 14

/**
 * The total length of a visit in a given order, as the crow flies.
 *
 * Straight-line, deliberately. Ordering compares thousands of candidate
 * orders against each other, and asking a public routing server for each
 * comparison would take minutes and hammer someone else's demo service.
 * Street distances are strictly longer than straight-line ones but they are
 * longer in much the same proportion across a few square kilometres of the
 * same city, so the ORDER this produces is the order the roads produce.
 * The distances shown to the pilgrim are always the measured road ones.
 */
export function tripLengthMetres(start: Coordinates | null, stops: readonly TripStop[]): number {
  let total = 0
  let cursor = start
  for (const stop of stops) {
    if (cursor) total += haversineMeters(cursor, stop.coordinates)
    cursor = stop.coordinates
  }
  return total
}

/**
 * The order to visit them in: nearest first, then improved.
 *
 * Two passes, because one is not enough:
 *
 * 1. **Nearest neighbour.** Start where the pilgrim is, repeatedly walk to
 *    the closest church not yet visited. This is what "which one first" means
 *    to someone standing in the street, and it is a good route most of the
 *    time.
 * 2. **2-opt.** Nearest neighbour has one well-known failure: it takes every
 *    easy church first and leaves the far one for last, so the route ends
 *    with a long doubling back across everything it already walked. 2-opt
 *    repeatedly reverses a section of the order whenever doing so shortens
 *    the total, which is exactly the move that untangles that crossing. It
 *    runs until no reversal helps.
 *
 * With no known position there is no "first", so the order given is kept —
 * reordering a list against an unknown starting point would just shuffle it.
 *
 * The cost is O(n^2) per improvement sweep, which at MAX_TRIP_STOPS is a few
 * thousand comparisons: instant, and bounded.
 */
export function orderStops(start: Coordinates | null, stops: readonly TripStop[]): TripStop[] {
  if (!start || stops.length < 2) return [...stops]

  // 1. Nearest neighbour.
  const remaining = [...stops]
  const ordered: TripStop[] = []
  let cursor = start

  while (remaining.length > 0) {
    let best = 0
    let bestMetres = Infinity
    remaining.forEach((stop, index) => {
      const metres = haversineMeters(cursor, stop.coordinates)
      if (metres < bestMetres) {
        bestMetres = metres
        best = index
      }
    })
    const [next] = remaining.splice(best, 1)
    ordered.push(next)
    cursor = next.coordinates
  }

  // 2. 2-opt. An open path, not a loop: the pilgrim is not required to come
  // back to where they started, so the last stop's position is free and the
  // reversal window runs to the end of the list.
  let improved = true
  let guard = 0
  while (improved && guard < 64) {
    improved = false
    guard += 1
    for (let i = 0; i < ordered.length - 1; i++) {
      for (let k = i + 1; k < ordered.length; k++) {
        const candidate = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, k + 1).reverse(),
          ...ordered.slice(k + 1),
        ]
        if (tripLengthMetres(start, candidate) < tripLengthMetres(start, ordered) - 0.5) {
          ordered.splice(0, ordered.length, ...candidate)
          improved = true
        }
      }
    }
  }

  return ordered
}

/** True when this order is already the one orderStops would produce. */
export function isOptimalOrder(start: Coordinates | null, stops: readonly TripStop[]): boolean {
  if (!start || stops.length < 2) return true
  const best = orderStops(start, stops)
  // Compared on total length, not on identity: two orders can be the same
  // length (a pair of churches side by side), and telling someone their plan
  // can be improved when it cannot would be a lie the button then fails to
  // deliver on.
  return tripLengthMetres(start, stops) <= tripLengthMetres(start, best) + 0.5
}

export interface TripRoute {
  legs: TripLeg[]
  distanceMeters: number
  durationMinutes: number
  /** True when any leg fell back to a straight line — the UI must say so. */
  hasDirectLeg: boolean
}

/**
 * Measures every hop of the visit on real streets.
 *
 * Sequential rather than parallel. These go to OSRM's public demo server,
 * which rate-limits, and a seven-church visit firing seven simultaneous
 * requests is how a planner gets itself throttled into seven straight lines.
 * Seven requests at roughly a second each is a wait worth having for
 * distances that are true.
 *
 * A leg that cannot be routed comes back as a straight line rather than
 * failing the trip — fetchWalkingRoute already guarantees that — and
 * hasDirectLeg is how the UI knows not to call the total a walking distance.
 */
export async function measureTrip(
  start: Coordinates | null,
  stops: readonly TripStop[],
  fetchRoute: typeof fetchWalkingRoute = fetchWalkingRoute,
): Promise<TripRoute> {
  const legs: TripLeg[] = []
  let cursor = start

  for (const stop of stops) {
    if (!cursor) {
      // No fix yet: the first church has no measurable approach, but every
      // hop after it does, so the trip is still worth measuring.
      legs.push({ from: stop.coordinates, to: stop.coordinates, stop, route: null })
      cursor = stop.coordinates
      continue
    }
    const route = await fetchRoute(cursor, stop.coordinates)
    legs.push({ from: cursor, to: stop.coordinates, stop, route })
    cursor = stop.coordinates
  }

  const distanceMeters = legs.reduce((sum, leg) => sum + (leg.route?.distanceMeters ?? 0), 0)
  return {
    legs,
    distanceMeters,
    durationMinutes: walkingMinutesFor(distanceMeters),
    hasDirectLeg: legs.some(leg => leg.route?.kind === 'direct'),
  }
}

/** "5 hr 12 min", "48 min" — the form the trip footer uses. */
export function formatTripDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

/** A, B, C … for the stop markers, as a maps app labels them. */
export function stopLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}
