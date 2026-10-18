import { describe, expect, it } from 'vitest'
import {
  APPROACH_ZOOM,
  BEARING_EPSILON_DEG,
  CRUISE_ZOOM,
  FOLLOW_OFFSET_Y,
  FOLLOW_PITCH,
  FOLLOW_ZOOM,
  followCamera,
  needsCameraMove,
  POSITION_EPSILON_M,
  needsZoomChange,
  shouldFollow,
  TURN_FAR_M,
  TURN_NEAR_M,
  zoomForTurn,
  type CameraState,
} from './followCamera'

const MHCP = { lat: 14.6507, lng: 120.9676 }

/** A point `metres` due north of `from`. 1 degree of latitude ≈ 111320 m. */
function north(from: { lat: number; lng: number }, metres: number) {
  return { lat: from.lat + metres / 111320, lng: from.lng }
}

function state(over: Partial<CameraState> = {}): CameraState {
  return { center: MHCP, bearing: 0, zoom: FOLLOW_ZOOM, ...over }
}

describe('followCamera', () => {
  it('centres on the walker', () => {
    const cam = followCamera(MHCP, 90, 0)
    expect(cam.center).toEqual([MHCP.lng, MHCP.lat])
  })

  it('turns the map so the direction of travel is up', () => {
    expect(followCamera(MHCP, 90, 0).bearing).toBe(90)
    expect(followCamera(MHCP, 270, 10).bearing).toBe(270)
  })

  it('keeps the current bearing when there is no compass', () => {
    // Not 0. Snapping to north the moment the magnetometer drops out
    // spins the whole map under someone mid-walk.
    expect(followCamera(MHCP, null, 143).bearing).toBe(143)
  })

  it('sits the walker low in the frame, not in the middle', () => {
    const cam = followCamera(MHCP, 0, 0)
    expect(cam.offset).toEqual([0, FOLLOW_OFFSET_Y])
    expect(FOLLOW_OFFSET_Y).toBeGreaterThan(0)
  })

  it('tilts, but not so far the horizon takes the screen', () => {
    expect(followCamera(MHCP, 0, 0).pitch).toBe(FOLLOW_PITCH)
    expect(FOLLOW_PITCH).toBeGreaterThan(0)
    expect(FOLLOW_PITCH).toBeLessThanOrEqual(60)
  })

  it('zooms close enough to read a street', () => {
    expect(followCamera(MHCP, 0, 0).zoom).toBe(FOLLOW_ZOOM)
    expect(FOLLOW_ZOOM).toBeGreaterThanOrEqual(16)
  })

  it('honours an explicit zoom, so the walker can zoom out and stay followed', () => {
    expect(followCamera(MHCP, 0, 0, 15).zoom).toBe(15)
  })
})

describe('needsCameraMove', () => {
  it('stands still: GPS jitter of a metre or two moves nothing', () => {
    expect(needsCameraMove(state(), north(MHCP, 1), 0)).toBe(false)
  })

  it('follows once the walker has actually walked', () => {
    expect(needsCameraMove(state(), north(MHCP, POSITION_EPSILON_M + 2), 0)).toBe(true)
  })

  it('ignores the compass wavering a degree', () => {
    expect(needsCameraMove(state({ bearing: 90 }), MHCP, 91)).toBe(false)
  })

  it('re-aims for a real turn, even standing still', () => {
    // The walker turns a corner without moving. The map must turn too, or
    // the route on screen points the wrong way.
    expect(needsCameraMove(state({ bearing: 90 }), MHCP, 90 + BEARING_EPSILON_DEG + 1)).toBe(true)
  })

  it('treats the turn as the shorter way round', () => {
    // 359 -> 1 is two degrees, not 358. Subtracting raw would make every
    // pass through north look like a U-turn.
    expect(needsCameraMove(state({ bearing: 359 }), MHCP, 0)).toBe(false)
    expect(needsCameraMove(state({ bearing: 359 }), MHCP, 10)).toBe(true)
  })

  it('does not move on bearing alone when there is no compass', () => {
    expect(needsCameraMove(state(), MHCP, null)).toBe(false)
  })

  it('still follows a moving walker with no compass', () => {
    expect(needsCameraMove(state(), north(MHCP, 20), null)).toBe(true)
  })
})

describe('shouldFollow', () => {
  it('follows while navigating', () => {
    expect(shouldFollow(true, false)).toBe(true)
  })

  it('lets go the moment the walker pans the map', () => {
    expect(shouldFollow(true, true)).toBe(false)
  })

  it('never drives the camera when navigation is not running', () => {
    expect(shouldFollow(false, false)).toBe(false)
  })
})

describe('zoomForTurn', () => {
  it('closes in when the turn is on top of you', () => {
    // The moment the two candidate streets are metres apart is exactly
    // when they need to be far apart on screen.
    expect(zoomForTurn(10)).toBe(APPROACH_ZOOM)
    expect(zoomForTurn(TURN_NEAR_M)).toBe(APPROACH_ZOOM)
  })

  it('pulls back on open road, to show where you are going', () => {
    expect(zoomForTurn(600)).toBe(CRUISE_ZOOM)
    expect(zoomForTurn(TURN_FAR_M)).toBe(CRUISE_ZOOM)
  })

  it('moves between the two without a step change', () => {
    // A jump in zoom reads as the map lurching, and it would land just as
    // the walker is looking for a street sign.
    const mid = zoomForTurn((TURN_NEAR_M + TURN_FAR_M) / 2)
    expect(mid).toBeLessThan(APPROACH_ZOOM)
    expect(mid).toBeGreaterThan(CRUISE_ZOOM)
  })

  it('tightens monotonically as the turn approaches', () => {
    const far = zoomForTurn(240)
    const nearer = zoomForTurn(120)
    const nearest = zoomForTurn(60)
    expect(nearer).toBeGreaterThan(far)
    expect(nearest).toBeGreaterThan(nearer)
  })

  it('keeps the plain follow zoom when nothing is being approached', () => {
    // No active guidance is not the same as a turn infinitely far away:
    // dropping to CRUISE_ZOOM there would zoom the map out the instant
    // navigation ended.
    expect(zoomForTurn(null)).toBe(FOLLOW_ZOOM)
    expect(zoomForTurn(Number.NaN)).toBe(FOLLOW_ZOOM)
  })
})

describe('needsZoomChange', () => {
  it('ignores the jitter of a recomputed zoom', () => {
    // zoomForTurn returns a slightly different number on every GPS fix;
    // acting on each one makes the map breathe while standing still.
    expect(needsZoomChange(17.5, 17.55)).toBe(false)
  })

  it('acts on a real approach', () => {
    expect(needsZoomChange(CRUISE_ZOOM, APPROACH_ZOOM)).toBe(true)
  })
})
