import { describe, expect, it } from 'vitest'
import { chooseEngine, speechLocale, webSpeechUsable } from './speech'

describe('speechLocale', () => {
  it('asks for a Philippine Filipino voice, not a generic one', () => {
    expect(speechLocale('fil')).toBe('fil-PH')
  })

  it('asks for English', () => {
    expect(speechLocale('en')).toBe('en-US')
  })
})

describe('webSpeechUsable', () => {
  it('is false when the browser has no speech synthesis at all', () => {
    expect(webSpeechUsable({} as Window)).toBe(false)
  })

  it('is false when speechSynthesis exists but has no voices', () => {
    // This is the Android WebView case, and it is the whole reason this
    // function exists. The object is present, so a plain `in` check
    // reports the feature as supported; nothing is ever spoken. A
    // narration button that looks enabled and makes no sound is worse
    // than one that is visibly unavailable.
    const win = { speechSynthesis: { getVoices: () => [] } } as unknown as Window
    expect(webSpeechUsable(win)).toBe(false)
  })

  it('is true when voices are actually installed', () => {
    const win = {
      speechSynthesis: { getVoices: () => [{ name: 'Default' }] },
    } as unknown as Window
    expect(webSpeechUsable(win)).toBe(true)
  })

  it('survives a getVoices that throws', () => {
    const win = {
      speechSynthesis: { getVoices: () => { throw new Error('nope') } },
    } as unknown as Window
    expect(webSpeechUsable(win)).toBe(false)
  })
})

describe('chooseEngine', () => {
  it('uses the phone\'s own voice inside the installed app', () => {
    // Capacitor runs the app in an Android WebView, which has no usable
    // Web Speech. The native engine is not a fallback there - it is the
    // only thing that makes a sound.
    expect(chooseEngine({ native: true, webUsable: false })).toBe('native')
    expect(chooseEngine({ native: true, webUsable: true })).toBe('native')
  })

  it('uses the browser voice on the web', () => {
    expect(chooseEngine({ native: false, webUsable: true })).toBe('web')
  })

  it('reports no engine rather than pretending', () => {
    // Narration must then present itself as unavailable, so nobody taps
    // a button expecting sound.
    expect(chooseEngine({ native: false, webUsable: false })).toBe('none')
  })
})
