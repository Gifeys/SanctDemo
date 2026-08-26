// Compass heading: classification, smoothing and formatting.
//
// Deliberately pure and sensor-free. The device sensors that feed this only
// exist on a phone — a laptop has no magnetometer, so nothing downstream of
// here can be exercised in a dev browser at all. Keeping the maths in a
// module with no DOM dependency is what makes steps 2–6 of this feature
// verifiable without walking outside with a handset.
//
// Angles throughout are compass bearings in degrees: 0 = north, increasing
// clockwise, so 90 = east. That is the convention both DeviceOrientationEvent
// and MapLibre's `bearing` use, so no conversion is needed at either edge.

/** A named compass sector. `centre` is the bearing the name points at. */
export interface CompassPoint {
  name: string
  abbreviation: string
  centre: number
}

/**
 * The 8-point rose, as the client specified: N/NE/E/SE/S/SW/W/NW.
 *
 * Exported as data rather than baked into a switch so the sector set is
 * configurable — `classifyHeading` derives sector width from the array's
 * length, so passing a 4- or 16-point rose works with no code change.
 */
export const COMPASS_POINTS_8: readonly CompassPoint[] = [
  { name: 'North', abbreviation: 'N', centre: 0 },
  { name: 'Northeast', abbreviation: 'NE', centre: 45 },
  { name: 'East', abbreviation: 'E', centre: 90 },
  { name: 'Southeast', abbreviation: 'SE', centre: 135 },
  { name: 'South', abbreviation: 'S', centre: 180 },
  { name: 'Southwest', abbreviation: 'SW', centre: 225 },
  { name: 'West', abbreviation: 'W', centre: 270 },
  { name: 'Northwest', abbreviation: 'NW', centre: 315 },
]

/** The cardinal-only rose, for UI too small to carry eight labels. */
export const COMPASS_POINTS_4: readonly CompassPoint[] = [
  { name: 'North', abbreviation: 'N', centre: 0 },
  { name: 'East', abbreviation: 'E', centre: 90 },
  { name: 'South', abbreviation: 'S', centre: 180 },
  { name: 'West', abbreviation: 'W', centre: 270 },
]

/**
 * Wraps any angle into [0, 360).
 *
 * Sensor readings and accumulated smoothing both drift outside that range —
 * a heading of -5° and one of 355° are the same direction, and every
 * comparison below assumes a single canonical form.
 */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0
  return ((degrees % 360) + 360) % 360
}

/**
 * The signed shortest rotation from `from` to `to`, in (-180, 180].
 *
 * Naive subtraction takes the long way round the discontinuity at north:
 * turning from 350° to 10° is a 20° turn right, not a 340° turn left. Every
 * piece of smoothing and animation here has to go the short way or the map
 * spins almost all the way around whenever the pilgrim crosses north.
 */
export function shortestAngleDelta(from: number, to: number): number {
  const diff = (normalizeDegrees(to) - normalizeDegrees(from) + 540) % 360 - 180
  // `% 360` yields -180 for an exact half turn; normalise to +180 so the
  // result is consistently in (-180, 180] and a half turn always rotates
  // the same way rather than depending on float sign.
  return diff === -180 ? 180 : diff
}

/**
 * Names the sector a bearing falls in.
 *
 * Sector width comes from `points.length`, so the same function serves a
 * 4-, 8- or 16-point rose. Each name owns the band centred on its bearing:
 * with 8 points that is ±22.5°, so 337.5°–22.5° is North.
 */
export function classifyHeading(
  degrees: number,
  points: readonly CompassPoint[] = COMPASS_POINTS_8,
): CompassPoint {
  const sector = 360 / points.length
  const index = Math.round(normalizeDegrees(degrees) / sector) % points.length
  return points[index]
}

/** "Southeast" — the sector name alone, for prose like "Head Southeast". */
export function headingToDirectionName(
  degrees: number,
  points: readonly CompassPoint[] = COMPASS_POINTS_8,
): string {
  return classifyHeading(degrees, points).name
}

/** "142° SE" — for a compact readout beside the compass. */
export function formatHeading(
  degrees: number,
  points: readonly CompassPoint[] = COMPASS_POINTS_8,
): string {
  const normalized = normalizeDegrees(degrees)
  return `${Math.round(normalized)}° ${classifyHeading(normalized, points).abbreviation}`
}

/**
 * How much of a new reading to accept per update, 0–1. Lower is smoother and
 * laggier. 0.15 settles a turn in roughly half a second at the ~60Hz these
 * sensor events arrive at, while flattening the several-degree jitter a phone
 * magnetometer produces when held still.
 */
export const DEFAULT_SMOOTHING_ALPHA = 0.15

/**
 * Below this, a new reading is treated as noise and ignored outright.
 *
 * Exponential smoothing alone still creeps: a magnetometer sitting still
 * wanders a degree or two, and feeding that through a filter produces a
 * marker that drifts perpetually instead of resting. A deadband makes
 * "not moving" an actual state.
 */
export const DEFAULT_HEADING_DEADBAND_DEGREES = 1.5

export interface SmoothHeadingOptions {
  alpha?: number
  deadbandDegrees?: number
}

/**
 * One step of exponential smoothing, wraparound-safe.
 *
 * Interpolating raw values would sweep the wrong way across north — from
 * 350° toward 10° the arithmetic mean is 180°, pointing due south. Smoothing
 * the *delta* instead and adding it back keeps every turn on the short arc.
 *
 * `previous` of null means this is the first reading: adopt it exactly, so
 * the marker appears already pointing the right way rather than swinging up
 * from north.
 */
export function smoothHeading(
  previous: number | null,
  next: number,
  { alpha = DEFAULT_SMOOTHING_ALPHA, deadbandDegrees = DEFAULT_HEADING_DEADBAND_DEGREES }: SmoothHeadingOptions = {},
): number {
  const target = normalizeDegrees(next)
  if (previous === null) return target

  const current = normalizeDegrees(previous)
  const delta = shortestAngleDelta(current, target)
  if (Math.abs(delta) < deadbandDegrees) return current

  return normalizeDegrees(current + delta * alpha)
}
