import { describe, expect, it, vi } from 'vitest'
import {
  formatTripDuration,
  isOptimalOrder,
  measureTrip,
  orderStops,
  stopLabel,
  tripLengthMetres,
  type TripStop,
} from './pilgrimage'
import type { Coordinates } from './geo'
import type { WalkingRoute } from './routing'

// Caloocan is around 14.65N, 120.97E. One degree of latitude is ~111km, so
// 0.01 degrees is ~1.1km — a comfortable scale for laying out churches a few
// streets apart and knowing the answer in advance.
const HERE: Coordinates = { lat: 14.65, lng: 120.97 }

function church(id: string, lat: number, lng: number): TripStop {
  return { id, name: id, coordinates: { lat, lng } }
}

describe('orderStops', () => {
  it('visits the nearest church first', () => {
    const far = church('far', 14.68, 120.97)
    const near = church('near', 14.66, 120.97)
    const middle = church('middle', 14.67, 120.97)

    const ordered = orderStops(HERE, [far, middle, near])

    expect(ordered.map(s => s.id)).toEqual(['near', 'middle', 'far'])
  })

  it('keeps the given order when there is no position to start from', () => {
    // Nothing is "nearest" to an unknown place. Shuffling the list would
    // look like an answer while being arbitrary.
    const stops = [church('c', 14.68, 120.97), church('a', 14.66, 120.97)]

    expect(orderStops(null, stops).map(s => s.id)).toEqual(['c', 'a'])
  })

  it('unpicks the doubling-back that nearest-neighbour alone leaves', () => {
    // A layout where greedy genuinely loses, found by brute force rather
    // than assumed: five churches where taking the nearest each time walks
    // the three close ones, then far east, and then has to cross the whole
    // city back to the western one. Checked against every permutation, the
    // greedy order is 17% longer than the best one, which starts west.
    //
    // A straight line of churches would NOT have shown this - for points in
    // a row the greedy order is already optimal, so a test built on one
    // passes whether or not the second pass does anything.
    const stops = [
      church('close-w', 14.6536, 120.9671),
      church('far-e', 14.6479, 120.9955),
      church('close-n', 14.6552, 120.9705),
      church('far-w', 14.6507, 120.9511),
      church('north', 14.6676, 120.9778),
    ]

    // What pass 1 on its own produces, in the order it produces it.
    const greedy = [
      stops[0], stops[2], stops[4], stops[1], stops[3],
    ]

    const ordered = orderStops(HERE, stops)

    expect(tripLengthMetres(HERE, ordered)).toBeLessThan(tripLengthMetres(HERE, greedy))
    expect(ordered[0].id).toBe('far-w')
  })

  it('never drops or duplicates a church', () => {
    const stops = [
      church('a', 14.66, 120.95),
      church('b', 14.64, 120.99),
      church('c', 14.69, 120.97),
      church('d', 14.65, 120.93),
      church('e', 14.67, 121.01),
      church('f', 14.63, 120.96),
      church('g', 14.66, 120.99),
    ]

    const ordered = orderStops(HERE, stops)

    expect(ordered).toHaveLength(stops.length)
    expect(new Set(ordered.map(s => s.id))).toEqual(new Set(stops.map(s => s.id)))
  })

  it('leaves a single church alone', () => {
    const only = [church('only', 14.66, 120.97)]
    expect(orderStops(HERE, only).map(s => s.id)).toEqual(['only'])
  })

  it('does not mutate the list it was given', () => {
    const stops = [church('far', 14.69, 120.97), church('near', 14.66, 120.97)]
    const before = stops.map(s => s.id)

    orderStops(HERE, stops)

    expect(stops.map(s => s.id)).toEqual(before)
  })
})

describe('isOptimalOrder', () => {
  it('is false for an order that can be shortened', () => {
    const stops = [church('far', 14.69, 120.97), church('near', 14.66, 120.97)]
    expect(isOptimalOrder(HERE, stops)).toBe(false)
  })

  it('is true once the order is the best one', () => {
    const stops = [church('far', 14.69, 120.97), church('near', 14.66, 120.97)]
    expect(isOptimalOrder(HERE, orderStops(HERE, stops))).toBe(true)
  })

  it('is true with no position, because there is nothing to improve against', () => {
    const stops = [church('far', 14.69, 120.97), church('near', 14.66, 120.97)]
    expect(isOptimalOrder(null, stops)).toBe(true)
  })

  it('is true for two churches the same distance away', () => {
    // Equal-length orders must not be reported as improvable: the button
    // would promise a shorter route and then change nothing.
    const stops = [church('n', 14.66, 120.97), church('s', 14.64, 120.97)]
    expect(isOptimalOrder(HERE, stops)).toBe(true)
  })
})

