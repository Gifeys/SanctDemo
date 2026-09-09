import { describe, expect, it } from 'vitest'
import {
  anticipatedTime,
  dayOfMonth,
  nextSunday,
  saturdayBefore,
  sundayMassCard,
} from './sundayMasses'
import { MASS_SCHEDULES } from '../data'

// Mary Help of Christians' real, parish-confirmed schedule.
const MHCP = MASS_SCHEDULES['route-mhcp'].schedule

describe('nextSunday', () => {
  it('returns today when today IS Sunday', () => {
    // A card shown on Sunday morning must describe today's Masses, not next
    // week's — the pilgrim is standing in the church.
    const sunday = new Date(2026, 8, 6) // Sunday 6 September 2026
    expect(nextSunday(sunday).getDate()).toBe(6)
  })

  it('finds the coming Sunday from midweek', () => {
    const wednesday = new Date(2026, 8, 9)
    const result = nextSunday(wednesday)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(13)
  })

  it('crosses a month boundary', () => {
    const tuesday = new Date(2026, 8, 29) // Tue 29 Sep 2026
    const result = nextSunday(tuesday)
    expect(result.getDay()).toBe(0)
    expect(result.getMonth()).toBe(9) // October
  })

  it('strips the time, so two calls on the same day are equal', () => {
    const morning = nextSunday(new Date(2026, 8, 9, 6, 30))
    const evening = nextSunday(new Date(2026, 8, 9, 22, 15))
    expect(morning.getTime()).toBe(evening.getTime())
  })
})

describe('saturdayBefore', () => {
  it('is the day before the Sunday, not the next Saturday', () => {
    // The distinction only shows up on a Sunday, where "the next Saturday" is
    // six days out and would advertise a vigil Mass a week away.
    const sunday = new Date(2026, 8, 6)
    const saturday = saturdayBefore(sunday)
    expect(saturday.getDay()).toBe(6)
    expect(saturday.getDate()).toBe(5)
  })
})

describe('anticipatedTime', () => {
  it('takes the EVENING Mass when Saturday has a morning one too', () => {
    // MHCP lists "6:00 AM, 6:00 PM" on Saturday. Only the evening Mass
    // fulfils the Sunday obligation; labelling the 6 AM one "Anticipated"
    // would be wrong in a way a parishioner spots at once.
    expect(anticipatedTime(MHCP)).toBe('6:00 PM')
  })

  it('takes the last evening Mass when there are several', () => {
    expect(
      anticipatedTime([{ day: 'Saturday', time: '4:00 PM, 5:30 PM, 7:00 PM' }]),
    ).toBe('7:00 PM')
  })

  it('falls back to the last listed time when there is no evening Mass', () => {
    expect(anticipatedTime([{ day: 'Saturday', time: '6:00 AM' }])).toBe('6:00 AM')
  })

  it('returns null when the parish lists no Saturday Mass, rather than inventing one', () => {
    expect(anticipatedTime([{ day: 'Sunday', time: '8:00 AM' }])).toBeNull()
    expect(anticipatedTime([])).toBeNull()
  })
})

describe('sundayMassCard', () => {
  const wednesday = new Date(2026, 8, 9)

  it('reads the real parish schedule, not hardcoded times', () => {
    const card = sundayMassCard(MHCP, wednesday)
    // Exactly the times printed in the client's own mockup.
    expect(card.sunday.times).toEqual([
      '6:00 AM',
      '7:30 AM',
      '9:00 AM',
      '10:30 AM',
      '4:30 PM',
      '6:00 PM',
    ])
    expect(card.anticipated?.time).toBe('6:00 PM')
  })

  it('dates the anticipated Mass to the Saturday before that Sunday', () => {
    const card = sundayMassCard(MHCP, wednesday)
    expect(card.sunday.date.getDay()).toBe(0)
    expect(card.anticipated!.date.getDay()).toBe(6)
    expect(card.sunday.date.getTime() - card.anticipated!.date.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('carries the unverified flag through, so placeholder times can be marked', () => {
    // San Roque's times are a stand-in until the parish supplies real ones.
    // They must never render as parish-confirmed.
    const src = MASS_SCHEDULES['route-src']
    const card = sundayMassCard(src.schedule, wednesday, { verified: src.scheduleVerified })
    expect(card.unverified).toBe(true)
  })

  it('treats a confirmed schedule as verified', () => {
    const card = sundayMassCard(MHCP, wednesday, { verified: true })
    expect(card.unverified).toBe(false)
  })

  it('survives a parish with no schedule at all', () => {
    const card = sundayMassCard([], wednesday)
    expect(card.anticipated).toBeNull()
    expect(card.sunday.times).toEqual([])
  })
})

describe('dayOfMonth', () => {
  it('zero-pads a single digit, as the design\'s two-character slot needs', () => {
    expect(dayOfMonth(new Date(2026, 8, 6))).toBe('06')
  })

  it('leaves two digits alone', () => {
    expect(dayOfMonth(new Date(2026, 8, 13))).toBe('13')
  })
})
