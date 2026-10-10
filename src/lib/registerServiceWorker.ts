/**
 * Turning the web build into something an iPhone can keep.
 *
 * ## Why only here, and only sometimes
 *
 * The Android app is a real APK and serves its own bundle from inside
 * itself. A service worker there would be a second cache in front of
 * files that are already local, and the first thing it would do is make
 * an update stick. So it is registered only in a browser.
 *
 * It is also registered only in a production build. In development Vite
 * serves modules it expects to replace on every save, and a worker
 * caching them turns hot reload into a puzzle.
 */

/** True inside the Capacitor shell, where the bundle is already local. */
function insideNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  // Read from the global rather than importing Capacitor: this runs
  // before the app mounts, and it must not drag the native bridge into
  // the first chunk a browser downloads.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  try {
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (insideNativeApp()) return
  if (!import.meta.env.PROD) return

  // After load, not during. Registering while the page is still fetching
  // its own assets makes the worker compete with the thing it exists to
  // speed up, and the first visit is the one that matters.
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(error => {
      // A refused registration is not worth an error screen. The app
      // works without it; it simply will not open offline.
      console.warn('[SanctiWalk] offline support unavailable:', error)
    })
  })
}
