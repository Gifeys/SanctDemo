import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import type { Language } from './language'

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

/** A shade under natural pace; the default rattles through a reflection. */
const RATE = 0.95

export async function speakAloud(text: string, language: Language): Promise<void> {
  const engine = currentEngine()
  if (engine === 'none' || !text.trim()) return

  if (engine === 'native') {
    // Stop first. The plugin queues otherwise, and the pilgrim waits out
    // the previous station before hearing this one.
    await stopAloud()
    await TextToSpeech.speak({
      text,
      lang: speechLocale(language),
      rate: RATE,
      // Read through the media channel so the phone's volume keys do
      // what the pilgrim expects while the tour is talking.
      category: 'playback',
    })
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocale(language)
  utterance.rate = RATE
  window.speechSynthesis.speak(utterance)
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
