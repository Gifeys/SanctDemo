import { describe, expect, it } from 'vitest'
import {
  COMPASS_POINTS_4,
  COMPASS_POINTS_8,
  classifyHeading,
  formatHeading,
  headingToDirectionName,
  normalizeDegrees,
  shortestAngleDelta,
  smoothHeading,
} from './heading'

describe('normalizeDegrees', () => {
  it('leaves an in-range bearing alone', () => {
    expect(normalizeDegrees(87)).toBe(87)
  })

  it('wraps negatives forward rather than leaving them signed', () => {
    expect(normalizeDegrees(-5)).toBe(355)
    expect(normalizeDegrees(-370)).toBe(350)
  })

  it('wraps values at or beyond a full turn', () => {
    expect(normalizeDegrees(360)).toBe(0)
    expect(normalizeDegrees(450)).toBe(90)
  })

  // A sensor that has not produced a fix yet can hand us NaN; a NaN heading
  // propagates into the marker's CSS transform and the map's bearing, where
  // it silently stops all rotation instead of erroring.
  it('falls back to north for non-finite input', () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0)
    expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('classifyHeading', () => {
  // The exact table the client specified.
  it.each([
    [0, 'North'],
    [45, 'Northeast'],
    [90, 'East'],
    [135, 'Southeast'],
    [180, 'South'],
    [225, 'Southwest'],
    [270, 'West'],
    [315, 'Northwest'],
  ])('%i° is %s', (degrees, expected) => {
    expect(headingToDirectionName(degrees)).toBe(expected)
  })

  // The client's own worked examples.
  it.each([
    [172, 'South'],
    [87, 'East'],
    [310, 'Northwest'],
  ])('%i° is %s', (degrees, expected) => {
    expect(headingToDirectionName(degrees)).toBe(expected)
  })

  it('claims the full ±22.5° band around each point', () => {
    expect(headingToDirectionName(23)).toBe('Northeast')
    expect(headingToDirectionName(22)).toBe('North')
    expect(headingToDirectionName(67)).toBe('Northeast')
    expect(headingToDirectionName(68)).toBe('East')
  })

  // The wrap at north is the one boundary a sector lookup gets wrong if it
  // buckets by flooring instead of rounding.
  it('wraps North across the 360/0 boundary', () => {
    expect(headingToDirectionName(350)).toBe('North')
    expect(headingToDirectionName(359.9)).toBe('North')
    expect(headingToDirectionName(0)).toBe('North')
    expect(headingToDirectionName(10)).toBe('North')
  })

  it('normalizes before classifying', () => {
    expect(headingToDirectionName(-90)).toBe('West')
    expect(headingToDirectionName(450)).toBe('East')
  })

  // Sector width is derived from the array, not hardcoded — this is what
  // makes the rose configurable rather than fixed at eight points.
  it('derives sector width from the supplied rose', () => {
    expect(classifyHeading(45, COMPASS_POINTS_4).name).toBe('East')
    expect(classifyHeading(44, COMPASS_POINTS_4).name).toBe('North')
    expect(classifyHeading(45, COMPASS_POINTS_8).name).toBe('Northeast')
  })
})

describe('formatHeading', () => {
  it('pairs a rounded bearing with its abbreviation', () => {
    expect(formatHeading(142)).toBe('142° SE')
    expect(formatHeading(0)).toBe('0° N')
  })

  it('normalizes before formatting', () => {
    expect(formatHeading(-5)).toBe('355° N')
  })
})

describe('shortestAngleDelta', () => {
  it('is signed by turn direction', () => {
    expect(shortestAngleDelta(0, 90)).toBe(90)
    expect(shortestAngleDelta(90, 0)).toBe(-90)
  })

  // The whole reason this function exists: naive subtraction would call this
  // a 340° turn and spin the map almost all the way around.
  it('takes the short way across north', () => {
    expect(shortestAngleDelta(350, 10)).toBe(20)
    expect(shortestAngleDelta(10, 350)).toBe(-20)
  })

  it('resolves an exact half turn to +180 rather than -180', () => {
    expect(shortestAngleDelta(0, 180)).toBe(180)
  })

  it('is zero for no turn', () => {
    expect(shortestAngleDelta(123, 123)).toBe(0)
  })
})

describe('smoothHeading', () => {
  it('adopts the first reading exactly, without swinging up from north', () => {
    expect(smoothHeading(null, 270)).toBe(270)
  })

  it('moves a fraction of the way toward the target', () => {
    // alpha 0.5 of a 90° turn is 45°.
    expect(smoothHeading(0, 90, { alpha: 0.5, deadbandDegrees: 0 })).toBe(45)
  })

  it('crosses north the short way instead of sweeping through south', () => {
    const result = smoothHeading(350, 10, { alpha: 0.5, deadbandDegrees: 0 })
    expect(result).toBe(0)
  })

  // Without a deadband a still phone's magnetometer jitter feeds the filter
  // forever and the marker never comes to rest.
  it('ignores jitter below the deadband', () => {
    expect(smoothHeading(100, 101, { deadbandDegrees: 1.5 })).toBe(100)
    expect(smoothHeading(100, 100.4, { deadbandDegrees: 1.5 })).toBe(100)
  })

  it('accepts movement at or above the deadband', () => {
    expect(smoothHeading(100, 110, { alpha: 0.5, deadbandDegrees: 1.5 })).toBe(105)
  })

  it('converges on the target over repeated steps', () => {
    let heading: number | null = null
    for (let i = 0; i < 200; i++) heading = smoothHeading(heading, 90)
    expect(heading).toBeCloseTo(90, 1)
  })

  it('always returns a normalized bearing', () => {
    const result = smoothHeading(355, 5, { alpha: 1, deadbandDegrees: 0 })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(360)
    expect(result).toBe(5)
  })
})
