import { describe, expect, it } from 'vitest'
import {
  ACTIVE_WINDOW_MS,
  VISIT_COOLDOWN_MS,
  countActive,
  shouldRecordVisit,
  summariseVisits,
  visitKey,
  type VisitDoc,
} from './visits'

const HOUR = 3600_000

function visit(over: Partial<VisitDoc> = {}): VisitDoc {
  return {
    uid: 'u1',
    churchId: 'route-mhcp',
    at: '2026-10-11T02:00:00.000Z',
    ...over,
  }
}

describe('shouldRecordVisit', () => {
  const now = 1_000 * HOUR

  it('records the first arrival at a church', () => {
    expect(shouldRecordVisit(null, now)).toBe(true)
  })

  it('does not record again on the same visit', () => {
    // The geofence re-fires whenever GPS drifts across the boundary, and
    // a pilgrim standing near the door can cross it many times in a
    // minute. Each crossing is the same visit.
    expect(shouldRecordVisit(now - 60_000, now)).toBe(false)
  })

  it('records again after the cooldown', () => {
    expect(shouldRecordVisit(now - VISIT_COOLDOWN_MS - 1, now)).toBe(true)
  })

  it('does not record a second before the cooldown ends', () => {
    expect(shouldRecordVisit(now - VISIT_COOLDOWN_MS + 1000, now)).toBe(false)
  })

  it('treats a time in the future as not yet due', () => {
    // A clock that jumped backwards must not open the floodgates.
    expect(shouldRecordVisit(now + HOUR, now)).toBe(false)
  })
})

describe('visitKey', () => {
  it('is per user and per church', () => {
    expect(visitKey('u1', 'a')).not.toBe(visitKey('u1', 'b'))
    expect(visitKey('u1', 'a')).not.toBe(visitKey('u2', 'a'))
  })

  it('is stable for the same pair', () => {
    expect(visitKey('u1', 'a')).toBe(visitKey('u1', 'a'))
  })
})

describe('countActive', () => {
  const now = new Date('2026-10-11T03:00:00.000Z')

  it('counts somebody seen a minute ago', () => {
    expect(countActive([{ lastActiveAt: '2026-10-11T02:59:00.000Z' }], now)).toBe(1)
  })

  it('does not count somebody seen an hour ago', () => {
    expect(countActive([{ lastActiveAt: '2026-10-11T02:00:00.000Z' }], now)).toBe(0)
  })

  it('uses a fifteen minute window', () => {
    expect(ACTIVE_WINDOW_MS).toBe(15 * 60_000)
    const edge = new Date(now.getTime() - ACTIVE_WINDOW_MS + 1000).toISOString()
    expect(countActive([{ lastActiveAt: edge }], now)).toBe(1)
  })

  it('ignores a profile that has never been seen', () => {
    expect(countActive([{}, { lastActiveAt: '' }], now)).toBe(0)
  })

  it('ignores an unparseable timestamp rather than throwing', () => {
    expect(() => countActive([{ lastActiveAt: 'soon' }], now)).not.toThrow()
    expect(countActive([{ lastActiveAt: 'soon' }], now)).toBe(0)
  })
})

describe('summariseVisits', () => {
  const now = new Date('2026-10-11T12:00:00.000Z')

  it('reports nothing measured for an empty log', () => {
    const s = summariseVisits([], 7, now)
    expect(s.total).toBe(0)
    expect(s.churchesWithVisits).toBe(0)
    expect(s.byChurch).toEqual([])
    expect(s.daily.every(d => d.count === 0)).toBe(true)
  })

  it('counts the visits and the churches they were to', () => {
    const s = summariseVisits([
      visit({ churchId: 'a' }), visit({ churchId: 'a' }), visit({ churchId: 'b' }),
    ], 7, now)
    expect(s.total).toBe(3)
    expect(s.churchesWithVisits).toBe(2)
  })

  it('ranks the churches by how many visits they had', () => {
    const s = summariseVisits([
      visit({ churchId: 'a' }), visit({ churchId: 'b' }), visit({ churchId: 'b' }),
    ], 7, now)
    expect(s.byChurch[0]).toEqual({ churchId: 'b', count: 2 })
  })

  it('counts distinct visitors separately from visits', () => {
    // Twenty visits from one pilgrim is not twenty pilgrims, and a
    // parish reading the first as the second would be misled about its
    // own foot traffic.
    const s = summariseVisits([
      visit({ uid: 'a' }), visit({ uid: 'a' }), visit({ uid: 'b' }),
    ], 7, now)
    expect(s.total).toBe(3)
    expect(s.visitors).toBe(2)
  })

  it('puts a visit in the right day and leaves the window alone', () => {
    const today = new Date(2026, 9, 11, 9, 0, 0).toISOString()
    const s = summariseVisits([visit({ at: today })], 7, new Date(2026, 9, 11, 12, 0, 0))
    expect(s.daily).toHaveLength(7)
    expect(s.daily[6].count).toBe(1)
  })

  it('drops a visit older than the window', () => {
    const old = new Date(2026, 7, 1, 9, 0, 0).toISOString()
    const s = summariseVisits([visit({ at: old })], 7, new Date(2026, 9, 11, 12, 0, 0))
    expect(s.daily.reduce((n, d) => n + d.count, 0)).toBe(0)
    // Still counted in the all-time total; only the chart is windowed.
    expect(s.total).toBe(1)
  })

  it('survives a record with no timestamp', () => {
    expect(() => summariseVisits([visit({ at: '' })], 7, now)).not.toThrow()
  })
})
