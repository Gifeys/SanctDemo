import { describe, expect, it } from 'vitest'

import { isFallback, localeChain, pickLocale } from './speechLocales'

describe('pickLocale', () => {
  it('takes Filipino when the device has it', () => {
    expect(pickLocale('fil', ['en-US', 'fil-PH'])).toBe('fil-PH')
  })

  it('accepts tl-PH, which is the same language under another tag', () => {
    // Which tag a device reports is not predictable, and treating them
    // as different tells a handset that HAS the voice that it does not.
    expect(pickLocale('fil', ['en-US', 'tl-PH'])).toBe('tl-PH')
  })

  it('matches a bare tag against a regional one', () => {
    expect(pickLocale('fil', ['fil'])).toBe('fil')
  })

  it('ignores the separator a device happens to use', () => {
    expect(pickLocale('fil', ['fil_PH'])).toBe('fil_PH')
  })

  it('falls back to Philippine English before American', () => {
    // A Philippine English voice says Caloocan and Baclaran far closer
    // to right than an American one.
    expect(pickLocale('fil', ['en-US', 'en-PH'])).toBe('en-PH')
  })

  it('falls back rather than giving up', () => {
    expect(pickLocale('fil', ['en-US'])).toBe('en-US')
  })

  it('returns null when the device lists nothing usable', () => {
    // So the caller can say the voice is missing instead of reading
    // Tagalog in a Japanese one.
    expect(pickLocale('fil', ['ja-JP', 'de-DE'])).toBeNull()
  })

  it('survives an empty list', () => {
    expect(pickLocale('en', [])).toBeNull()
  })

  it('prefers Philippine English for English too', () => {
    expect(pickLocale('en', ['en-US', 'en-PH'])).toBe('en-PH')
  })
})

describe('isFallback', () => {
  it('is false when Filipino was actually found', () => {
    expect(isFallback('fil', 'fil-PH')).toBe(false)
    expect(isFallback('fil', 'tl-PH')).toBe(false)
  })

  it('is true when Tagalog will be read by an English voice', () => {
    // The thing the pilgrim needs told, because otherwise it just
    // sounds broken.
    expect(isFallback('fil', 'en-US')).toBe(true)
  })

  it('is true when there is no voice at all', () => {
    expect(isFallback('fil', null)).toBe(true)
  })

  it('is false for English asked and English given', () => {
    expect(isFallback('en', 'en-US')).toBe(false)
  })
})

describe('localeChain', () => {
  it('always offers something', () => {
    for (const lang of ['fil', 'en'] as const) {
      expect(localeChain(lang).length).toBeGreaterThan(0)
    }
  })

  it('asks for Filipino first for Filipino', () => {
    expect(localeChain('fil')[0]).toBe('fil-PH')
  })
})
