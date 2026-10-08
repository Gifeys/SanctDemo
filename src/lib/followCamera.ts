import { haversineMeters, type Coordinates } from './geo'
import { shortestAngleDelta } from './heading'

/**
 * The camera that walks with you.
 *
 * ## What was missing
 *
 * Navigation closed in on the walker once, at 17.5, and then left the
 * camera where it was. Walk fifty metres and you are off the edge of your
 * own route; the map is still showing the corner you started from. Every
 * turn-by-turn app people have actually used - Waze, Google Maps - keeps
 * the walker pinned to the same spot on the screen and moves the world
 * underneath them instead.
 *
 * ## Why the maths is out here
 *
 * None of it can be exercised in a browser. It is driven by a GPS fix and
 * a magnetometer, neither of which a laptop has, so a camera decision made
 * inside the map component can only be tested by walking outside with a
 * handset. Out here it is four pure functions over numbers.
 *
 * ## The three rules
 *
 * 1. The walker sits low on the screen, not in the middle, so most of the
 *    map shows where they are GOING. That is the `offset`.
 * 2. The map turns so the direction of travel is up. A route that bends
 *    left on screen then means a left turn in the street, which is the
 *    whole reason course-up exists.
 * 3. Nothing moves unless something has actually changed. GPS jitters by a
 *    few metres while standing still and the compass wavers by a degree or
 *    two; re-issuing an eased camera move on every one of those restarts
 *    the animation and the map shivers.
 */

/** Close enough to read street names and see the next corner. */
export const FOLLOW_ZOOM = 17.5

/**
 * A modest tilt. Enough to give the road ahead some depth without the
 * horizon swallowing the top of the screen - past about 60 the far end of
 * the route stretches to a vanishing point and the labels pile up.
 */
export const FOLLOW_PITCH = 50

/**
 * How far down the screen the walker sits, in pixels below centre.
 *
 * Positive moves the CAMERA's target down, which puts the walker lower in
 * the frame and hands the upper two-thirds to the road ahead.
 */
export const FOLLOW_OFFSET_Y = 90

/** Below this, a new fix is indistinguishable from standing still. */
export const POSITION_EPSILON_M = 3

/** Below this, a bearing change is the compass wavering, not a turn. */
export const BEARING_EPSILON_DEG = 2

export interface CameraState {
  center: Coordinates
  bearing: number
  zoom: number
}

export interface FollowCamera {
  center: [number, number]
  bearing: number
  zoom: number
  pitch: number
  offset: [number, number]
}

/**
 * Where the camera should be for a walker at `position` facing `heading`.
 *
 * `heading` of null means no compass: the map keeps whatever bearing it
 * has rather than snapping to north, because a map that spins to north the
 * moment the magnetometer drops out is worse than one that simply stops
 * turning.
 */
export function followCamera(
  position: Coordinates,
  heading: number | null,
  currentBearing: number,
  zoom: number = FOLLOW_ZOOM,
): FollowCamera {
  return {
    center: [position.lng, position.lat],
    bearing: heading ?? currentBearing,
    zoom,
    pitch: FOLLOW_PITCH,
    offset: [0, FOLLOW_OFFSET_Y],
  }
}

/**
 * Whether the camera has drifted far enough from the walker to be worth
 * moving.
 *
 * Both thresholds have to be crossed for nothing to happen - a turn on the
 * spot still re-aims the camera even though the walker has not moved, and
 * walking in a straight line still follows them even though the bearing is
 * unchanged.
 */
export function needsCameraMove(
  current: CameraState,
  position: Coordinates,
  heading: number | null,
): boolean {
  if (haversineMeters(current.center, position) >= POSITION_EPSILON_M) return true
  if (heading === null) return false
  return Math.abs(shortestAngleDelta(current.bearing, heading)) >= BEARING_EPSILON_DEG
}

/**
 * How long the camera should take to get there.
 *
 * Matched to the GPS, not chosen for looks. Fixes arrive about once a
 * second, so an ease that outlasts the gap is still running when the next
 * one arrives and gets cancelled mid-flight - which is the stutter people
 * describe as the map "fighting itself". Anything shorter than the gap
 * leaves the camera parked between fixes, so this aims just under it.
 */
export const FOLLOW_DURATION_MS = 800

/**
 * Whether the app should still be driving the camera.
 *
 * Panning the map during navigation is a deliberate act - checking what is
 * down a side street, or how far the destination still is - and a camera
 * that drags you back a second later makes that impossible. So a drag
 * suspends following until the walker asks to be recentred.
 */
export function shouldFollow(navigating: boolean, userPanned: boolean): boolean {
  return navigating && !userPanned
}
