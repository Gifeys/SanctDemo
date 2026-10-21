import { describe, expect, it } from 'vitest'

import { weekAhead } from './sundayMasses'
import type { MassScheduleEntry } from './schedule'

const MHCP: MassScheduleEntry[] = [
  { day: 'Monday', time: '6:00 AM' },
  { day: 'Tuesday', time: '6:00 AM' },
  { day: 'Wednesday', time: '6:00 AM, 6:00 PM' },
  { day: 'Thursday', time: '6:00 AM, 6:00 PM' },
  { day: 'Friday', time: '6:00 AM, 6:00 PM' },
  { day: 'Saturday', time: '6:00 AM, 6:00 PM' },
  { day: 'Sunday', time: '6:00 AM, 7:30 AM, 9:00 AM, 10:30 AM, 4:30 PM, 6:00 PM' },
]

// A Wednesday.
const WEDNESDAY = new Date('2026-10-21T09:00:00')

describe('weekAhead', () => {
  it('gives seven days', () => {
    expect(weekAhead(MHCP, WEDNESDAY)).toHaveLength(7)
  })

  it('starts with today, not with Monday', () => {
    const week = weekAhead(MHCP, WEDNESDAY)
    expect(week[0].day).toBe('Wednesday')
    expect(week[0].isToday).toBe(true)
  })

  it('marks only today as today', () => {
    expect(weekAhead(MHCP, WEDNESDAY).filter(d => d.isToday)).toHaveLength(1)
  })

  it('runs forward through the week and wraps', () => {
    const names = weekAhead(MHCP, WEDNESDAY).map(d => d.day)
    expect(names).toEqual([
      'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday',
    ])
  })

  it('carries the real calendar date for each day', () => {
    const week = weekAhead(MHCP, WEDNESDAY)
    expect(week[0].date.getDate()).toBe(21)
    expect(week[1].date.getDate()).toBe(22)
    expect(week[6].date.getDate()).toBe(27)
  })

  it('shows the weekday Masses that the card used to hide', () => {
    // The whole point: Monday and Tuesday exist in every parish's data
    // and appeared nowhere in the app.
    const week = weekAhead(MHCP, WEDNESDAY)
    const monday = week.find(d => d.day === 'Monday')
    expect(monday?.times.map(t => t.time)).toEqual(['6:00 AM'])
  })

  it('keeps every time of a multi-Mass day, in the parish order', () => {
    const week = weekAhead(MHCP, WEDNESDAY)
    expect(week[0].times.map(t => t.time)).toEqual(['6:00 AM', '6:00 PM'])
  })

  it('keeps all six Sunday Masses', () => {
    const sunday = weekAhead(MHCP, WEDNESDAY).find(d => d.day === 'Sunday')
    expect(sunday?.times).toHaveLength(6)
  })

  it('marks a suspended Mass unavailable rather than dropping it', () => {
    const withSuspension = MHCP.map(e =>
      e.day === 'Sunday' ? { ...e, unavailableTimes: ['6:00 AM'] } : e,
    )
    const sunday = weekAhead(withSuspension, WEDNESDAY).find(d => d.day === 'Sunday')
    expect(sunday?.times).toHaveLength(6)
    expect(sunday?.times.find(t => t.time === '6:00 AM')?.available).toBe(false)
    expect(sunday?.times.find(t => t.time === '9:00 AM')?.available).toBe(true)
  })

  it('keeps a day the parish holds no Mass on, with no times', () => {
    const noMonday = MHCP.filter(e => e.day !== 'Monday')
    const monday = weekAhead(noMonday, WEDNESDAY).find(d => d.day === 'Monday')
    expect(monday).toBeDefined()
    expect(monday?.times).toEqual([])
  })

  it('carries the parish note for a day', () => {
    const noted = MHCP.map(e =>
      e.day === 'Friday' ? { ...e, note: 'No 6pm Mass during the renovation' } : e,
    )
    const friday = weekAhead(noted, WEDNESDAY).find(d => d.day === 'Friday')
    expect(friday?.note).toBe('No 6pm Mass during the renovation')
  })

  it('handles a parish with no schedule at all', () => {
    const week = weekAhead([], WEDNESDAY)
    expect(week).toHaveLength(7)
    expect(week.every(d => d.times.length === 0)).toBe(true)
  })

  it('shows a special Mass the parish adds to one day', () => {
    const special = MHCP.map(e =>
      e.day === 'Thursday' ? { ...e, time: '6:00 AM, 6:00 PM, 8:00 PM' } : e,
    )
    const thursday = weekAhead(special, WEDNESDAY).find(d => d.day === 'Thursday')
    expect(thursday?.times.map(t => t.time)).toContain('8:00 PM')
  })
})
