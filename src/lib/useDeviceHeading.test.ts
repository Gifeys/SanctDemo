import { describe, expect, it } from 'vitest'
import { readEventHeading } from './useDeviceHeading'

// readEventHeading is the one part of the compass that can be tested without
// a magnetometer: it turns a raw orientation event into a bearing. The event
// shapes below are what iOS and Android actually deliver.
function event(fields: Partial<{ absolute: boolean; alpha: number | null; webkitCompassHeading: number }>) {
  return fields as unknown as Parameters<typeof readEventHeading>[0]
}

describe('readEventHeading', () => {
  describe('iOS (webkitCompassHeading)', () => {
    it('uses the compass heading directly — it is already a clockwise bearing', () => {
      expect(readEventHeading(event({ webkitCompassHeading: 90 }))).toBe(90)
      expect(readEventHeading(event({ webkitCompassHeading: 315 }))).toBe(315)
    })

    it('wins over alpha when both are present', () => {
      // If alpha were used here the result would be 360-10 = 350, not 90.
      expect(readEventHeading(event({ webkitCompassHeading: 90, absolute: true, alpha: 10 }))).toBe(90)
    })

    it('normalizes an out-of-range compass heading', () => {
      expect(readEventHeading(event({ webkitCompassHeading: 365 }))).toBe(5)
    })
  })

  describe('Android (absolute alpha)', () => {
    // alpha runs counter-clockwise; a bearing runs clockwise. Reversing this
    // yields a compass that mirrors every turn — the failure this guards.
    it('inverts alpha into a clockwise bearing', () => {
      expect(readEventHeading(event({ absolute: true, alpha: 0 }))).toBe(0)
      expect(readEventHeading(event({ absolute: true, alpha: 270 }))).toBe(90)
      expect(readEventHeading(event({ absolute: true, alpha: 90 }))).toBe(270)
      expect(readEventHeading(event({ absolute: true, alpha: 180 }))).toBe(180)
    })

    it('wraps rather than returning 360', () => {
      expect(readEventHeading(event({ absolute: true, alpha: 0 }))).toBe(0)
      expect(readEventHeading(event({ absolute: true, alpha: 360 }))).toBe(0)
    })
  })

  describe('readings that must be rejected', () => {
    // A relative event's alpha looks like a perfectly good number but is
    // measured from wherever the phone happened to be at page load. Showing
    // it would be worse than showing nothing — it is confidently wrong.
    it('rejects a non-absolute event', () => {
      expect(readEventHeading(event({ absolute: false, alpha: 120 }))).toBeNull()
    })

    it('rejects an event with no absolute flag at all', () => {
      expect(readEventHeading(event({ alpha: 120 }))).toBeNull()
    })

    it('rejects a null or missing alpha', () => {
      expect(readEventHeading(event({ absolute: true, alpha: null }))).toBeNull()
      expect(readEventHeading(event({ absolute: true }))).toBeNull()
    })

    it('rejects non-finite values from either source', () => {
      expect(readEventHeading(event({ absolute: true, alpha: Number.NaN }))).toBeNull()
      expect(readEventHeading(event({ webkitCompassHeading: Number.NaN, absolute: false }))).toBeNull()
    })
  })
})
