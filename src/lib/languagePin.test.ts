import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadLanguage, saveLanguage } from './language'

const LANGUAGE_KEY = 'sanctiwalk.language'

function setUrl(search: string) {
  window.history.replaceState({}, '', `/app${search}`)
}

beforeEach(() => {
  localStorage.clear()
  setUrl('')
})

afterEach(() => {
  localStorage.clear()
  setUrl('')
})

describe('?lang pins the language for the landing preview', () => {
  it('defaults to English with nothing stored and no parameter', () => {
    expect(loadLanguage()).toBe('en')
  })

  it('honours what the pilgrim chose, with no parameter', () => {
    saveLanguage('fil')
    expect(loadLanguage()).toBe('fil')
  })

  it('forces English for the demo even when Tagalog is stored', () => {
    // The actual bug: the landing page's iframe is same-origin, so a
    // visitor who had once set Tagalog saw the marketing demo in it.
    saveLanguage('fil')
    setUrl('?lang=en')
    expect(loadLanguage()).toBe('en')
  })

  it('does not rewrite the stored choice while pinning', () => {
    // The preview must not silently change the language of the
    // pilgrim's own app, which is the same storage.
    saveLanguage('fil')
    setUrl('?lang=en')
    loadLanguage()
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('fil')
  })

  it('can pin Tagalog too', () => {
    setUrl('?lang=fil')
    expect(loadLanguage()).toBe('fil')
  })

  it('ignores a value that is not a language', () => {
    saveLanguage('fil')
    setUrl('?lang=klingon')
    expect(loadLanguage()).toBe('fil')
  })

  it('ignores an empty parameter', () => {
    saveLanguage('fil')
    setUrl('?lang=')
    expect(loadLanguage()).toBe('fil')
  })

  it('finds it alongside other parameters', () => {
    saveLanguage('fil')
    setUrl('?utm=x&lang=en&ref=y')
    expect(loadLanguage()).toBe('en')
  })
})