describe('tripLengthMetres', () => {
  it('measures from the pilgrim through every church in turn', () => {
    const a = church('a', 14.66, 120.97)
    const b = church('b', 14.67, 120.97)

    // Two hops of 0.01 degrees of latitude, ~1.1km each.
    const total = tripLengthMetres(HERE, [a, b])

    expect(total).toBeGreaterThan(2000)
    expect(total).toBeLessThan(2400)
  })

  it('skips the approach when there is no position', () => {
    const a = church('a', 14.66, 120.97)
    const b = church('b', 14.67, 120.97)

    // Only the a-to-b hop is knowable.
    expect(tripLengthMetres(null, [a, b])).toBeGreaterThan(1000)
    expect(tripLengthMetres(null, [a, b])).toBeLessThan(1200)
  })

  it('is zero for an empty visit', () => {
    expect(tripLengthMetres(HERE, [])).toBe(0)
  })
})

describe('measureTrip', () => {
  const routed = (distanceMeters: number): WalkingRoute => ({
    kind: 'routed',
    path: [],
    distanceMeters,
    durationMinutes: 0,
    steps: [],
  })

  it('routes each hop from the previous church, not from the pilgrim', async () => {
    const a = church('a', 14.66, 120.97)
    const b = church('b', 14.67, 120.97)
    const from: Coordinates[] = []
    const fetchRoute = async (start: Coordinates) => {
      from.push(start)
      return routed(1000)
    }

    await measureTrip(HERE, [a, b], fetchRoute as never)

    // The second church is reached FROM the first, not from the pilgrim.
    // Getting this wrong gives a plausible-looking total that measures a
    // journey nobody makes: out and back for every church.
    expect(from).toEqual([HERE, a.coordinates])
  })

  it('totals the legs and converts to a walking time', async () => {
    const stops = [church('a', 14.66, 120.97), church('b', 14.67, 120.97)]
    const fetchRoute = vi.fn(async () => routed(1500))

    const trip = await measureTrip(HERE, stops, fetchRoute as never)

    expect(trip.distanceMeters).toBe(3000)
    // 3km at 5km/h is 36 minutes.
    expect(trip.durationMinutes).toBeCloseTo(36, 0)
    expect(trip.hasDirectLeg).toBe(false)
  })

  it('flags a trip where any leg fell back to a straight line', async () => {
    const stops = [church('a', 14.66, 120.97), church('b', 14.67, 120.97)]
    let call = 0
    const fetchRoute = vi.fn(async () => {
      call += 1
      return call === 1 ? routed(900) : { ...routed(900), kind: 'direct' as const }
    })

    const trip = await measureTrip(HERE, stops, fetchRoute as never)

    expect(trip.hasDirectLeg).toBe(true)
  })

  it('still measures the hops between churches with no position', async () => {
    const stops = [church('a', 14.66, 120.97), church('b', 14.67, 120.97)]
    const fetchRoute = vi.fn(async () => routed(1000))

    const trip = await measureTrip(null, stops, fetchRoute as never)

    // The approach to the first church is unmeasurable; a-to-b is not.
    expect(fetchRoute).toHaveBeenCalledTimes(1)
    expect(trip.legs[0].route).toBeNull()
    expect(trip.distanceMeters).toBe(1000)
  })
})

describe('formatTripDuration', () => {
  it('reads as minutes under an hour', () => {
    expect(formatTripDuration(48)).toBe('48 min')
  })

  it('reads as hours and minutes above one', () => {
    expect(formatTripDuration(312)).toBe('5 hr 12 min')
  })

  it('drops the minutes on a whole hour', () => {
    expect(formatTripDuration(120)).toBe('2 hr')
  })
})

describe('stopLabel', () => {
  it('labels the stops A, B, C', () => {
    expect([0, 1, 2].map(stopLabel)).toEqual(['A', 'B', 'C'])
  })
})
