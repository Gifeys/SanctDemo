import { describe, it, expect } from 'vitest'
import { parseTimes, toMinutes, nextMass, type MassScheduleEntry } from './schedule'

const mhcSchedule: MassScheduleEntry[] = [
  { day: 'Monday', time: '6:00 AM' },
  { day: 'Tuesday', time: '6:00 AM' },
  { day: 'Wednesday', time: '6:00 AM, 6:00 PM' },
  { day: 'Thursday', time: '6:00 AM, 6:00 PM' },
  { day: 'Friday', time: '6:00 AM, 6:00 PM' },
  { day: 'Saturday', time: '6:00 AM, 6:00 PM' },
  { day: 'Sunday', time: '6:00 AM, 7:30 AM, 9:00 AM, 10:30 AM, 4:30 PM, 6:00 PM' },
]

describe('parseTimes', () => {
  it('splits a multi-time string', () => {
    expect(parseTimes('6:00 AM, 7:30 AM, 9:00 AM')).toEqual(['6:00 AM', '7:30 AM', '9:00 AM'])
  })
  it('handles a single time', () => {
    expect(parseTimes('6:00 AM')).toEqual(['6:00 AM'])
  })
})

describe('toMinutes', () => {
  it('converts morning times', () => {
    expect(toMinutes('6:00 AM')).toBe(360)
  })
  it('converts afternoon times', () => {
    expect(toMinutes('4:30 PM')).toBe(990)
  })
  it('treats 12 AM as midnight', () => {
    expect(toMinutes('12:00 AM')).toBe(0)
  })
  it('treats 12 PM as noon', () => {
    expect(toMinutes('12:00 PM')).toBe(720)
  })
})

describe('nextMass', () => {
  it('finds a later Mass on the same day', () => {
    // Saturday 2026-08-15, 07:00. Saturday has 6:00 AM and 6:00 PM.
    const now = new Date(2026, 7, 15, 7, 0)
    const result = nextMass(mhcSchedule, now)
    expect(result?.day).toBe('Saturday')
    expect(result?.time).toBe('6:00 PM')
  })

  it('rolls over to the next day when the day is finished', () => {
    // Saturday 2026-08-15, 20:00 — past the last Saturday Mass.
    const now = new Date(2026, 7, 15, 20, 0)
    const result = nextMass(mhcSchedule, now)
    expect(result?.day).toBe('Sunday')
    expect(result?.time).toBe('6:00 AM')
  })

  it('returns a Date in the future', () => {
    const now = new Date(2026, 7, 15, 7, 0)
    const result = nextMass(mhcSchedule, now)
    expect(result?.date.getTime()).toBeGreaterThan(now.getTime())
  })

  it('returns null for a church with no schedule', () => {
    expect(nextMass([], new Date())).toBeNull()
  })
})

describe('nextMass wraparound', () => {
  it('finds next week when a church has one weekly Mass that has already passed today', () => {
    const oneMassSchedule: MassScheduleEntry[] = [{ day: 'Saturday', time: '6:00 AM' }]
    // Saturday 2026-08-15, 20:00 — after the only Mass of the week.
    const now = new Date(2026, 7, 15, 20, 0)
    const result = nextMass(oneMassSchedule, now)
    expect(result?.day).toBe('Saturday')
    expect(result?.time).toBe('6:00 AM')
    expect(result?.date.getDate()).toBe(22)
  })

  it('orders same-day Mass times by clock time regardless of how they are written', () => {
    const scrambled: MassScheduleEntry[] = [{ day: 'Saturday', time: '4:30 PM, 6:00 AM' }]
    // Saturday 2026-08-15, 05:00 — both Masses still ahead.
    const now = new Date(2026, 7, 15, 5, 0)
    expect(nextMass(scrambled, now)?.time).toBe('6:00 AM')
  })
})
