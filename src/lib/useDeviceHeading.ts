import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SMOOTHING_ALPHA, normalizeDegrees, smoothHeading } from './heading'

/**
 * useDeviceHeading — the device compass, as a smoothed bearing in degrees.
 *
 * This is the browser's stand-in for Unity's `Input.compass`, and it carries
 * three constraints that do not exist in a native Android build:
 *
 *  1. **It needs a secure origin.** On `http://<LAN-IP>` the orientation
 *     events simply never fire — no error, no prompt, nothing. Same rule the
 *     camera lives under (see useCamera.ts), and the same trap: it works on
 *     the laptop and looks broken on the phone.
 *  2. **iOS requires an explicit gesture.** `DeviceOrientationEvent
 *     .requestPermission()` only resolves from inside a real tap handler, so
 *     the compass cannot start itself — hence `requestPermission` being
 *     returned for a button to call.
 *  3. **Desktops have no magnetometer.** A laptop reports `unavailable`
 *     forever. That is the expected state in a dev browser, not a bug, and
 *     everything downstream must render without a heading.
 *
 * What comes back is *magnetic* north, not true north. In Metro Manila the
 * declination is well under a degree, far below this sensor's own error, so
 * no correction is applied — worth knowing before anyone ports this further
 * afield, where the gap reaches tens of degrees.
 */

export type HeadingStatus =
  | 'unsupported' // no DeviceOrientationEvent at all
  | 'insecure' // not a secure origin, so events would never fire
  | 'prompt' // iOS: permission needed, awaiting a user gesture
  | 'granted' // listening
  | 'denied' // iOS: permission refused
  | 'unavailable' // listening, but no absolute heading is being produced

interface IOSDeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

interface AbsoluteOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/** True when the orientation sensors could fire here at all. */
export function isHeadingSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

/** iOS gates the sensor behind a permission call; Android and desktop do not. */
export function headingNeedsPermission(): boolean {
  if (!isHeadingSupported()) return false
  const ctor = window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent
  return typeof ctor.requestPermission === 'function'
}

/**
 * Turns one orientation event into a compass bearing, or null if it carries
 * no absolute reference.
 *
 * Two incompatible sources, and the difference matters:
 *
 * - iOS exposes `webkitCompassHeading`, already a clockwise bearing from
 *   north — usable as-is.
 * - Everyone else exposes `alpha`, which runs *counter*-clockwise, so the
 *   bearing is `360 - alpha`. Getting this backwards produces a compass that
 *   mirrors every turn, which reads as "the compass is broken" rather than
 *   as a sign error.
 *
 * A non-absolute event is rejected outright. `deviceorientation` without
 * `absolute` is relative to wherever the device happened to be when the page
 * loaded — a plausible-looking number with no relationship to north, which
 * is worse than showing nothing.
 */
export function readEventHeading(event: AbsoluteOrientationEvent): number | null {
  if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeDegrees(event.webkitCompassHeading)
  }
  if (!event.absolute) return null
  if (typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null
  return normalizeDegrees(360 - event.alpha)
}

/**
 * The sensor frame is fixed to the *device*, not the screen. Turning a phone
 * to landscape rotates what the user sees without changing the sensor's own
 * axes, so the heading has to be offset by the screen's rotation or the
 * compass reads 90° out whenever the phone is sideways.
 */
function screenAngle(): number {
  if (typeof window === 'undefined') return 0
  const angle = window.screen?.orientation?.angle
  return typeof angle === 'number' ? angle : 0
}

export interface DeviceHeading {
  /** Smoothed bearing, 0–360, or null when no heading is available. */
  heading: number | null
  /** Unsmoothed most recent reading — for diagnostics, not for display. */
  rawHeading: number | null
  status: HeadingStatus
  /** iOS only: call from a tap handler to request sensor access. */
  requestPermission: () => Promise<void>
}

export function useDeviceHeading({ alpha = DEFAULT_SMOOTHING_ALPHA }: { alpha?: number } = {}): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null)
  const [rawHeading, setRawHeading] = useState<number | null>(null)
  const [status, setStatus] = useState<HeadingStatus>(() => {
    if (!isHeadingSupported()) return 'unsupported'
    if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
    return headingNeedsPermission() ? 'prompt' : 'granted'
  })

  // Smoothing is a running value, and re-rendering on every sensor event at
  // ~60Hz to read it back out of state would be its own performance problem.
  const smoothedRef = useRef<number | null>(null)

  const requestPermission = useCallback(async () => {
    if (!headingNeedsPermission()) return
    const ctor = window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent
    try {
      const result = await ctor.requestPermission!()
      setStatus(result === 'granted' ? 'granted' : 'denied')
    } catch {
      // requestPermission throws when called outside a user gesture. That is
      // a wiring mistake rather than a refusal, but from here the two are
      // indistinguishable and both leave the compass off.
      setStatus('denied')
    }
  }, [])

  useEffect(() => {
    if (status !== 'granted') return

    let sawAbsoluteReading = false

    const onOrientation = (event: Event) => {
      const reading = readEventHeading(event as AbsoluteOrientationEvent)
      if (reading === null) return

      sawAbsoluteReading = true
      const corrected = normalizeDegrees(reading + screenAngle())
      setRawHeading(corrected)
      smoothedRef.current = smoothHeading(smoothedRef.current, corrected, { alpha })
      setHeading(smoothedRef.current)
    }

    // `deviceorientationabsolute` is the one that carries a true north
    // reference on Android. Plain `deviceorientation` is listened to as well
    // because that is where iOS delivers webkitCompassHeading; readings
    // without an absolute reference are discarded inside the handler.
    window.addEventListener('deviceorientationabsolute', onOrientation)
    window.addEventListener('deviceorientation', onOrientation)

    // A device with no magnetometer fires nothing at all, so silence is the
    // only signal that the sensor isn't there. Without this the UI would sit
    // on "granted" forever showing no heading and no explanation.
    const noSensorTimer = window.setTimeout(() => {
      if (!sawAbsoluteReading) setStatus('unavailable')
    }, 3000)

    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation)
      window.removeEventListener('deviceorientation', onOrientation)
      window.clearTimeout(noSensorTimer)
    }
  }, [status, alpha])

  return { heading, rawHeading, status, requestPermission }
}
