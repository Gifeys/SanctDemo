import { describe, expect, it } from 'vitest'
import { ACCENTED_COLOURS, seasonAccent } from './liturgicalColours'
import { contrastRatio, parseHex } from './contrast'
import { liturgicalDay } from './liturgical'

// The point of these tests is that a seasonal accent is exactly where an
// unreadable card comes from: someone picks the pretty hue, the text keeps its
// old colour, and the pairing is never checked. So the pairings are checked.

const BODY_INK = '#14171F' // --color-brand-text

function ratio(a: string, b: string): number {
  const x = parseHex(a)
  const y = parseHex(b)
  expect(x).not.toBeNull()
  expect(y).not.toBeNull()
  return contrastRatio(x!, y!)
}

describe('seasonAccent', () => {
  it('covers every liturgical colour', () => {
    expect(ACCENTED_COLOURS.sort()).toEqual(['green', 'red', 'rose', 'violet', 'white'])
  })

  it('returns parseable hex for every colour', () => {
    for (const colour of ACCENTED_COLOURS) {
      const accent = seasonAccent(colour)
      for (const value of [accent.tint, accent.border, accent.ink]) {
        expect(parseHex(value), `${colour}: ${value}`).not.toBeNull()
      }
    }
  })

  it('clears WCAG AA for its own ink on its own tint', () => {
    for (const colour of ACCENTED_COLOURS) {
      const { tint, ink } = seasonAccent(colour)
      expect(ratio(tint, ink), colour).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears WCAG AA for ordinary body text on its tint', () => {
    for (const colour of ACCENTED_COLOURS) {
      const { tint } = seasonAccent(colour)
      expect(ratio(tint, BODY_INK), colour).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the tint light, so the card reads as paper and not as a block of colour', () => {
    for (const colour of ACCENTED_COLOURS) {
      const { tint } = seasonAccent(colour)
      // Against near-black: a genuinely light wash sits far from the ink.
      expect(ratio(tint, '#000000'), colour).toBeGreaterThan(14)
    }
  })

  it('gives the border more presence than the tint', () => {
    for (const colour of ACCENTED_COLOURS) {
      const { tint, border } = seasonAccent(colour)
      expect(ratio(border, '#FFFFFF'), colour).toBeGreaterThan(ratio(tint, '#FFFFFF'))
    }
  })

  it('has an accent for whatever colour the calendar returns across a whole year', () => {
    // 2026 is arbitrary; the loop is the point. Any date whose colour had no
    // accent would render an undefined background.
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day))
      const accent = seasonAccent(liturgicalDay(date).colour)
      expect(accent, date.toISOString().slice(0, 10)).toBeDefined()
      expect(parseHex(accent.tint)).not.toBeNull()
    }
  })

  it('distinguishes the seasons — no two colours share a tint', () => {
    const tints = ACCENTED_COLOURS.map(c => seasonAccent(c).tint)
    expect(new Set(tints).size).toBe(tints.length)
  })
})
