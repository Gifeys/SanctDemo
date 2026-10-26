import { describe, expect, it, beforeEach } from 'vitest'
import {
  SIMULATOR_KEY,
  arAccess,
  loadSimulatorMode,
  saveSimulatorMode,
} from './simulatorMode'

beforeEach(() => localStorage.clear())

describe('the setting itself', () => {
  it('is off until somebody turns it on', () => {
    // Off is now the REAL behaviour, not the unlocked one. A fresh
    // install must behave the way a visitor's phone does.
    expect(loadSimulatorMode()).toBe(false)
  })

  it('remembers being turned on', () => {
    saveSimulatorMode(true)
    expect(loadSimulatorMode()).toBe(true)
    saveSimulatorMode(false)
    expect(loadSimulatorMode()).toBe(false)
  })

  it('survives a corrupted value rather than throwing', () => {
    localStorage.setItem(SIMULATOR_KEY, 'maybe')
    expect(loadSimulatorMode()).toBe(false)
  })
})

describe('arAccess', () => {
  const atParish = { simulatorMode: false, atParish: true, android: true }

  it('holds the AR Museum back away from the parish, by default', () => {
    // The behaviour every visitor gets. This used to pass only with
    // the testing switch ON, which is off by default - so the gate
    // never once ran for a real user.
    const a = arAccess({ simulatorMode: false, atParish: false, android: true })
    expect(a.allowed).toBe(false)
    expect(a.reason).toBe('away')
  })

  it('opens it at the parish', () => {
    expect(arAccess(atParish).allowed).toBe(true)
  })

  it('lifts the gate while testing mode is on', () => {
    // The proponents cannot be in the church every time they change
    // something, so the bypass stays - but it is now opt-in.
    const a = arAccess({ simulatorMode: true, atParish: false, android: true })
    expect(a.allowed).toBe(true)
  })

  it('says why, in words a visitor can act on', () => {
    const a = arAccess({ simulatorMode: false, atParish: false, android: true })
    expect(a.message).toMatch(/parish/i)
    // Not a bug report. The pilgrim has done nothing wrong.
    expect(a.message).not.toMatch(/error|failed|denied/i)
  })

  it('says nothing is wrong when it is allowed', () => {
    expect(arAccess(atParish).message).toBe('')
    expect(arAccess(atParish).reason).toBeNull()
  })

  it('turns the tour down on a device that cannot run it, whatever the mode', () => {
    // The companion app is an Android build. On an iPhone the answer is
    // the same standing in the nave as it is at home, and the simulator
    // cannot conjure an ARCore device.
    for (const simulatorMode of [true, false]) {
      const a = arAccess({ simulatorMode, atParish: true, android: false })
      expect(a.allowed).toBe(false)
      expect(a.reason).toBe('device')
    }
  })

  it('reports the device before the location', () => {
    // Telling an iPhone user to walk to the church would send them on a
    // journey that cannot help them.
    const a = arAccess({ simulatorMode: true, atParish: false, android: false })
    expect(a.reason).toBe('device')
  })
})
