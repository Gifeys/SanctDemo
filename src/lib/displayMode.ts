import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

// Is this screen a real device surface, or a desktop showing the app off?
//
// App.tsx wraps everything in PhoneContainer, which draws a 385x780 phone
// mockup: a notch, a painted status bar reading "LTE 98%", an iOS home
// indicator, and a Phone / Full responsive toggle above it. On a laptop
// that is useful - it is how the app is demonstrated during the defense.
//
// On an actual phone it is absurd. The installed app rendered a picture of
// a phone inside the real one, so the app itself occupied a fraction of the
// screen, behind a fake battery percentage and beside buttons offering to
// switch viewport. It also made sign-in look like a bug: that screen is
// `fixed inset-0`, so it escaped the mockup and filled the real display,
// and the app appeared to change size on signing in. It did.
//
// Two things count as a real device surface:
//   - the installed Android app, which is definitionally a phone;
//   - any narrow viewport, because a phone mockup inside a phone browser is
//     the same mistake by another route.

/** The width at or below which the viewport is a phone, not a desk. */
export const DEVICE_WIDTH_BREAKPOINT = 768

/**
 * Pure so the rule can be tested without a browser.
 *
 * `native` is passed in rather than read here because Capacitor decides it
 * from the bridge, which does not exist under test.
 */
export function isDeviceSurface(native: boolean, viewportWidth: number): boolean {
  return native || viewportWidth <= DEVICE_WIDTH_BREAKPOINT
}

function readNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    // The bridge is absent in a plain browser and in tests. Not native.
    return false
  }
}

function currentWidth(): number {
  // Server-side or a stubbed environment: assume a desk, which keeps the
  // existing presentation behaviour rather than silently changing it.
  if (typeof window === 'undefined') return Number.POSITIVE_INFINITY
  return window.innerWidth
}

/**
 * Live answer, so rotating the phone or dragging a desktop window narrow
 * takes effect immediately instead of at the next reload.
 */
export function useDeviceSurface(): boolean {
  const [deviceSurface, setDeviceSurface] = useState(() => isDeviceSurface(readNative(), currentWidth()))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const native = readNative()
    const update = () => setDeviceSurface(isDeviceSurface(native, window.innerWidth))
    update()
    window.addEventListener('resize', update)
    // Rotation does not always fire resize on Android WebView.
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return deviceSurface
}
