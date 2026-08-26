import { describe, expect, it } from 'vitest'
import {
  OFF_ROUTE_METERS,
  announcementFor,
  distanceToPath,
  distanceToSegment,
  instructionFor,
  nextOffRouteState,
  progressAlong,
  type RouteStep,
} from './navigation'

// Mary Help of Christians, and a point ~1.5km north at San Roque.
const MHCP = { lat: 14.637702, lng: 120.97344 }
const SAN_ROQUE = { lat: 14.651647, lng: 120.972648 }

type StepOverride = Omit<Partial<RouteStep>, 'maneuver'> & { maneuver?: Partial<RouteStep['maneuver']> }

const step = (over: StepOverride = {}): RouteStep => ({
  name: over.name ?? 'A. Mabini Street',
  distanceMeters: over.distanceMeters ?? 100,
  maneuver: {
    type: over.maneuver?.type ?? 'turn',
    modifier: over.maneuver?.modifier,
    location: over.maneuver?.location ?? [MHCP.lng, MHCP.lat],
    bearingAfter: over.maneuver?.bearingAfter,
  },
})

describe('instructionFor', () => {
  it('turns a type and modifier into something a walker can act on', () => {
    expect(instructionFor(step({ maneuver: { type: 'turn', modifier: 'left' } }))).toBe(
      'Turn left onto A. Mabini Street',
    )
    expect(instructionFor(step({ maneuver: { type: 'turn', modifier: 'sharp right' } }))).toBe(
      'Turn sharply right onto A. Mabini Street',
    )
    expect(instructionFor(step({ maneuver: { type: 'fork', modifier: 'left' } }))).toBe(
      'Keep left onto A. Mabini Street',
    )
  })

  // Unnamed paths are common on foot — alleys, church grounds, cut-throughs.
  // "Turn left onto " with nothing after it is worse than "Turn left".
  it('omits the street name when there is none', () => {
    expect(instructionFor(step({ name: '', maneuver: { type: 'turn', modifier: 'left' } }))).toBe('Turn left')
    expect(instructionFor(step({ name: '', maneuver: { type: 'continue' } }))).toBe('Continue')
  })

  // At the start there is no previous heading to turn from, so the compass is
  // the only thing that can be said — and it uses the same eight-point rose
  // the compass dial shows, so the words match the UI.
  it('uses the compass for the departure, matching the compass UI', () => {
    expect(instructionFor(step({ name: '', maneuver: { type: 'depart', bearingAfter: 45 } }))).toBe(
      'Head northeast',
    )
    expect(instructionFor(step({ maneuver: { type: 'depart', bearingAfter: 180 } }))).toBe(
      'Head south on A. Mabini Street',
    )
  })

  it('falls back gracefully when the departure has no bearing', () => {
    expect(instructionFor(step({ name: '', maneuver: { type: 'depart' } }))).toBe('Set off')
  })

  it('names arrival plainly', () => {
    expect(instructionFor(step({ maneuver: { type: 'arrive' } }))).toBe('Arrive at your destination')
  })

  it('handles a u-turn and an unknown type without producing nonsense', () => {
    expect(instructionFor(step({ maneuver: { type: 'turn', modifier: 'uturn' } }))).toBe(
      'Turn around onto A. Mabini Street',
    )
    expect(instructionFor(step({ maneuver: { type: 'something-new', modifier: 'right' } }))).toBe(
      'Turn right onto A. Mabini Street',
    )
  })
})

describe('distanceToSegment', () => {
  // A point beyond the end of a street is NOT on that street. Using an
  // infinite line here would report it as perfectly on-route.
  it('clamps to the segment rather than treating it as an infinite line', () => {
    const a = { lat: 14.6377, lng: 120.9734 }
    const b = { lat: 14.6377, lng: 120.9744 } // ~107m east
    const wayPastB = { lat: 14.6377, lng: 120.9764 } // a further ~215m east
    expect(distanceToSegment(wayPastB, a, b)).toBeGreaterThan(200)
  })

  it('measures the perpendicular for a point beside the segment', () => {
    const a = { lat: 14.6377, lng: 120.9734 }
    const b = { lat: 14.6377, lng: 120.9744 }
    // ~0.0004 deg lat north of the midpoint ≈ 44m
    const beside = { lat: 14.6381, lng: 120.9739 }
    expect(distanceToSegment(beside, a, b)).toBeGreaterThan(38)
    expect(distanceToSegment(beside, a, b)).toBeLessThan(50)
  })

  it('is zero on the line', () => {
    const a = { lat: 14.6377, lng: 120.9734 }
    const b = { lat: 14.6377, lng: 120.9744 }
    expect(distanceToSegment({ lat: 14.6377, lng: 120.9739 }, a, b)).toBeLessThan(0.5)
  })

  it('handles a zero-length segment', () => {
    const a = { lat: 14.6377, lng: 120.9734 }
    expect(distanceToSegment(a, a, a)).toBeLessThan(0.001)
  })
})

