import { describe, it, expect } from 'vitest'
import { isDeviceSurface, DEVICE_WIDTH_BREAKPOINT } from './displayMode'

describe('isDeviceSurface', () => {
  it('treats the installed Android app as a device however wide it reports', () => {
    // A tablet or a phone in landscape can report more than the breakpoint.
    // Native is native: there is no desk to present the app on.
    expect(isDeviceSurface(true, 1280)).toBe(true)
  })

  it('treats a narrow browser as a device, so a phone browser gets no mockup', () => {
    expect(isDeviceSurface(false, 390)).toBe(true)
  })

  it('keeps the desktop presentation frame on a laptop', () => {
    // This is the capstone defense view, and losing it would be a
    // regression in the other direction.
    expect(isDeviceSurface(false, 1440)).toBe(false)
  })

  it('includes the breakpoint itself, and excludes one pixel past it', () => {
    expect(isDeviceSurface(false, DEVICE_WIDTH_BREAKPOINT)).toBe(true)
    expect(isDeviceSurface(false, DEVICE_WIDTH_BREAKPOINT + 1)).toBe(false)
  })
})
