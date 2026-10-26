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

/**
 * Where to send someone whose phone cannot run it.
 *
 * The app's own download page, not the source repository. The
 * repository link was public here and on the landing page's footer,
 * which published the whole codebase to anyone who read either one.
 */
export const AR_APP_HELP = '/get/'

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
 * The parish whose stations the AR app should load.
 *
 * The one the pilgrim chose. Always.
 *
 * ## What this used to do, and why it was wrong
 *
 * It substituted the sala preview whenever the simulator was off and
 * presence could not confirm the pilgrim was inside a geofence. The
 * intention was kind - opening the tour at a desk localizes against a
 * church kilometres away, which made Start AR look broken while we
 * were building it.
 *
 * The cost landed on the person it was meant to help. GPS indoors, in
 * a concrete church, is exactly where a geofence fails; so somebody
 * standing in Mary Help of Christians, in front of the marker, tapped
 * Start AR and was handed a scan of the proponents' living room. At
 * San Roque the same thing, and the id it substituted was the MHCP
 * preview - so the wrong parish, not merely the wrong room.
 *
 * ## Why no substitution is also the safer failure
 *
 * The AR app cannot start until it reads a printed marker. Away from
 * the parish there is no marker, so the honest outcome of launching
 * the real parish at a desk is an app that waits and says it is
 * waiting. That is self-explanatory. Being shown a different church's
 * stations is not, and it cannot be told apart from the app being
 * broken - which is precisely how it was read.
 *
 * The sala is still reachable: AR_SALA_PREVIEW is a parish id like any
 * other and can be chosen on purpose. What it can no longer do is
 * arrive uninvited in place of the parish somebody picked.
 */
export function arLaunchParish(
  { parishId }: ArLaunchTarget,
): string {
  return parishId
}
