import { describe, expect, it } from 'vitest'

import { COURSE_MIN_MOVE_M, courseBetween, nextCourse, type CourseState } from './travelCourse'
import type { Coordinates } from './geo'

const HERE: Coordinates = { lat: 14.6377, lng: 120.9734 }
/** ~110 m north and ~107 m east of HERE. */
const NORTH: Coordinates = { lat: 14.6387, lng: 120.9734 }
const EAST: Coordinates = { lat: 14.6377, lng: 120.9744 }
const SOUTH: Coordinates = { lat: 14.6367, lng: 120.9734 }

describe('courseBetween', () => {
  it('reads north as 0', () => {
    expect(courseBetween(HERE, NORTH)).toBeCloseTo(0, 1)
  })

  it('reads east as 90', () => {
    expect(courseBetween(HERE, EAST)).toBeCloseTo(90, 1)
  })

  it('reads south as 180', () => {
    expect(courseBetween(HERE, SOUTH)).toBeCloseTo(180, 1)
  })

  it('never reports a negative bearing', () => {
    // West is 270, not -90: the map would read -90 as a quarter turn the
    // wrong way.
    const west = { lat: 14.6377, lng: 120.9724 }
    expect(courseBetween(HERE, west)).toBeCloseTo(270, 1)
  })
})

describe('nextCourse', () => {
  const start: CourseState = { from: null, course: null }

  it('takes the first fix as an anchor without inventing a course', () => {
    // One position is a point, not a direction.
    expect(nextCourse(start, HERE)).toEqual({ from: HERE, course: null })
  })

  it('reports a course once the walker has actually moved', () => {
    const anchored = nextCourse(start, HERE)
    expect(nextCourse(anchored, NORTH).course).toBeCloseTo(0, 0)
  })

  it('ignores a fix too close to be a step', () => {
    // A stationary phone wanders metres between fixes and the bearing
    // between two such samples is random - acting on it spins the map
    // while the walker stands still.
    const anchored = nextCourse(start, HERE)
    const jitter = { lat: HERE.lat + 0.00001, lng: HERE.lng }
    expect(nextCourse(anchored, jitter)).toBe(anchored)
  })

  it('keeps the anchor when it ignores a fix, so small steps add up', () => {
    // Moving the anchor on every fix would mean a slow walk never
    // clears the threshold and never produces a course at all.
    let s = nextCourse(start, HERE)
    for (let i = 1; i <= 5; i++) {
      s = nextCourse(s, { lat: HERE.lat + 0.00001 * i, lng: HERE.lng })
    }
    expect(s.from).toEqual(HERE)
    expect(s.course).toBeNull()

    const far = { lat: HERE.lat + 0.001, lng: HERE.lng }
    expect(nextCourse(s, far).course).toBeCloseTo(0, 0)
  })

  it('turns around when the walker does', () => {
    // The reported bug: walking back the way you came left the map
    // pointing the old way.
    let s = nextCourse(start, HERE)
    s = nextCourse(s, NORTH)
    expect(s.course).toBeCloseTo(0, 0)

    // Several fixes heading back south, since the course is smoothed.
    for (let i = 1; i <= 12; i++) {
      s = nextCourse(s, { lat: NORTH.lat - 0.0002 * i, lng: NORTH.lng })
    }
    expect(s.course).toBeGreaterThan(150)
    expect(s.course).toBeLessThan(210)
  })

  it('holds its last course when the walker stops', () => {
    let s = nextCourse(start, HERE)
    s = nextCourse(s, EAST)
    const moving = s.course
    s = nextCourse(s, { lat: EAST.lat + 0.000005, lng: EAST.lng })
    expect(s.course).toBe(moving)
  })

  it('respects a caller-supplied threshold', () => {
    const anchored = nextCourse(start, HERE)
    const small = { lat: HERE.lat + 0.00002, lng: HERE.lng }
    expect(nextCourse(anchored, small, 1).course).not.toBeNull()
    expect(nextCourse(anchored, small, COURSE_MIN_MOVE_M)).toBe(anchored)
  })
})
