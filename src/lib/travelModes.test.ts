import { describe, expect, it } from 'vitest'
import {
  TRAVEL_MODES,
  formatModeDuration,
  minutesFor,
  travelMode,
} from './travelModes'

describe('TRAVEL_MODES', () => {
  it('offers exactly walk, motorcycle and car', () => {
    expect(TRAVEL_MODES.map(m => m.id)).toEqual(['walk', 'motorcycle', 'car'])
  })

  it('has no public-transit mode, because no free service carries jeepney data', () => {
    const ids = TRAVEL_MODES.map(m => m.id) as string[]
    expect(ids).not.toContain('transit')
  })

  it('rates a motorcycle faster than a car, which filters through the traffic a car sits in', () => {
    expect(travelMode('motorcycle').speedMps).toBeGreaterThan(travelMode('car').speedMps)
  })

  it('rates every vehicle faster than walking', () => {
    const walk = travelMode('walk').speedMps
    expect(travelMode('car').speedMps).toBeGreaterThan(walk)
    expect(travelMode('motorcycle').speedMps).toBeGreaterThan(walk)
  })

  it('labels every mode as an estimate, so no time reads as a routed figure', () => {
    for (const mode of TRAVEL_MODES) {
      expect(mode.note.toLowerCase()).toContain('estimated')
    }
  })
})

describe('minutesFor', () => {
  it('walks 5 km in an hour', () => {
    expect(minutesFor(5000, travelMode('walk'))).toBeCloseTo(60, 5)
  })

  it('gives a longer time to the slower mode over the same distance', () => {
    const d = 3000
    expect(minutesFor(d, travelMode('walk'))).toBeGreaterThan(minutesFor(d, travelMode('car')))
    expect(minutesFor(d, travelMode('car'))).toBeGreaterThan(minutesFor(d, travelMode('motorcycle')))
  })

  it('is zero at zero distance', () => {
    expect(minutesFor(0, travelMode('car'))).toBe(0)
  })
})

describe('formatModeDuration', () => {
  it('reads whole minutes under an hour', () => {
    expect(formatModeDuration(21)).toBe('21 min')
    expect(formatModeDuration(59.4)).toBe('59 min')
  })

  it('never shows a bare zero for a very short hop', () => {
    expect(formatModeDuration(0.4)).toBe('<1 min')
  })

  it('breaks an hour or more into hours and minutes', () => {
    expect(formatModeDuration(81)).toBe('1 hr 21 min')
    expect(formatModeDuration(120)).toBe('2 hr')
  })

  it('rounds rather than truncating, so 59.6 minutes is an hour', () => {
    expect(formatModeDuration(59.6)).toBe('1 hr')
  })
})
