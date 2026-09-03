import { describe, expect, it } from 'vitest'
import { checkParishColour, contrastRatio, parseHex, readableTextOn } from './contrast'

describe('parseHex', () => {
  it('accepts both short and long form', () => {
    expect(parseHex('#1C2C56')).toEqual({ r: 28, g: 44, b: 86 })
    expect(parseHex('1c2c56')).toEqual({ r: 28, g: 44, b: 86 })
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('rejects anything else rather than guessing', () => {
    expect(parseHex('navy')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('')).toBeNull()
    expect(parseHex('#gggggg')).toBeNull()
  })
})

describe('contrastRatio', () => {
  // The two anchors of the scale, worth pinning so a refactor cannot quietly
  // rescale everything else.
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1)
    expect(contrastRatio({ r: 28, g: 44, b: 86 }, { r: 28, g: 44, b: 86 })).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    const a = { r: 28, g: 44, b: 86 }
    const b = { r: 250, g: 248, b: 244 }
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })
})

describe('readableTextOn', () => {
  it('puts light text on a dark colour and dark text on a light one', () => {
    expect(readableTextOn({ r: 28, g: 44, b: 86 }).hex).toBe('#FAF8F4') // the app navy
    expect(readableTextOn({ r: 217, g: 173, b: 99 }).hex).toBe('#14171F') // the app gold
  })

  it('always returns the better of the two, never the worse', () => {
    for (const rgb of [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 128, g: 128, b: 128 },
      { r: 76, g: 122, b: 92 },
    ]) {
      const chosen = readableTextOn(rgb)
      const other = chosen.hex === '#14171F' ? { r: 250, g: 248, b: 244 } : { r: 20, g: 23, b: 31 }
      expect(chosen.ratio).toBeGreaterThanOrEqual(contrastRatio(rgb, other))
    }
  })
})

describe('checkParishColour', () => {
  it('accepts the app\'s own navy', () => {
    const verdict = checkParishColour('#1C2C56')
    expect(verdict.ok).toBe(true)
    expect(verdict.problem).toBeNull()
  })

  // A mid-tone is the genuinely dangerous case: it is too light for pale text
  // and too dark for ink, so NEITHER reads on it. #787878 measures 4.16:1 at
  // best — a button in it has no legible label whichever way you go.
  it('rejects a mid-tone that would leave button labels unreadable', () => {
    const verdict = checkParishColour('#787878')
    expect(verdict.ok).toBe(false)
    expect(verdict.onColourRatio).toBeLessThan(4.5)
    expect(verdict.problem).toMatch(/button/i)
  })

  // A colour can pass one job and fail the other, which is why both are
  // checked. The app's own gold carries ink perfectly well on a button — that
  // pairing is used elsewhere — but at 2.0:1 on paper it vanishes as a
  // heading, so it is not usable as a parish colour.
  it('rejects a colour too faint to read as a heading on paper', () => {
    const verdict = checkParishColour('#D9AD63')
    expect(verdict.ok).toBe(false)
    expect(verdict.onColourRatio).toBeGreaterThanOrEqual(4.5)
    expect(verdict.asTextRatio).toBeLessThan(4.5)
    expect(verdict.problem).toMatch(/heading/i)
  })

  it('explains an invalid value instead of failing silently', () => {
    const verdict = checkParishColour('not-a-colour')
    expect(verdict.ok).toBe(false)
    expect(verdict.problem).toMatch(/valid colour/i)
  })

  it('accepts a range of genuinely usable liturgical colours', () => {
    for (const hex of ['#1C2C56', '#6B1F2E', '#2F4F2F', '#4A2C6B']) {
      expect(checkParishColour(hex).ok, `${hex} should be usable`).toBe(true)
    }
  })
})
