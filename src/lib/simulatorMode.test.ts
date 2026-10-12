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
    // Off is the state that leaves everything reachable. A default that
    // locked the AR tour would make a fresh install look broken to the
    // person testing it.
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
  const atParish = { simulatorMode: true, atParish: true, android: true }

  it('opens the AR tour anywhere while the simulator is off', () => {
    // Off means "unlocked for testing". This is the state the proponents
    // work in at home, where no parish is within ten kilometres.
    const a = arAccess({ simulatorMode: false, atParish: false, android: true })
    expect(a.allowed).toBe(true)
  })

  it('opens it at the parish while the simulator is on', () => {
    expect(arAccess(atParish).allowed).toBe(true)
  })

  it('holds it back away from the parish while the simulator is on', () => {
    const a = arAccess({ simulatorMode: true, atParish: false, android: true })
    expect(a.allowed).toBe(false)
    expect(a.reason).toBe('away')
  })

  it('says why, in words a visitor can act on', () => {
    const a = arAccess({ simulatorMode: true, atParish: false, android: true })
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
