import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import type { Language } from './language'
import { isFallback, pickLocale } from './speechLocales'

/**
 * Reading a station aloud, on a phone as well as in a browser.
 *
 * ## The bug this exists to fix
 *
 * Narration was `window.speechSynthesis` and nothing else. That works
 * in Chrome and is silent in the installed app, because Capacitor runs
 * the app inside Android System WebView, which has never implemented
 * the Web Speech API - a gap open in Chromium's tracker for years.
 *
 * The failure was the bad kind. WebView exposes `speechSynthesis` as a
 * stub often enough that `"speechSynthesis" in window` returns true, so
 * the app offered a narration button, the pilgrim pressed it, and
 * nothing happened. An audio tour guide that is silent on the phone it
 * was installed on, while appearing to work, is worse than one that
 * says it cannot speak here.
 *
 * ## What it does instead
 *
 * Inside the installed app it speaks through Android's own
 * text-to-speech engine, which is what every other Android application
 * uses and which works without a network once a voice is installed. In
 * a browser it keeps using Web Speech. Where neither can make a sound
 * it reports itself unavailable, and the narration button goes away
 * rather than lying.
 */

export type Engine = 'native' | 'web' | 'none'

/**
 * The voice to ask for.
 *
 * `fil-PH` rather than a bare `fil`: Android matches voices by full
 * BCP-47 tag, and the Filipino voice on a Philippine handset is
 * registered against the region.
 */
export function speechLocale(language: Language): string {
  return language === 'fil' ? 'fil-PH' : 'en-US'
}

/**
 * Whether the browser's own speech can actually be heard.
 *
 * Presence of the object is not the test - that is exactly what WebView
 * gets wrong. An engine with no voices speaks nothing, so an empty
 * voice list counts as unusable.
 */
export function webSpeechUsable(win: Window | undefined): boolean {
  const synth = (win as (Window & { speechSynthesis?: SpeechSynthesis }) | undefined)
    ?.speechSynthesis
  if (!synth || typeof synth.getVoices !== 'function') return false
  try {
    return synth.getVoices().length > 0
  } catch {
    return false
  }
}

/** Which engine to use. Native wins on a phone; it is the only one there. */
export function chooseEngine(
  { native, webUsable }: { native: boolean; webUsable: boolean },
): Engine {
  if (native) return 'native'
  return webUsable ? 'web' : 'none'
}

/** True inside the installed Android or iOS app, false in a browser. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * The engine for this run.
 *
 * Voices arrive asynchronously in some browsers, so this is read at the
 * point of speaking rather than cached at module load - a cached "none"
 * taken before the voice list populated would silence the web build for
 * the whole session.
 */
export function currentEngine(): Engine {
  return chooseEngine({
    native: isNativeApp(),
    webUsable: typeof window !== 'undefined' && webSpeechUsable(window),
  })
}

/**
 * The installed voice that actually speaks this language, or null.
 *
 * ## Why setting `lang` is not enough
 *
 * `utterance.lang` is a REQUEST. When no installed voice matches it the
 * engine does not fail and does not fall silent - it reads the text in
 * whatever its default voice is, which on almost every machine is
 * English. So Tagalog prayers came out in an English voice, pronounced
 * as though they were English words, with nothing anywhere saying why.
 *
 * Picking the voice object explicitly is the only way to be sure, and
 * returning null when there is none is what lets the caller say so
 * instead of quietly doing the wrong thing.
 *
 * Filipino is matched on both `fil` and `tl`: the two tags are the same
 * language and engines disagree about which to publish.
 */
export function voiceFor(
  language: Language,
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
): SpeechSynthesisVoice | null {
  const synth = (win as (Window & { speechSynthesis?: SpeechSynthesis }) | undefined)?.speechSynthesis
  if (!synth || typeof synth.getVoices !== 'function') return null

  let voices: SpeechSynthesisVoice[]
  try {
    voices = synth.getVoices()
  } catch {
    return null
  }
  if (!voices || voices.length === 0) return null

  const wanted = language === 'fil' ? /^(fil|tl)\b/i : /^en\b/i
  const tagOf = (v: SpeechSynthesisVoice) => (v.lang ?? '').replace('_', '-')

  // An exact regional match first, then the bare language. A Philippine
  // Filipino voice is preferred over any other Filipino voice, but any
  // Filipino voice beats falling back to English.
  const exact = language === 'fil' ? 'fil-ph' : 'en-us'
  return (
    voices.find(v => tagOf(v).toLowerCase() === exact) ??
    voices.find(v => wanted.test(tagOf(v))) ??
    null
  )
}

