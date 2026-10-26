import { describe, expect, it } from 'vitest'

import { arSiteReadiness } from './arPresence'

const AT = { gpsStatus: 'granted' as const, hereParishId: 'route-mhcp' }

describe('arSiteReadiness', () => {
  it('lets you in when you are standing at the parish', () => {
    expect(arSiteReadiness({ ...AT, tourParishId: 'route-mhcp' }).canOpen).toBe(true)
  })

  it('keeps you out when you are somewhere else', () => {
    const state = arSiteReadiness({ ...AT, tourParishId: 'route-src' })
    expect(state.canOpen).toBe(false)
    expect(state.reason).toMatch(/San Roque|there|at the/i)
  })

  it('keeps you out when you are at no parish at all', () => {
    expect(arSiteReadiness({ ...AT, hereParishId: null, tourParishId: 'route-mhcp' }).canOpen)
      .toBe(false)
  })

  it('lets you in when location is DENIED, rather than locking you out', () => {
    // The decision taken with the parish: a phone with location off
    // cannot be distinguished from a phone that is far away, and
    // refusing would strand somebody standing at the altar with no way
    // to proceed. They get the warning instead.
    const state = arSiteReadiness({ gpsStatus: 'denied', hereParishId: null, tourParishId: 'route-mhcp' })
    expect(state.canOpen).toBe(true)
    expect(state.warn).toBe(true)
  })

  it('lets you in while the fix is still being searched for', () => {
    // Same reasoning, and this one is common: a cold GPS indoors takes
    // tens of seconds, which is exactly when someone opens the app.
    const state = arSiteReadiness({ gpsStatus: 'searching', hereParishId: null, tourParishId: 'route-mhcp' })
    expect(state.canOpen).toBe(true)
    expect(state.warn).toBe(true)
  })

  it('lets you in when the device has no geolocation at all', () => {
    expect(arSiteReadiness({ gpsStatus: 'unavailable', hereParishId: null, tourParishId: 'route-mhcp' }).canOpen)
      .toBe(true)
  })

  it('does not warn when it actually knows you are there', () => {
    // The warning is for uncertainty. Showing it to somebody the app
    // has placed inside the church makes every warning ignorable.
    expect(arSiteReadiness({ ...AT, tourParishId: 'route-mhcp' }).warn).toBe(false)
  })

  it('warns even when it lets you through on a lost fix', () => {
    const state = arSiteReadiness({ gpsStatus: 'lost', hereParishId: null, tourParishId: 'route-mhcp' })
    expect(state.canOpen).toBe(true)
    expect(state.warn).toBe(true)
  })

  it('always explains itself', () => {
    for (const status of ['granted', 'denied', 'searching', 'lost', 'unavailable'] as const) {
      const state = arSiteReadiness({ gpsStatus: status, hereParishId: null, tourParishId: 'route-src' })
      expect(state.reason.length).toBeGreaterThan(10)
    }
  })
})
