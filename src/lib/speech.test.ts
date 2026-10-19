import { describe, expect, it } from 'vitest'
import { canSpeak, chooseEngine, speechLocale, voiceFor, webSpeechUsable } from './speech'

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

describe('voiceFor', () => {
  const win = (voices: Array<{ name: string; lang: string }>) =>
    ({ speechSynthesis: { getVoices: () => voices } }) as unknown as Window

  it('picks a Filipino voice when the device has one', () => {
    const w = win([
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Blessica', lang: 'fil-PH' },
    ])
    expect(voiceFor('fil', w)?.name).toBe('Blessica')
  })

  it('accepts tl as the same language as fil', () => {
    // Engines disagree about which tag to publish for Filipino.
    const w = win([{ name: 'Tagalog voice', lang: 'tl-PH' }])
    expect(voiceFor('fil', w)?.name).toBe('Tagalog voice')
  })

  it('returns null rather than handing back an English voice', () => {
    // The bug this exists to stop: utterance.lang is only a request, so
    // an engine with no Filipino voice reads Tagalog in English and says
    // nothing about it.
    const w = win([{ name: 'Microsoft David', lang: 'en-US' }])
    expect(voiceFor('fil', w)).toBeNull()
  })

  it('prefers the Philippine regional voice over another Filipino one', () => {
    const w = win([
      { name: 'Generic Filipino', lang: 'fil' },
      { name: 'Blessica', lang: 'fil-PH' },
    ])
    expect(voiceFor('fil', w)?.name).toBe('Blessica')
  })

  it('tolerates an underscore tag', () => {
    const w = win([{ name: 'Blessica', lang: 'fil_PH' }])
    expect(voiceFor('fil', w)?.name).toBe('Blessica')
  })

  it('survives a browser with no speech at all', () => {
    expect(voiceFor('fil', {} as Window)).toBeNull()
    expect(voiceFor('fil', undefined)).toBeNull()
  })
})

describe('canSpeak', () => {
  it('is false when the device cannot actually speak Filipino', () => {
    const w = { speechSynthesis: { getVoices: () => [{ name: 'David', lang: 'en-US' }] } } as unknown as Window
    expect(canSpeak('fil', w)).toBe(false)
    expect(canSpeak('en', w)).toBe(true)
  })
})
