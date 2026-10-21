import { describe, expect, it } from 'vitest'
import {
  classifyMassChange,
  massDiff,
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
    const a = massFingerprint([{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }])
    const b = massFingerprint([{ day: ' sunday ', time: ' 6:00 am, 9:00 AM ' }])
    expect(a).toBe(b)
  })

  it('changes when a time changes', () => {
    const a = massFingerprint([{ day: 'Sunday', time: '6:00 AM' }])
    const b = massFingerprint([{ day: 'Sunday', time: '6:30 AM' }])
    expect(a).not.toBe(b)
  })

  it('changes when a Mass is added or removed', () => {
    const one = massFingerprint([{ day: 'Sunday', time: '6:00 AM' }])
    const two = massFingerprint([
      { day: 'Sunday', time: '6:00 AM' },
      { day: 'Monday', time: '6:00 AM' },
    ])
    expect(one).not.toBe(two)
  })

  it('ignores a note, which is not a time', () => {
    const a = massFingerprint([{ day: 'Sunday', time: '6:00 AM', note: 'Tagalog' }])
    const b = massFingerprint([{ day: 'Sunday', time: '6:00 AM', note: 'English' }])
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

/**
 * The bug these exist for.
 *
 * massFingerprint declared `times?: string[]`, which nothing ever
 * supplied - the stored shape is `time`, a comma-separated string. So
 * the field was always undefined, every day hashed to "sunday|", and
 * the fingerprint encoded only the list of day names. Moving a Mass,
 * adding one, and suspending one all produced an identical fingerprint,
 * and no Mass-schedule notification was ever sent for any of them.
 *
 * Every case below fails against the old implementation.
 */
describe('the fingerprint sees what the parish actually changed', () => {
  it('notices a time moving', () => {
    const before = massFingerprint([{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }])
    const after = massFingerprint([{ day: 'Sunday', time: '6:30 AM, 9:00 AM' }])
    expect(before).not.toBe(after)
  })

  it('notices a Mass being added to a day', () => {
    const before = massFingerprint([{ day: 'Sunday', time: '6:00 AM' }])
    const after = massFingerprint([{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }])
    expect(before).not.toBe(after)
  })

  it('notices a Mass being suspended', () => {
    // The user's own case: Sunday 6:00 AM called off. `time` is
    // untouched, so only unavailableTimes can reveal it.
    const before = massFingerprint([{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }])
    const after = massFingerprint([
      { day: 'Sunday', time: '6:00 AM, 9:00 AM', unavailableTimes: ['6:00 AM'] },
    ])
    expect(before).not.toBe(after)
    expect(classifyMassChange(before, after)).toBe('updated')
  })

  it('notices a suspended Mass being restored', () => {
    const before = massFingerprint([
      { day: 'Sunday', time: '6:00 AM', unavailableTimes: ['6:00 AM'] },
    ])
    const after = massFingerprint([{ day: 'Sunday', time: '6:00 AM' }])
    expect(before).not.toBe(after)
  })

  it('still ignores whitespace and capitalisation', () => {
    const a = massFingerprint([{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }])
    const b = massFingerprint([{ day: ' sunday ', time: ' 6:00 am ,9:00 AM ' }])
    expect(a).toBe(b)
  })

  it('does not care what order the suspensions were listed in', () => {
    const a = massFingerprint([
      { day: 'Sunday', time: '6:00 AM, 9:00 AM', unavailableTimes: ['6:00 AM', '9:00 AM'] },
    ])
    const b = massFingerprint([
      { day: 'Sunday', time: '6:00 AM, 9:00 AM', unavailableTimes: ['9:00 AM', '6:00 AM'] },
    ])
    expect(a).toBe(b)
  })
})

describe('massDiff', () => {
  const fp = (unavailable: string[] = []) =>
    massFingerprint([
      { day: 'Sunday', time: '6:00 AM, 9:00 AM', unavailableTimes: unavailable },
    ])!

  it('names the Mass that was called off', () => {
    const moved = massDiff(fp(), fp(['6:00 AM']))
    expect(moved.suspended).toEqual([{ day: 'sunday', time: '6:00 am' }])
    expect(moved.restored).toEqual([])
  })

  it('names the Mass that came back', () => {
    const moved = massDiff(fp(['6:00 AM']), fp())
    expect(moved.restored).toEqual([{ day: 'sunday', time: '6:00 am' }])
    expect(moved.suspended).toEqual([])
  })

  it('finds several at once', () => {
    const moved = massDiff(fp(), fp(['6:00 AM', '9:00 AM']))
    expect(moved.suspended).toHaveLength(2)
  })

  it('says nothing when nothing moved', () => {
    const moved = massDiff(fp(['6:00 AM']), fp(['6:00 AM']))
    expect(moved.suspended).toEqual([])
    expect(moved.restored).toEqual([])
  })

  it('says nothing on a first run', () => {
    expect(massDiff(null, fp(['6:00 AM'])).suspended).toEqual([])
  })

  it('says nothing coming back from an unavailable schedule', () => {
    expect(massDiff('UNAVAILABLE', fp(['6:00 AM'])).suspended).toEqual([])
  })
})

describe('the notice names the Mass', () => {
  const fp = (unavailable: string[] = []) =>
    massFingerprint([
      { day: 'Sunday', time: '6:00 AM, 9:00 AM', unavailableTimes: unavailable },
    ])!

  it('says which Mass is off, and that the rest is unchanged', () => {
    const notice = massNotice('updated', 'Mary Help of Christians', massDiff(fp(), fp(['6:00 AM'])))
    expect(notice?.title).toBe('6:00 AM Sunday Mass is suspended')
    expect(notice?.body).toContain('Mary Help of Christians')
    expect(notice?.body).toContain('unchanged')
  })

  it('counts them when several go at once', () => {
    const notice = massNotice('updated', 'P', massDiff(fp(), fp(['6:00 AM', '9:00 AM'])))
    expect(notice?.title).toBe('2 Masses suspended')
  })

  it('says which Mass is back', () => {
    const notice = massNotice('updated', 'P', massDiff(fp(['6:00 AM']), fp()))
    expect(notice?.title).toBe('6:00 AM Sunday Mass is back')
  })

  it('falls back to the general wording when a time actually moved', () => {
    const before = massFingerprint([{ day: 'Sunday', time: '6:00 AM' }])
    const after = massFingerprint([{ day: 'Sunday', time: '6:30 AM' }])
    const notice = massNotice('updated', 'P', massDiff(before, after))
    expect(notice?.title).toBe('Mass schedule updated')
  })

  it('still works with no diff supplied at all', () => {
    expect(massNotice('updated', 'P')?.title).toBe('Mass schedule updated')
  })
})
