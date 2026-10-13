// Handoff from SanctiWalk to the native AR tour app.
//
// The AR tour is a separate Unity/ARCore application, because the browser
// cannot do what it does: ARCore's world tracking keeps content anchored to a
// place after the trigger image has left the camera, and no web API on iOS or
// Android offers that today. SanctiWalk stays a web app and launches it.
//
// Pure and dependency-free so the URL building and platform rules can be
// tested without a browser.

/** Custom scheme registered by the AR app's Android manifest. */
export const AR_APP_SCHEME = 'sanctiwalkar'

/** Where to send someone whose phone cannot run it. */
export const AR_APP_HELP = 'https://github.com/Gifeys/SanctDemo'

export type ArAvailability =
  | { kind: 'ready' }
  | { kind: 'ios'; reason: string }
  | { kind: 'desktop'; reason: string }

/**
 * Whether the AR app can be launched from this device.
 *
 * Deliberately honest about iOS. The AR app is an Android build: an iOS
 * version needs Xcode on macOS to compile, which the project does not have
 * yet. Offering the button on an iPhone would open nothing and look broken,
 * so it says why instead.
 */
export function arAvailability(
  userAgent: string,
  /**
   * Capacitor's own answer, when there is one: 'android', 'ios' or 'web'.
   *
   * The user agent is a guess at what the device is, and inside the
   * Android WebView it is a guess that can be wrong - a shell that
   * trims or rewrites it leaves no 'android' to find, and SanctiWalk
   * then tells somebody holding an Android phone that their Android
   * phone cannot run the Android app. Capacitor is not guessing: it
   * knows which shell it is running in. The user agent stays as the
   * fallback for the browser, where there is no Capacitor.
   */
  platform?: string,
): ArAvailability {
  if (platform === 'android') return { kind: 'ready' }
  if (platform === 'ios') {
    return {
      kind: 'ios',
      reason: 'The AR tour is an Android app for now. An iPhone version needs a Mac to build.',
    }
  }

  const ua = userAgent.toLowerCase()

  if (/iphone|ipad|ipod/.test(ua)) {
    return {
      kind: 'ios',
      reason: 'The AR tour is an Android app for now. An iPhone version needs a Mac to build.',
    }
  }

  if (!/android/.test(ua)) {
    return {
      kind: 'desktop',
      reason: 'Open SanctiWalk on an Android phone to start the AR tour.',
    }
  }

  return { kind: 'ready' }
}

/**
 * The launch URL for a parish's AR tour.
 *
 * The parish id travels with the link so the AR app knows whose stations to
 * load — the same id used everywhere else in SanctiWalk, so nothing has to be
 * mapped or translated between the two applications.
 */
export function arTourUrl(parishId: string): string {
  return `${AR_APP_SCHEME}://tour?church=${encodeURIComponent(parishId)}`
}

/**
 * The sala stand-in the AR app ships for testing.
 *
 * It is the same four models on the scan of the proponents' sala, and the
 * AR app already knows this id; nothing new is installed to use it.
 */
export const AR_SALA_PREVIEW = 'route-mhcp-preview'

export interface ArLaunchTarget {
  parishId: string
  /** The simulator setting, from simulatorMode.ts. */
  simulatorMode: boolean
  /** True when presence says the pilgrim is inside a parish's geofence. */
  atParish: boolean
}

/**
 * Which parish the AR app should actually open.
 *
 * SanctiWalk used to hand over its own parish id unconditionally, so
 * pressing Start AR at home opened Maypajo: the phone localized against a
 * church it was nowhere near and drew that church's plan across the room.
 * There was no way to reach the sala from the app at all, only an adb
 * deep link.
 *
 * So the same switch that decides whether the tour may open at all also
 * decides what it opens:
 *
 *   simulator ON  - the visitor's build. Always the real parish; arAccess
 *                   has already refused the launch unless they are
 *                   standing in it.
 *   simulator OFF - the testing build. At a parish it is still that
 *                   parish, because being there is the whole point;
 *                   anywhere else it is the sala, which is the only room
 *                   whose scan and models this phone can actually see.
 */
export function arLaunchParish(
  { parishId, simulatorMode, atParish }: ArLaunchTarget,
): string {
  if (simulatorMode || atParish) return parishId
  return AR_SALA_PREVIEW
}
