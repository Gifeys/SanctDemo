import { describe, expect, it } from 'vitest'
import {
  classifyMassChange,
  massFingerprint,
  massFingerprintKey,
  massNotice,
  nextStoredFingerprint,
} from './massScheduleWatch'

describe('massFingerprint', () => {
  it('is the same for the same times typed differently', () => {
    // An admin re-saving the page with different capitalisation or a
    // stray space has not moved a Mass, and telling everybody it has
    // is how people learn to ignore notifications.
    const a = massFingerprint([{ day: 'Sunday', times: ['6:00 AM', '9:00 AM'] }])
    const b = massFingerprint([{ day: ' sunday ', times: [' 6:00 am', '9:00 AM '] }])
    expect(a).toBe(b)
  })

  it('changes when a time changes', () => {
    const a = massFingerprint([{ day: 'Sunday', times: ['6:00 AM'] }])
    const b = massFingerprint([{ day: 'Sunday', times: ['6:30 AM'] }])
    expect(a).not.toBe(b)
  })

  it('changes when a Mass is added or removed', () => {
    const one = massFingerprint([{ day: 'Sunday', times: ['6:00 AM'] }])
    const two = massFingerprint([
      { day: 'Sunday', times: ['6:00 AM'] },
      { day: 'Monday', times: ['6:00 AM'] },
    ])
    expect(one).not.toBe(two)
  })

  it('ignores a note, which is not a time', () => {
    const a = massFingerprint([{ day: 'Sunday', times: ['6:00 AM'], note: 'Tagalog' }])
    const b = massFingerprint([{ day: 'Sunday', times: ['6:00 AM'], note: 'English' }])
    expect(a).toBe(b)
  })

  it('is null when there is no schedule at all', () => {
    // Distinct from an empty one: "nothing published" and "published
    // nothing" read the same to a fingerprint but not to a reader.
    expect(massFingerprint(null)).toBeNull()
    expect(massFingerprint(undefined)).toBeNull()
    expect(massFingerprint([])).toBeNull()
  })
})

describe('classifyMassChange', () => {
  const sun = 'sunday|6:00 am'
  const mon = 'monday|6:00 am'

  it('says nothing the first time it ever sees a schedule', () => {
    // A fresh install has no baseline. Announcing a change to somebody
    // who has never seen the times is untrue, and a bad first
    // impression of the app's notifications.
    expect(classifyMassChange(null, sun)).toBe('first-seen')
  })

  it('says nothing when the times are unchanged', () => {
    expect(classifyMassChange(sun, sun)).toBe('none')
  })

  it('reports a real change', () => {
    expect(classifyMassChange(sun, mon)).toBe('updated')
  })

  it('reports the schedule being taken down', () => {
    expect(classifyMassChange(sun, null)).toBe('unavailable')
  })

  it('reports it coming back, and does not call that an update', () => {
    // Coming back is good news; "the Mass times changed" would send
    // somebody looking for a change that did not happen.
    expect(classifyMassChange('UNAVAILABLE', sun)).toBe('restored')
  })

  it('stays quiet while it is still down', () => {
    // Without this the phone would repeat "unavailable" on every
    // snapshot for as long as the parish leaves it down.
    const stored = nextStoredFingerprint(null)
    expect(classifyMassChange(stored, null)).toBe('unavailable')
    // and the stored value does not change, so nothing new is said
    expect(nextStoredFingerprint(null)).toBe(stored)
  })

  it('has nothing to say when there has never been a schedule', () => {
    expect(classifyMassChange(null, null)).toBe('none')
  })
})

describe('massNotice', () => {
  it('names the parish, so the reader knows whose times moved', () => {
    const n = massNotice('updated', 'Mary Help of Christians Parish')
    expect(n?.title).toMatch(/updated/i)
    expect(n?.body).toContain('Mary Help of Christians Parish')
  })

  it('tells somebody what to do when the schedule is down', () => {
    const n = massNotice('unavailable', 'San Roque Cathedral Parish')
    expect(n?.body).toMatch(/parish office/i)
  })

  it('stays silent for the cases that are not news', () => {
    expect(massNotice('none', 'A')).toBeNull()
    expect(massNotice('first-seen', 'A')).toBeNull()
  })
})

describe('massFingerprintKey', () => {
  it('is per parish, so following two does not cross the streams', () => {
    expect(massFingerprintKey('route-mhcp')).not.toBe(massFingerprintKey('route-src'))
  })
})