/**
 * Whether this device can actually speak this language.
 *
 * The UI uses it to tell somebody their phone has no Filipino voice
 * rather than reading Tagalog to them in English and leaving them to
 * work out what went wrong.
 */
export function canSpeak(
  language: Language,
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  if (isNativeApp()) return true // the device engine decides; asked at speak time
  return voiceFor(language, win) !== null
}

/** A shade under natural pace; the default rattles through a reflection. */
const RATE = 0.95

/**
 * What the handset's text-to-speech actually offers, asked once.
 *
 * getSupportedLanguages is a round trip to the platform, and the
 * answer does not change while the app is running.
 */
let deviceLocales: string[] | null = null

async function supportedLocales(): Promise<string[]> {
  if (deviceLocales) return deviceLocales
  try {
    const { languages } = await TextToSpeech.getSupportedLanguages()
    deviceLocales = Array.isArray(languages) ? languages : []
  } catch {
    deviceLocales = []
  }
  // eslint-disable-next-line no-console
  console.log('SW-TTS device locales:', deviceLocales.length)
  return deviceLocales
}

/**
 * Whether the last thing spoken had to fall back to another language.
 *
 * Read by the UI so it can say "no Filipino voice on this phone"
 * rather than leaving somebody wondering why the Tagalog history is
 * being read in English.
 */
export let lastSpokenWasFallback = false

export async function speakAloud(text: string, language: Language): Promise<void> {
  const engine = currentEngine()
  if (engine === 'none' || !text.trim()) return

  if (engine === 'native') {
    // Stop first. The plugin queues otherwise, and the pilgrim waits out
    // the previous station before hearing this one.
    await stopAloud()

    // Ask for a locale the device HAS. Requesting fil-PH on a handset
    // without the Filipino voice does not fail - it reads Tagalog in
    // an English voice, which is how this looked like it was ignoring
    // the language setting.
    const available = await supportedLocales()
    const chosen = pickLocale(language, available) ?? speechLocale(language)
    lastSpokenWasFallback = isFallback(language, pickLocale(language, available))

    // eslint-disable-next-line no-console
    console.log('SW-TTS speaking in', chosen, 'wanted', language,
      'fallback:', lastSpokenWasFallback)

    try {
      await TextToSpeech.speak({
        text,
        lang: chosen,
        rate: RATE,
        // Read through the media channel so the phone's volume keys do
        // what the pilgrim expects while the tour is talking.
        category: 'playback',
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('SW-TTS speak FAILED:', (error as Error)?.message ?? String(error))
      throw error
    }
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocale(language)
  // The voice object, not only the tag. Without this the engine reads
  // Tagalog in whatever its default voice is, which is English.
  const picked = voiceFor(language)
  if (picked) utterance.voice = picked
  utterance.rate = RATE

  // Resolve when the voice actually stops, not when it starts.
  //
  // `speechSynthesis.speak` is fire-and-forget: it returns the instant
  // the utterance is queued. Callers await this to know when to put a
  // speaker button back to "play", so returning early told them the
  // reading had finished before a word of it was spoken - the button
  // flipped straight back and a second tap started a second voice over
  // the first instead of stopping it. The native branch above already
  // resolves on completion; this makes the web branch keep the same
  // promise.
  //
  // `cancel()` fires `end` too, so stopping resolves this as well.
  await new Promise<void>(resolve => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    utterance.onend = done
    // An engine that fails mid-sentence must not leave the caller
    // waiting forever on a promise that will never settle.
    utterance.onerror = done
    window.speechSynthesis.speak(utterance)
  })
}

export async function stopAloud(): Promise<void> {
  if (isNativeApp()) {
    try {
      await TextToSpeech.stop()
    } catch {
      // Nothing was speaking. Stopping silence is not an error.
    }
    return
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
