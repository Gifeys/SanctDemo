import { describe, expect, it } from 'vitest'
import { verseForDate } from './verses'
import { liturgicalDay } from './liturgical'

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('verseForDate', () => {
  it('matches the verse to the liturgical season', () => {
    // Easter 2026 is 5 April; Ash Wednesday 18 February; Advent starts 29 Nov.
    expect(verseForDate(on(2026, 4, 5)).season).toBe('Easter')
    expect(verseForDate(on(2026, 3, 1)).season).toBe('Lent')
    expect(verseForDate(on(2026, 12, 1)).season).toBe('Advent')
    expect(verseForDate(on(2026, 8, 27)).season).toBe('Ordinary Time')
  })

  it('agrees with the liturgical calendar it is built on', () => {
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      expect(verseForDate(d).season).toBe(liturgicalDay(d).season)
    }
  })

  // Two pilgrims standing beside each other must see the same verse, and it
  // must not change while one of them is reading it. A random pick would do
  // both wrong.
  it('is stable within a day and identical across calls', () => {
    const morning = new Date(2026, 7, 27, 6, 0)
    const evening = new Date(2026, 7, 27, 22, 30)
    expect(verseForDate(morning)).toEqual(verseForDate(evening))
    expect(verseForDate(morning)).toEqual(verseForDate(morning))
  })

  it('changes from one day to the next', () => {
    const a = verseForDate(on(2026, 8, 27))
    const b = verseForDate(on(2026, 8, 28))
    expect(a.reference).not.toBe(b.reference)
  })

  it('always returns a real verse, every day for three years', () => {
    for (let d = new Date(2026, 0, 1); d.getFullYear() < 2029; d.setDate(d.getDate() + 1)) {
      const v = verseForDate(d)
      expect(v.text.length).toBeGreaterThan(10)
      expect(v.reference).toMatch(/\d/)
    }
  })

  it('cycles through the whole pool rather than sticking on one verse', () => {
    // A fortnight of Ordinary Time should surface several distinct verses.
    const seen = new Set<string>()
    for (let i = 0; i < 14; i++) {
      seen.add(verseForDate(on(2026, 8, 10 + i)).reference)
    }
    expect(seen.size).toBeGreaterThan(5)
  })
})
