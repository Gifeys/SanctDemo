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
export function arAvailability(userAgent: string): ArAvailability {
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
