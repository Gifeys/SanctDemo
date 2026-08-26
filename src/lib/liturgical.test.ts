import { describe, expect, it } from 'vitest'
import { adventStart, baptismOfTheLord, easterSunday, liturgicalDay } from './liturgical'

const on = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const name = (y: number, m: number, d: number) => liturgicalDay(on(y, m, d)).name

describe('easterSunday', () => {
  // Published dates — the whole calendar hangs off these, so they are worth
  // pinning across a spread of years rather than trusting the algorithm.
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'], // latest possible Easter
  ])('%i falls on %s', (year, iso) => {
    expect(easterSunday(year).toISOString().slice(0, 10)).toBe(iso)
  })
})

describe('adventStart', () => {
  it('is the fourth Sunday before Christmas', () => {
    expect(adventStart(2026).toISOString().slice(0, 10)).toBe('2026-11-29')
    expect(adventStart(2025).toISOString().slice(0, 10)).toBe('2025-11-30')
  })

  // 2022's Christmas was itself a Sunday, the case that breaks a naive
  // "Sunday on or before Christmas, minus 21 days".
  it('handles Christmas falling on a Sunday', () => {
    expect(adventStart(2022).toISOString().slice(0, 10)).toBe('2022-11-27')
  })
})

describe('baptismOfTheLord', () => {
  it('is the Sunday after the transferred Epiphany', () => {
    expect(baptismOfTheLord(2026).toISOString().slice(0, 10)).toBe('2026-01-11')
    expect(baptismOfTheLord(2025).toISOString().slice(0, 10)).toBe('2025-01-12')
  })
})

describe('liturgicalDay — the design\'s own example', () => {
  // The redesign's Home mockup is dated Wednesday 26 August 2026 and names
  // the day "Wednesday of the 21st Week in Ordinary Time". If this fails,
  // either the algorithm or the mockup is wrong.
  it('names Wednesday 26 August 2026 exactly as the mockup does', () => {
    const day = liturgicalDay(on(2026, 8, 26))
    expect(day.name).toBe('Wednesday of the 21st Week in Ordinary Time')
    expect(day.season).toBe('Ordinary Time')
    expect(day.week).toBe(21)
    expect(day.colour).toBe('green')
  })
})

describe('liturgicalDay — seasons', () => {
  it('names Advent and its weeks', () => {
    expect(name(2026, 11, 29)).toBe('Sunday of the 1st Week of Advent')
    expect(name(2026, 12, 8)).toBe('Tuesday of the 2nd Week of Advent')
    expect(liturgicalDay(on(2026, 12, 13)).colour).toBe('rose') // Gaudete
  })

  it('names Christmastide on both sides of the new year', () => {
    expect(liturgicalDay(on(2026, 12, 25)).feast).toBe('Christmas Day')
    expect(liturgicalDay(on(2026, 12, 29)).season).toBe('Christmas')
    expect(liturgicalDay(on(2026, 1, 5)).season).toBe('Christmas')
  })

  it('names Lent, counting weeks from the First Sunday', () => {
    // Easter 2026 is 5 April, so Ash Wednesday is 18 February.
    expect(liturgicalDay(on(2026, 2, 18)).feast).toBe('Ash Wednesday')
    expect(name(2026, 2, 20)).toBe('Friday after Ash Wednesday')
    expect(name(2026, 2, 24)).toBe('Tuesday of the 1st Week of Lent')
    expect(liturgicalDay(on(2026, 3, 15)).colour).toBe('rose') // Laetare
  })

  it('names the Triduum', () => {
    expect(liturgicalDay(on(2026, 4, 3)).season).toBe('Triduum') // Good Friday
  })

  it('names Eastertide and Pentecost', () => {
    expect(liturgicalDay(on(2026, 4, 5)).feast).toBe('Easter Sunday')
    expect(name(2026, 4, 8)).toBe('Wednesday of the 1st Week of Easter')
    const pentecost = liturgicalDay(on(2026, 5, 24))
    expect(pentecost.feast).toBe('Pentecost Sunday')
    expect(pentecost.colour).toBe('red')
  })
})

describe('liturgicalDay — Ordinary Time', () => {
  it('counts the first stretch forwards from the Baptism', () => {
    // Baptism 2026 is Sunday 11 January. It *occupies* the first Sunday of
    // Ordinary Time — there is no "1st Sunday in Ordinary Time" — so the
    // Monday after it begins Week 1, not Week 2.
    expect(name(2026, 1, 14)).toBe('Wednesday of the 1st Week in Ordinary Time')
  })

  // The second stretch is numbered backwards from Christ the King, because
  // the first stretch's length moves with Easter. Counting forwards through
  // Pentecost would leave a gap or an overlap.
  it('counts the second stretch backwards so it always ends at 34', () => {
    const christTheKing = on(2026, 11, 22)
    expect(liturgicalDay(christTheKing).week).toBe(34)
    expect(liturgicalDay(on(2026, 11, 15)).week).toBe(33)
  })

  it('resumes without a gap after Pentecost', () => {
    // Pentecost 2026 is 24 May; Ordinary Time resumes the next day at the
    // week the backwards count from Christ the King lands on — 8. That it
    // chains to 21 by 26 August is the real check that no gap opened: 8 plus
    // the 13 weeks between is exactly the mockup's own figure.
    const resumed = liturgicalDay(on(2026, 5, 26))
    expect(resumed.season).toBe('Ordinary Time')
    expect(resumed.week).toBe(8)
    expect(liturgicalDay(on(2026, 8, 26)).week).toBe(8 + 13)
  })

  it('never produces a week outside 1–34', () => {
    for (let year = 2024; year <= 2032; year++) {
      for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d = new Date(d.getTime() + 86400000)) {
        const day = liturgicalDay(d)
        if (day.season !== 'Ordinary Time') continue
        expect(day.week).toBeGreaterThanOrEqual(1)
        expect(day.week).toBeLessThanOrEqual(34)
      }
    }
  })

  it('always returns a non-empty name for every day across nine years', () => {
    for (let year = 2024; year <= 2032; year++) {
      for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d = new Date(d.getTime() + 86400000)) {
        expect(liturgicalDay(d).name.length).toBeGreaterThan(0)
      }
    }
  })
})
