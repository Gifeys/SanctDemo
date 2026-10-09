import { describe, expect, it } from 'vitest'
import {
  countsByKind,
  dailyVisits,
  peakHour,
  stationIdFrom,
  summariseActivity,
  topStations,
  uniqueVisitors,
  visitsByHour,
  visitsByWeekday,
  type ActivityEntry,
} from './analytics'

/** An entry, with only the fields a given test cares about spelled out. */
function entry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    uid: 'u1',
    kind: 'station_visit',
    summary: 'Checked in at station st-1',
    churchId: 'route-mhcp',
    createdAt: '2026-10-08T09:30:00.000Z',
    ...over,
  }
}

describe('stationIdFrom', () => {
  it('reads the station out of the logged sentence', () => {
    // The log was written as prose before it was ever read back. The
    // station is in there; nothing else records which one it was.
    expect(stationIdFrom('Checked in at station st-altar')).toBe('st-altar')
    expect(stationIdFrom('Commented at station st-font')).toBe('st-font')
  })

  it('returns null when the sentence names no station', () => {
    expect(stationIdFrom('Signed in as pilgrim')).toBeNull()
    expect(stationIdFrom('')).toBeNull()
  })
})

describe('uniqueVisitors', () => {
  it('counts each person once however often they appear', () => {
    expect(uniqueVisitors([
      entry({ uid: 'a' }), entry({ uid: 'a' }), entry({ uid: 'b' }),
    ])).toBe(2)
  })

  it('is zero for no activity', () => {
    expect(uniqueVisitors([])).toBe(0)
  })
})

describe('countsByKind', () => {
  it('reports how often each feature was used', () => {
    const counts = countsByKind([
      entry({ kind: 'sign_in' }),
      entry({ kind: 'station_visit' }),
      entry({ kind: 'station_visit' }),
    ])
    expect(counts).toEqual({ sign_in: 1, station_visit: 2, station_comment: 0 })
  })

  it('names every kind even when none occurred', () => {
    // A zero has to be visible. An absent key renders as a blank space
    // on the dashboard, which reads as "not measured" rather than "none".
    expect(countsByKind([])).toEqual({
      sign_in: 0, station_visit: 0, station_comment: 0,
    })
  })
})

describe('visitsByHour', () => {
  it('returns all twenty-four hours, in order', () => {
    const hours = visitsByHour([])
    expect(hours).toHaveLength(24)
    expect(hours.map(h => h.hour)).toEqual([...Array(24).keys()])
    expect(hours.every(h => h.count === 0)).toBe(true)
  })

  it('buckets an entry by its local hour', () => {
    const hours = visitsByHour([entry({ createdAt: '2026-10-08T14:20:00.000Z' })])
    const expected = new Date('2026-10-08T14:20:00.000Z').getHours()
    expect(hours[expected].count).toBe(1)
  })

  it('ignores an unparseable timestamp rather than throwing', () => {
    // These rows are written by a client with a swallowed failure path.
    // A dashboard that crashes on one malformed row shows nothing at all.
    expect(() => visitsByHour([entry({ createdAt: 'not a date' })])).not.toThrow()
    expect(visitsByHour([entry({ createdAt: 'not a date' })])
      .reduce((n, h) => n + h.count, 0)).toBe(0)
  })
})

describe('peakHour', () => {
  it('names the busiest hour', () => {
    const at = (h: number) =>
      entry({ createdAt: new Date(2026, 9, 8, h, 0, 0).toISOString() })
    expect(peakHour([at(9), at(17), at(17)])).toBe(17)
  })

  it('is null when there is nothing to rank', () => {
    // Not zero. Zero is midnight, and reporting midnight as the peak
    // visiting hour of a parish that logged nothing would be a lie.
    expect(peakHour([])).toBeNull()
  })
})

describe('visitsByWeekday', () => {
  it('returns all seven days starting at Sunday', () => {
    const days = visitsByWeekday([])
    expect(days).toHaveLength(7)
    expect(days[0].label).toBe('Sun')
    expect(days[6].label).toBe('Sat')
  })

  it('counts a Sunday visit against Sunday', () => {
    // 11 October 2026 is a Sunday.
    const days = visitsByWeekday([
      entry({ createdAt: new Date(2026, 9, 11, 10, 0, 0).toISOString() }),
    ])
    expect(days[0].count).toBe(1)
  })
})

describe('topStations', () => {
  it('ranks the most visited stations', () => {
    const visited = (id: string) =>
      entry({ summary: `Checked in at station ${id}` })
    const top = topStations([
      visited('a'), visited('b'), visited('b'), visited('c'), visited('b'),
    ], 2)
    expect(top).toEqual([
      { stationId: 'b', count: 3 },
      { stationId: 'a', count: 1 },
    ])
  })

  it('leaves out activity that names no station', () => {
    expect(topStations([entry({ kind: 'sign_in', summary: 'Signed in' })], 5))
      .toEqual([])
  })

  it('counts a comment on a station as engagement with it', () => {
    const top = topStations([
      entry({ kind: 'station_visit', summary: 'Checked in at station x' }),
      entry({ kind: 'station_comment', summary: 'Commented at station x' }),
    ], 5)
    expect(top).toEqual([{ stationId: 'x', count: 2 }])
  })
})

describe('dailyVisits', () => {
  const now = new Date(2026, 9, 8, 12, 0, 0) // Thu 8 Oct 2026

  it('returns one bucket per day up to and including today', () => {
    const days = dailyVisits([], 7, now)
    expect(days).toHaveLength(7)
    expect(days[6].date).toBe('2026-10-08')
    expect(days[0].date).toBe('2026-10-02')
  })

  it('counts both the visits and the people who made them', () => {
    const today = new Date(2026, 9, 8, 9, 0, 0).toISOString()
    const days = dailyVisits([
      entry({ uid: 'a', createdAt: today }),
      entry({ uid: 'a', createdAt: today }),
      entry({ uid: 'b', createdAt: today }),
    ], 7, now)
    expect(days[6]).toEqual({ date: '2026-10-08', count: 3, visitors: 2 })
  })

  it('drops activity older than the window', () => {
    const old = new Date(2026, 8, 1, 9, 0, 0).toISOString()
    const days = dailyVisits([entry({ createdAt: old })], 7, now)
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(0)
  })
})

describe('summariseActivity', () => {
  const now = new Date(2026, 9, 8, 12, 0, 0)

  it('reports nothing measured rather than zeros for an empty log', () => {
    // The distinction the parish needs: "nobody came" and "we are not
    // recording" look identical in a table of zeros.
    const s = summariseActivity([], now)
    expect(s.totalEvents).toBe(0)
    expect(s.uniqueVisitors).toBe(0)
    expect(s.peakHour).toBeNull()
    expect(s.topStations).toEqual([])
  })

  it('gathers the four measures the parish asked for', () => {
    const at = (h: number, uid: string) =>
      entry({ uid, createdAt: new Date(2026, 9, 8, h, 0, 0).toISOString() })
    const s = summariseActivity([at(9, 'a'), at(9, 'b'), at(16, 'a')], now)

    expect(s.totalEvents).toBe(3)
    expect(s.uniqueVisitors).toBe(2)
    expect(s.peakHour).toBe(9)
    expect(s.byKind.station_visit).toBe(3)
    expect(s.byHour).toHaveLength(24)
    expect(s.byWeekday).toHaveLength(7)
    expect(s.daily).toHaveLength(7)
  })
})
