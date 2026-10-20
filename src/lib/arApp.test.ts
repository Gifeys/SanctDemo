import { describe, expect, it } from 'vitest'
import {
  arAvailability,
  arLaunchParish,
  arTourUrl,
  AR_APP_SCHEME,
  AR_SALA_PREVIEW,
} from './arApp'

const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Infinix X6852) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

describe('arTourUrl', () => {
  it('carries the parish id so the AR app knows whose stations to load', () => {
    expect(arTourUrl('route-mhcp')).toBe(`${AR_APP_SCHEME}://tour?church=route-mhcp`)
  })

  it('escapes ids rather than producing a malformed URL', () => {
    expect(arTourUrl('a parish/id')).toBe(`${AR_APP_SCHEME}://tour?church=a%20parish%2Fid`)
  })
})

describe('arAvailability', () => {
  it('is ready on Android, which is what the AR app is built for', () => {
    expect(arAvailability(ANDROID).kind).toBe('ready')
  })

  // The honest case. An iPhone cannot open this link because no iOS build
  // exists — compiling one needs Xcode on macOS. Showing the button anyway
  // would do nothing and look like a bug, so it explains itself.
  it('explains itself on iPhone instead of offering a link that does nothing', () => {
    const result = arAvailability(IPHONE)
    expect(result.kind).toBe('ios')
    if (result.kind === 'ios') expect(result.reason).toMatch(/Android|Mac/)
  })

  it('tells a desktop user to switch to a phone', () => {
    expect(arAvailability(DESKTOP).kind).toBe('desktop')
  })

  it('is case-insensitive about the user agent', () => {
    expect(arAvailability(ANDROID.toUpperCase()).kind).toBe('ready')
    expect(arAvailability(IPHONE.toUpperCase()).kind).toBe('ios')
  })

  // iPadOS reports a Macintosh UA. That lands in 'desktop', which still
  // declines to offer the link — wrong wording, right outcome. Recorded so
  // the behaviour is known rather than discovered later.
  it('does not offer the link on an unrecognised platform', () => {
    expect(arAvailability('some unknown agent').kind).toBe('desktop')
  })
})

describe('arLaunchParish', () => {
  const mhcp = 'route-mhcp'
  const src = 'route-src'

  it('sends the parish the pilgrim chose, wherever they are standing', () => {
    // The bug this replaces: with the simulator off and presence unable
    // to confirm a geofence, it substituted the sala preview. GPS indoors
    // in a concrete church is exactly where a geofence fails, so somebody
    // standing in front of the marker at Mary Help of Christians was
    // handed a scan of the proponents' living room.
    for (const simulatorMode of [true, false]) {
      for (const atParish of [true, false]) {
        expect(arLaunchParish({ parishId: mhcp, simulatorMode, atParish })).toBe(mhcp)
      }
    }
  })

  it('never hands one parish another parish', () => {
    // The substituted id was the MHCP preview, so at San Roque the
    // mistake was not merely the wrong room - it was the wrong church.
    for (const atParish of [true, false]) {
      expect(arLaunchParish({ parishId: src, simulatorMode: false, atParish })).toBe(src)
    }
  })

  it('still opens the sala when the sala is what was chosen', () => {
    // Reachable on purpose, never by substitution.
    expect(
      arLaunchParish({ parishId: AR_SALA_PREVIEW, simulatorMode: false, atParish: false }),
    ).toBe(AR_SALA_PREVIEW)
  })

  it('carries the chosen parish into the URL', () => {
    const id = arLaunchParish({ parishId: src, simulatorMode: false, atParish: true })
    expect(arTourUrl(id)).toBe(`${AR_APP_SCHEME}://tour?church=${src}`)
  })
})

describe('arAvailability with a platform from Capacitor', () => {
  it('trusts the native shell over the user agent', () => {
    // The WebView's user agent can arrive without "android" in it, and
    // the app then tells somebody holding an Android phone that their
    // Android phone cannot run the Android app. Capacitor knows.
    expect(arAvailability('some rewritten ua', 'android').kind).toBe('ready')
  })

  it('still refuses an iPhone the shell reports', () => {
    expect(arAvailability('some rewritten ua', 'ios').kind).toBe('ios')
  })

  it('falls back to the user agent in a plain browser', () => {
    expect(arAvailability(ANDROID, 'web').kind).toBe('ready')
    expect(arAvailability(DESKTOP, 'web').kind).toBe('desktop')
  })

  it('is unchanged when no platform is given', () => {
    expect(arAvailability(ANDROID).kind).toBe('ready')
    expect(arAvailability(IPHONE).kind).toBe('ios')
  })
})