describe('distanceToPath', () => {
  const path = [
    { lat: 14.6377, lng: 120.9734 },
    { lat: 14.6377, lng: 120.9744 },
    { lat: 14.6387, lng: 120.9744 },
  ]

  it('finds the nearest segment, not just the first', () => {
    // Beside the second leg, far from the first.
    const point = { lat: 14.6383, lng: 120.9745 }
    expect(distanceToPath(point, path)).toBeLessThan(20)
  })

  it('degrades sensibly for short paths', () => {
    expect(distanceToPath(MHCP, [])).toBe(Number.POSITIVE_INFINITY)
    expect(distanceToPath(MHCP, [MHCP])).toBeLessThan(0.001)
  })
})

describe('progressAlong', () => {
  const steps = [
    step({ maneuver: { type: 'depart', location: [120.9734, 14.6377], bearingAfter: 0 } }),
    step({ maneuver: { type: 'turn', modifier: 'left', location: [120.9744, 14.6377] } }),
    step({ maneuver: { type: 'arrive', location: [120.9744, 14.6387] } }),
  ]
  const destination = { lat: 14.6387, lng: 120.9744 }

  it('advances as manoeuvres are reached', () => {
    const atStart = progressAlong({ lat: 14.6377, lng: 120.9734 }, steps, destination, 0)
    expect(atStart.stepIndex).toBe(1)

    const atCorner = progressAlong({ lat: 14.6377, lng: 120.9744 }, steps, destination, 1)
    expect(atCorner.stepIndex).toBe(2)
  })

  // GPS noise near a corner constantly nudges the position back past the
  // manoeuvre. Rewinding there makes the app flip between two instructions
  // for the whole junction.
  it('never rewinds to an earlier step', () => {
    const backAtStart = progressAlong({ lat: 14.6377, lng: 120.9734 }, steps, destination, 2)
    expect(backAtStart.stepIndex).toBe(2)
  })

  it('skips several manoeuvres at once when a fix arrives late', () => {
    // Standing at the final manoeuvre, but the app still thinks it is at step 0.
    const jumped = progressAlong({ lat: 14.6387, lng: 120.9744 }, steps, destination, 0)
    expect(jumped.stepIndex).toBe(2)
  })

  it('reports arrival within the reached radius', () => {
    expect(progressAlong(destination, steps, destination, 2).arrived).toBe(true)
    expect(progressAlong(MHCP, steps, destination, 0).arrived).toBe(false)
  })

  it('works with no steps at all, falling back to the destination', () => {
    const p = progressAlong(MHCP, [], SAN_ROQUE)
    expect(p.stepIndex).toBe(0)
    expect(p.metersRemaining).toBeGreaterThan(1000)
    expect(p.arrived).toBe(false)
  })
})

