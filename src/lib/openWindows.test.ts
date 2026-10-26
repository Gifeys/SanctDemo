import { describe, expect, it } from 'vitest'

import {
  MAX_WINDOWS_PER_ITEM,
  describeWindows,
  isWithinWindows,
  nextOpening,
  normaliseWindows,
  withWindow,
  withoutWindow,
  type OpenWindow,
} from './openWindows'

const NOV = (day: number) => `2026-11-${String(day).padStart(2, '0')}`
const w = (from: string, to: string): OpenWindow => ({ from, to })

describe('isWithinWindows', () => {
  it('is open with no windows set at all', () => {
    // Absent means normal, the same rule closedApplications follows.
    // A parish that has never opened the calendar must not have every
    // sacrament close itself the day this ships.
    expect(isWithinWindows([], NOV(15))).toBe(true)
    expect(isWithinWindows(undefined, NOV(15))).toBe(true)
  })

  it('is open inside a window', () => {
    expect(isWithinWindows([w(NOV(1), NOV(30))], NOV(15))).toBe(true)
  })

  it('includes both end days', () => {
    // A window "1 Nov to 30 Nov" must be open ON the 30th. Treating the
    // end as exclusive loses the parish a day every time.
    const windows = [w(NOV(1), NOV(30))]
    expect(isWithinWindows(windows, NOV(1))).toBe(true)
    expect(isWithinWindows(windows, NOV(30))).toBe(true)
  })

  it('is closed outside every window', () => {
    expect(isWithinWindows([w(NOV(1), NOV(10))], NOV(11))).toBe(false)
    expect(isWithinWindows([w(NOV(5), NOV(10))], NOV(4))).toBe(false)
  })

  it('is open if any one window covers the day', () => {
    const windows = [w(NOV(1), NOV(5)), w(NOV(20), NOV(25))]
    expect(isWithinWindows(windows, NOV(22))).toBe(true)
    expect(isWithinWindows(windows, NOV(12))).toBe(false)
  })

  it('handles a single-day window', () => {
    expect(isWithinWindows([w(NOV(8), NOV(8))], NOV(8))).toBe(true)
  })

  it('falls back to OPEN when every stored window is unusable', () => {
    // Deliberately open, not closed. A corrupt field is indistinguishable
    // from no field, and the two failures are not equally bad: closing
    // means the parish cannot take applications and has nothing on screen
    // explaining why, while opening means applications may arrive out of
    // season - which the manual switch fixes in one tap.
    expect(isWithinWindows([w('', '')], NOV(8))).toBe(true)
    expect(isWithinWindows([w('not a date', NOV(30))], NOV(8))).toBe(true)
  })

  it('still honours the good windows when only some are unusable', () => {
    // The fallback above must not become a way for one bad row to
    // silently reopen a sacrament the parish closed for the season.
    const windows = [w(NOV(1), NOV(5)), w('rubbish', 'rubbish')]
    expect(isWithinWindows(windows, NOV(3))).toBe(true)
    expect(isWithinWindows(windows, NOV(20))).toBe(false)
  })

  it('tolerates a window entered backwards', () => {
    // The admin picked the dates the wrong way round. Refusing to open
    // at all would be a silent failure they cannot see.
    expect(isWithinWindows([w(NOV(30), NOV(1))], NOV(15))).toBe(true)
  })
})

describe('nextOpening', () => {
  it('names the next window when currently closed', () => {
    expect(nextOpening([w(NOV(20), NOV(25))], NOV(10))).toBe(NOV(20))
  })

  it('is null while already open', () => {
    expect(nextOpening([w(NOV(1), NOV(30))], NOV(15))).toBeNull()
  })

  it('is null when every window is in the past', () => {
    expect(nextOpening([w(NOV(1), NOV(5))], NOV(20))).toBeNull()
  })

  it('picks the soonest of several', () => {
    const windows = [w(NOV(25), NOV(26)), w(NOV(18), NOV(19))]
    expect(nextOpening(windows, NOV(10))).toBe(NOV(18))
  })
})

describe('withWindow / withoutWindow', () => {
  it('adds a window', () => {
    expect(withWindow([], w(NOV(1), NOV(5)))).toEqual([w(NOV(1), NOV(5))])
  })

  it('keeps windows in date order', () => {
    const list = withWindow([w(NOV(20), NOV(21))], w(NOV(1), NOV(2)))
    expect(list[0].from).toBe(NOV(1))
  })

  it('refuses a duplicate rather than growing the field', () => {
    const one = [w(NOV(1), NOV(5))]
    expect(withWindow(one, w(NOV(1), NOV(5)))).toEqual(one)
  })

  it('caps how many can be added', () => {
    // This is written to a shared Firestore document with a 1 MiB
    // ceiling; an unbounded list is how that document dies.
    let list: OpenWindow[] = []
    for (let i = 1; i <= MAX_WINDOWS_PER_ITEM + 5; i++) {
      list = withWindow(list, w(`2027-01-${String(i).padStart(2, '0')}`, `2027-01-${String(i).padStart(2, '0')}`))
    }
    expect(list.length).toBe(MAX_WINDOWS_PER_ITEM)
  })

  it('removes a window by its dates', () => {
    const list = [w(NOV(1), NOV(5)), w(NOV(20), NOV(25))]
    expect(withoutWindow(list, w(NOV(1), NOV(5)))).toEqual([w(NOV(20), NOV(25))])
  })
})

describe('normaliseWindows', () => {
  it('drops anything unusable', () => {
    const raw = [w(NOV(1), NOV(5)), w('', NOV(9)), w('rubbish', 'rubbish')]
    expect(normaliseWindows(raw as OpenWindow[])).toEqual([w(NOV(1), NOV(5))])
  })

  it('survives a field that is not an array', () => {
    expect(normaliseWindows(undefined)).toEqual([])
    expect(normaliseWindows('nonsense' as never)).toEqual([])
  })
})

describe('describeWindows', () => {
  it('says when it opens next', () => {
    expect(describeWindows([w(NOV(20), NOV(25))], NOV(10))).toMatch(/opens/i)
  })

  it('says nothing is scheduled when there are no windows', () => {
    expect(describeWindows([], NOV(10))).toMatch(/any time|no dates/i)
  })
})
