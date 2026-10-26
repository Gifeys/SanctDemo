/**
 * Keeping Android's recogniser alive for as long as somebody is praying.
 *
 * ## The problem
 *
 * Android's SpeechRecognizer is built around one utterance. It listens,
 * detects the end of speech, delivers a result and stops. The Rosary is
 * not one utterance - it is twenty minutes of praying with a pause
 * between every Hail Mary - so a recogniser started once hears the
 * first phrase and is deaf for the rest of the decade.
 *
 * That is why the Rosary followed the voice on a laptop and not on the
 * phone. Desktop Chrome's SpeechRecognition has `continuous`, which
 * restarts itself; the Android plugin has no such flag, so the restart
 * has to be done by the caller.
 *
 * ## Why a policy and not just a loop
 *
 * A bare "restart whenever it stops" is a tight loop the moment the
 * recogniser cannot start at all - no network for the recognition
 * service, the microphone taken by a call - and that loop runs the
 * battery down in a pocket with nothing on screen to show for it. So
 * restarts are counted, spaced, and eventually given up on.
 *
 * Pure, so the policy can be tested without a microphone.
 */

/** Restarts that happen immediately, before any backoff. */
export const FREE_RESTARTS = 3

/** How long to wait after that, growing with each failure. */
export const BACKOFF_MS = [400, 1200, 3000] as const

/**
 * Give up after this many restarts with nothing heard.
 *
 * Reached only when the recogniser is failing rather than simply
 * hearing silence: a successful result resets the count, so praying
 * slowly never exhausts it.
 */
export const MAX_RESTARTS = 12

export interface RestartState {
  /** Restarts since the last thing actually heard. */
  attempts: number
  /** Whether the pilgrim still wants it listening. */
  wanted: boolean
}

export const IDLE: RestartState = { attempts: 0, wanted: false }

/** What to do now that the recogniser has stopped. */
export interface RestartPlan {
  restart: boolean
  delayMs: number
  /** Set when restarting has been abandoned, for the message shown. */
  giveUp: boolean
}

export function planRestart(state: RestartState): RestartPlan {
  if (!state.wanted) return { restart: false, delayMs: 0, giveUp: false }
  if (state.attempts >= MAX_RESTARTS) return { restart: false, delayMs: 0, giveUp: true }

  if (state.attempts < FREE_RESTARTS) {
    // Straight back in. A pause between prayers is the normal case and
    // must not be felt as a gap.
    return { restart: true, delayMs: 0, giveUp: false }
  }

  const step = Math.min(state.attempts - FREE_RESTARTS, BACKOFF_MS.length - 1)
  return { restart: true, delayMs: BACKOFF_MS[step], giveUp: false }
}

/** One more restart attempted. */
export function afterRestart(state: RestartState): RestartState {
  return { ...state, attempts: state.attempts + 1 }
}

/**
 * Something was actually heard, so the recogniser is working.
 *
 * Resets the count: a pilgrim praying a full Rosary restarts the
 * recogniser dozens of times quite normally, and must never be cut off
 * for it.
 */
export function afterHeard(state: RestartState): RestartState {
  return { ...state, attempts: 0 }
}

/**
 * The locale to try, falling back when the device has not got it.
 *
 * Filipino recognition is not installed on every Android handset. The
 * old code asked for fil-PH, the start call threw, and the whole
 * feature reported itself unavailable - so a Tagalog Rosary silently
 * lost its voice following on any phone without the language pack,
 * rather than listening in a language it does have.
 */
export function listenLocales(language: 'fil' | 'en'): string[] {
  return language === 'fil' ? ['fil-PH', 'tl-PH', 'en-PH', 'en-US'] : ['en-PH', 'en-US']
}
