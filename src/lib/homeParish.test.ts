import { beforeEach, describe, expect, it } from 'vitest'

import { HOME_PARISH_KEY, hasChosenHomeParish, loadHomeParishId, saveHomeParishId } from './homeParish'

const VALID = ['route-mhcp', 'route-src', 'parish-san-jose']

beforeEach(() => localStorage.clear())

describe('hasChosenHomeParish', () => {
  it('is false on a fresh install', () => {
    // The app seeds a default home parish, so "there is one" is true
    // from first launch. This has to mean something stronger: that
    // the pilgrim picked it.
    expect(hasChosenHomeParish(VALID)).toBe(false)
  })

  it('is true once a parish has been chosen', () => {
    saveHomeParishId('route-src')
    expect(hasChosenHomeParish(VALID)).toBe(true)
  })

  it('is false when the stored parish no longer exists', () => {
    // Diocese data changed under a stale entry. Treating that as a
    // live choice would pin home to a parish that is not there.
    saveHomeParishId('parish-that-closed')
    expect(hasChosenHomeParish(VALID)).toBe(false)
  })

  it('is false when the stored value is corrupt', () => {
    localStorage.setItem(HOME_PARISH_KEY, '{not json')
    expect(hasChosenHomeParish(VALID)).toBe(false)
  })

  it('agrees with loadHomeParishId', () => {
    // The two must not disagree: one decides where home is and the
    // other decides whether to believe it.
    expect(hasChosenHomeParish(VALID)).toBe(loadHomeParishId(VALID) !== null)
    saveHomeParishId('route-mhcp')
    expect(hasChosenHomeParish(VALID)).toBe(loadHomeParishId(VALID) !== null)
  })
})
