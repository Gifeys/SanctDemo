import { beforeEach, describe, expect, it } from 'vitest'

import {
  CONSENT_VERSION,
  clearConsent,
  needsConsent,
  readConsent,
  saveConsent,
} from './consent'

beforeEach(() => {
  localStorage.clear()
})

describe('first launch', () => {
  it('asks when nothing has been stored', () => {
    expect(needsConsent()).toBe(true)
  })

  it('does not ask once both have been given', () => {
    saveConsent(true, true)
    expect(needsConsent()).toBe(false)
  })

  it('still asks when only the terms were agreed', () => {
    // The two are separate acts; one does not stand in for the other.
    saveConsent(true, false)
    expect(needsConsent()).toBe(true)
  })

  it('still asks when only the privacy notice was acknowledged', () => {
    saveConsent(false, true)
    expect(needsConsent()).toBe(true)
  })
})

describe('what is recorded', () => {
  it('keeps the two answers apart', () => {
    saveConsent(true, false)
    const r = readConsent()
    expect(r?.terms).toBe(true)
    expect(r?.privacy).toBe(false)
  })

  it('records the version that was on screen', () => {
    saveConsent(true, true)
    expect(readConsent()?.version).toBe(CONSENT_VERSION)
  })

  it('records when it was given', () => {
    saveConsent(true, true)
    expect(Number.isFinite(Date.parse(readConsent()!.at))).toBe(true)
  })
})

describe('a materially changed document', () => {
  it('asks again when the stored version is older', () => {
    // The whole point of the version: what they accepted was a
    // different document.
    localStorage.setItem('sanctiwalk.consent.v1', JSON.stringify({
      version: CONSENT_VERSION - 1, terms: true, privacy: true, at: '2026-01-01T00:00:00Z',
    }))
    expect(needsConsent()).toBe(true)
  })

  it('asks again when the stored version is newer than this build', () => {
    // An older APK installed over a newer one. Asking is the safe
    // direction; silently honouring an acceptance of a document this
    // build does not contain is not.
    localStorage.setItem('sanctiwalk.consent.v1', JSON.stringify({
      version: CONSENT_VERSION + 1, terms: true, privacy: true, at: '2026-01-01T00:00:00Z',
    }))
    expect(needsConsent()).toBe(true)
  })
})

describe('storage that cannot be trusted', () => {
  it('asks again when the record is not JSON', () => {
    localStorage.setItem('sanctiwalk.consent.v1', 'not json at all')
    expect(needsConsent()).toBe(true)
  })

  it('asks again when the record is missing its version', () => {
    localStorage.setItem('sanctiwalk.consent.v1', JSON.stringify({ terms: true, privacy: true }))
    expect(needsConsent()).toBe(true)
  })

  it('treats a non-true value as not given', () => {
    localStorage.setItem('sanctiwalk.consent.v1', JSON.stringify({
      version: CONSENT_VERSION, terms: 'yes', privacy: 1, at: '',
    }))
    expect(needsConsent()).toBe(true)
  })

  it('reads back as null when the slot holds something else', () => {
    localStorage.setItem('sanctiwalk.consent.v1', JSON.stringify([1, 2, 3]))
    expect(readConsent()).toBeNull()
  })
})

describe('clearConsent', () => {
  it('sends the screen back', () => {
    saveConsent(true, true)
    clearConsent()
    expect(needsConsent()).toBe(true)
  })
})
