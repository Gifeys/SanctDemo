import { haversineMeters, type Coordinates } from './geo'
import { normalizeDegrees, shortestAngleDelta, smoothHeading } from './heading'

/**
 * Which way the walker is going, worked out from where they have been.
 *
 * ## Why this exists
 *
 * Navigation turned the map course-up using the magnetometer, and
 * followCamera falls back to the CURRENT bearing when there is no heading
 * - so on a handset that reports no absolute orientation, nothing turns
 * at all. Reported from the street as turning round and the arrow not
 * turning with you: there was no compass reading, so there was no course,
 * so the map kept the bearing it already had.
 *
 * Two consecutive fixes give a bearing without any compass at all. It is
 * also the better signal while actually walking: a magnetometer indoors or
 * beside a jeepney is pulled tens of degrees off, whereas the line between
 * two positions is the direction you really went.
 *
 * What it cannot do is tell you which way you are FACING while standing
 * still - there is no movement to take a bearing from. So this supplements
 * the compass rather than replacing it, and holds its last value when the
 * walker stops instead of spinning on GPS noise.
 */

/**
 * Below this, a change of position is noise rather than a step.
 *
 * A stationary phone wanders by a few metres from fix to fix, and the
 * bearing between two such samples is uniformly random - acting on it
 * spins the map while the walker stands still reading it.
 */
export const COURSE_MIN_MOVE_M = 4

/**
 * How fast the course converges on a turn, 0-1 per update.
 *
 * Deliberately NOT heading.ts's DEFAULT_SMOOTHING_ALPHA. That constant is
 * 0.15 and its own comment says why: it settles in about half a second
 * "at the ~60Hz these sensor events arrive at". Borrowing it here was a
 * mistake - these updates arrive once every few METRES of walking, call
 * it one every four seconds, so fifteen updates to land a turn is over a
 * minute. Reported from the street as the map taking forever to notice a
 * change of direction, and that is arithmetic, not a feeling.
 */
export const COURSE_ALPHA = 0.5

/**
 * Past this much of a change, stop smoothing and take the new bearing.
 *
 * A gentle drift is noise to be filtered; a sharp change is a corner, and
 * the walker already knows they turned. Easing through 90 degrees over
 * several updates only means the map disagrees with them the whole way
 * round. Below this, smoothing still does its job.
 */
export const COURSE_SNAP_DEGREES = 50

/** Initial bearing from a to b, in degrees clockwise from north. */
export function courseBetween(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLng = toRad(b.lng - a.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI)
}

export interface CourseState {
  /** The last position a bearing was taken from. */
  from: Coordinates | null
  /** Degrees, or null until the walker has moved far enough once. */
  course: number | null
}

/**
 * Folds one new fix into the running course.
 *
 * Returns the next state; the caller keeps it between fixes. A fix closer
 * than COURSE_MIN_MOVE_M changes nothing at all - not the course, and not
 * the anchor it is measured from, so several small steps still accumulate
 * into one honest bearing rather than being discarded one by one.
 */
export function nextCourse(
  previous: CourseState,
  position: Coordinates,
  minMoveMeters: number = COURSE_MIN_MOVE_M,
): CourseState {
  if (!previous.from) return { from: position, course: previous.course }
  if (haversineMeters(previous.from, position) < minMoveMeters) return previous

  const raw = courseBetween(previous.from, position)
  if (previous.course === null) return { from: position, course: raw }

  // A corner is taken at once; a wobble is smoothed.
  const turn = Math.abs(shortestAngleDelta(previous.course, raw))
  const course =
    turn >= COURSE_SNAP_DEGREES
      ? raw
      : smoothHeading(previous.course, raw, { alpha: COURSE_ALPHA })

  return { from: position, course }
}