describe('nextOffRouteState', () => {
  const path = [
    { lat: 14.6377, lng: 120.9734 },
    { lat: 14.6377, lng: 120.9744 },
  ]
  const onRoute = { lat: 14.6377, lng: 120.9739 }
  // ~0.0009 deg lat ≈ 100m north of the line.
  const wayOff = { lat: 14.6386, lng: 120.9739 }

  it('stays on-route inside the corridor', () => {
    expect(nextOffRouteState(onRoute, path).offRoute).toBe(false)
  })

  // The whole reason strikes exist: one bad fix must not throw away a good
  // route and send the pilgrim through a reroute mid-street.
  it('does not reroute on a single bad fix', () => {
    const first = nextOffRouteState(wayOff, path)
    expect(first.offRoute).toBe(false)
    expect(first.strikes).toBe(1)
  })

  it('reroutes only after consecutive off-route fixes', () => {
    let state = nextOffRouteState(wayOff, path)
    state = nextOffRouteState(wayOff, path, state)
    expect(state.offRoute).toBe(false)
    state = nextOffRouteState(wayOff, path, state)
    expect(state.offRoute).toBe(true)
  })

  it('resets completely on a single good fix', () => {
    let state = nextOffRouteState(wayOff, path)
    state = nextOffRouteState(wayOff, path, state)
    expect(state.strikes).toBe(2)

    state = nextOffRouteState(onRoute, path, state)
    expect(state).toEqual({ strikes: 0, offRoute: false })
  })

  it('honours a custom threshold', () => {
    // Just outside the default corridor but inside a generous one.
    const slightlyOff = { lat: 14.63808, lng: 120.9739 }
    expect(distanceToPath(slightlyOff, path)).toBeGreaterThan(OFF_ROUTE_METERS)
    expect(nextOffRouteState(slightlyOff, path, undefined, { thresholdMeters: 200 }).strikes).toBe(0)
  })
})

describe('announcementFor', () => {
  it('counts down to the manoeuvre in round numbers', () => {
    const s = step({ maneuver: { type: 'turn', modifier: 'left' } })
    expect(announcementFor(s, 84)).toBe('In 80 m, turn left onto A. Mabini Street')
  })

  it('drops the distance once the manoeuvre is reached', () => {
    const s = step({ maneuver: { type: 'turn', modifier: 'right' } })
    expect(announcementFor(s, 5)).toBe('Turn right onto A. Mabini Street')
  })

  it('never prefixes arrival with a distance', () => {
    expect(announcementFor(step({ maneuver: { type: 'arrive' } }), 300)).toBe(
      'Arrive at your destination',
    )
  })
})

// Captured from the OSRM demo server on the real walk between the diocese's
// two live parishes (Mary Help → San Roque, 1850m). Invented steps can be
// made to fit whatever the code already does; this is what the server
// actually sends. Note that two of the five steps have no street name — on
// foot, unnamed paths are ordinary, not an edge case.
const REAL_ROUTE: RouteStep[] = [
  { name: "", distanceMeters: 16, maneuver: { type: "depart", modifier: "straight", location: [120.973427, 14.637906], bearingAfter: 359 } },
  { name: "J. P. Rizal Street", distanceMeters: 232, maneuver: { type: "turn", modifier: "right", location: [120.973424, 14.638046], bearingAfter: 92 } },
  { name: "A. Mabini Street", distanceMeters: 1581, maneuver: { type: "end of road", modifier: "left", location: [120.975569, 14.637906], bearingAfter: 4 } },
  { name: "", distanceMeters: 23, maneuver: { type: "turn", modifier: "right", location: [120.972379, 14.651682], bearingAfter: 80 } },
  { name: "", distanceMeters: 0, maneuver: { type: "arrive", modifier: "left", location: [120.972531, 14.651607], bearingAfter: 0 } },
]

describe('instructionFor — against a real OSRM response', () => {
  it('reads out the whole walk in plain English', () => {
    expect(REAL_ROUTE.map(instructionFor)).toEqual([
      'Head north',
      'Turn right onto J. P. Rizal Street',
      'Turn left onto A. Mabini Street',
      'Turn right',
      'Arrive at your destination',
    ])
  })

  it('never leaves a dangling "onto" where OSRM gave no street name', () => {
    for (const instruction of REAL_ROUTE.map(instructionFor)) {
      expect(instruction).not.toMatch(/onto\s*$/)
      expect(instruction.trim()).toBe(instruction)
    }
  })

  it('walks the route end to end, advancing every step and arriving', () => {
    const destination = { lat: 14.651647, lng: 120.972648 }
    let index = 0
    const seen: number[] = []
    for (const step of REAL_ROUTE) {
      const [lng, lat] = step.maneuver.location
      const p = progressAlong({ lat, lng }, REAL_ROUTE, destination, index)
      index = p.stepIndex
      seen.push(index)
    }
    // Monotonic, and finishing on the arrival step.
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(index).toBe(REAL_ROUTE.length - 1)
    expect(progressAlong(destination, REAL_ROUTE, destination, index).arrived).toBe(true)
  })
})
