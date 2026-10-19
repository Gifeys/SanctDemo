import { describe, expect, it } from 'vitest'
import { isHandset, readDeviceSignals } from './deviceClass'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 16; Infinix X6887) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'

describe('isHandset', () => {
  it('recognises the phones the app is actually used on', () => {
    expect(isHandset({ userAgent: IPHONE, width: 390, coarsePointer: true })).toBe(true)
    expect(isHandset({ userAgent: ANDROID_PHONE, width: 412, coarsePointer: true })).toBe(true)
  })

  it('does not treat a Windows laptop as a phone', () => {
    expect(isHandset({ userAgent: WINDOWS, width: 1440, coarsePointer: false })).toBe(false)
  })

  it('does not treat a narrow laptop window as a phone', () => {
    // The whole reason width alone is not the test. Somebody with a
    // half-screen browser is still on a laptop and still wants the page
    // about the app.
    expect(isHandset({ userAgent: WINDOWS, width: 420, coarsePointer: false })).toBe(false)
  })

  it('treats tablets as not-a-handset, on purpose', () => {
    // The app's layout is for a phone held in one hand. On a 10-inch
    // screen the promotional page is the better first impression, and
    // Explore is right there for anyone who disagrees.
    expect(isHandset({ userAgent: IPAD, width: 820, coarsePointer: true })).toBe(false)
    expect(isHandset({ userAgent: ANDROID_TABLET, width: 800, coarsePointer: true })).toBe(false)
  })

  it('still catches a phone whose user agent says nothing useful', () => {
    // Some in-app browsers strip the string. A small screen plus a
    // finger is enough to decide.
    expect(isHandset({ userAgent: '', width: 390, coarsePointer: true })).toBe(true)
  })

  it('needs BOTH a small screen and a finger before guessing', () => {
    expect(isHandset({ userAgent: '', width: 390, coarsePointer: false })).toBe(false)
    expect(isHandset({ userAgent: '', width: 1400, coarsePointer: true })).toBe(false)
  })

  it('survives a zero width, which is what a hidden iframe reports', () => {
    expect(isHandset({ userAgent: '', width: 0, coarsePointer: true })).toBe(false)
  })
})

describe('readDeviceSignals', () => {
  it('reads what the browser offers', () => {
    const win = {
      navigator: { userAgent: IPHONE },
      innerWidth: 390,
      matchMedia: () => ({ matches: true }),
    } as unknown as Window

    expect(readDeviceSignals(win)).toEqual({
      userAgent: IPHONE,
      width: 390,
      coarsePointer: true,
    })
  })

  it('falls back to desktop when matchMedia throws', () => {
    // Showing the explanation page to a phone is a smaller mistake than
    // dropping a laptop visitor into an interface they did not ask for.
    const win = {
      navigator: { userAgent: WINDOWS },
      innerWidth: 1440,
      matchMedia: () => {
        throw new Error('nope')
      },
    } as unknown as Window

    expect(readDeviceSignals(win).coarsePointer).toBe(false)
  })

  it('survives a browser with no matchMedia at all', () => {
    const win = { navigator: { userAgent: WINDOWS }, innerWidth: 1280 } as unknown as Window
    expect(readDeviceSignals(win).coarsePointer).toBe(false)
  })
})
