import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeviceHeading } from './useDeviceHeading'

function fireAbsolute(alpha: number, accuracy?: number) {
  const event: any = new Event('deviceorientationabsolute')
  event.absolute = true
  event.alpha = alpha
  if (accuracy !== undefined) event.webkitCompassAccuracy = accuracy
  window.dispatchEvent(event)
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
})
afterEach(() => vi.useRealTimers())

describe('compass availability', () => {
  // The bug this guards: after 3 seconds with no reading the hook set status
  // to 'unavailable', and because the listener effect keyed off status, that
  // ALSO removed the listeners. A magnetometer that took four seconds to
  // settle - routine indoors, and uncalibrated ones are slower - could never
  // recover. The compass stayed dead and the UI blamed missing hardware.
  it('recovers when a reading arrives after the no-sensor timeout', () => {
    const { result } = renderHook(() => useDeviceHeading())

    act(() => { vi.advanceTimersByTime(3500) })
    expect(result.current.status).toBe('unavailable')

    act(() => { fireAbsolute(90) })

    expect(result.current.status).toBe('granted')
    expect(result.current.rawHeading).not.toBeNull()
  })

  it('still reports unavailable while genuinely silent', () => {
    const { result } = renderHook(() => useDeviceHeading())
    act(() => { vi.advanceTimersByTime(3500) })
    expect(result.current.status).toBe('unavailable')
    expect(result.current.heading).toBeNull()
  })

  it('produces a bearing from alpha, counter-clockwise corrected', () => {
    const { result } = renderHook(() => useDeviceHeading())
    // alpha 90 counter-clockwise is a bearing of 270.
    act(() => { fireAbsolute(90) })
    expect(result.current.rawHeading).toBe(270)
  })

  it('flags an uncalibrated magnetometer when iOS reports -1', () => {
    const { result } = renderHook(() => useDeviceHeading())
    act(() => { fireAbsolute(10, -1) })
    expect(result.current.needsCalibration).toBe(true)
  })

  it('does not flag calibration when accuracy is good', () => {
    const { result } = renderHook(() => useDeviceHeading())
    act(() => { fireAbsolute(10, 5) })
    expect(result.current.accuracyDegrees).toBe(5)
    expect(result.current.needsCalibration).toBe(false)
  })
})
