/**
 * Simulator mode, and who may open the AR tour.
 *
 * ## What the switch is for
 *
 * The AR tour is only meaningful inside a parish: it stands the parish's
 * own statues where they really are, read off a scan of that building.
 * Opened anywhere else it has nothing to anchor to, so for a visitor it
 * should say "this works at the parish" rather than opening onto an
 * empty room.
 *
 * But the proponents cannot be in the church every time they change
 * something, and a gate they cannot pass at home would mean no testing
 * at all. So it is a switch.
 *
 *   OFF - everything is reachable from anywhere. This is the testing
 *         state, and it is the default, because a default that locked
 *         the tour would make a fresh install look broken.
 *
 *   ON  - the app behaves as it will for a visitor: the AR tour opens
 *         only at the parish, and the AI scanner still works anywhere.
 *
 * The names are the other way round from the usual sense of
 * "simulator", so nothing here relies on the name: the setting screen
 * spells out what each position does, and so does the notice the
 * scanner shows.
 */

export const SIMULATOR_KEY = 'sanctiwalk.simulatorMode'

/** Fired when the setting changes, for the hooks in this tab. */
export const SIMULATOR_EVENT = 'sanctiwalk:simulator'

export function loadSimulatorMode(): boolean {
  try {
    return localStorage.getItem(SIMULATOR_KEY) === 'on'
  } catch {
    // Private mode. Off is the state that leaves everything reachable.
    return false
  }
}

export function saveSimulatorMode(on: boolean): void {
  try {
    localStorage.setItem(SIMULATOR_KEY, on ? 'on' : 'off')
  } catch {
    // The choice still holds for this run, through the event below.
  }
  try {
    window.dispatchEvent(new CustomEvent(SIMULATOR_EVENT, { detail: on }))
  } catch {
    /* ignore */
  }
}

export type ArBlockedReason = 'device' | 'away'

export interface ArAccess {
  allowed: boolean
  reason: ArBlockedReason | null
  /** What to tell the visitor. Empty when they may go ahead. */
  message: string
}

export interface ArConditions {
  simulatorMode: boolean
  /** True when presence says the pilgrim is inside a parish's geofence. */
  atParish: boolean
  /** True on a handset that can run the companion AR application. */
  android: boolean
}

/**
 * Whether the AR tour may be opened, and what to say when it may not.
 *
 * The device is checked before the location. Telling somebody on an
 * iPhone to walk to the church would send them on a journey that cannot
 * help them when they arrive.
 */
export function arAccess({ simulatorMode, atParish, android }: ArConditions): ArAccess {
  if (!android) {
    return {
      allowed: false,
      reason: 'device',
      message:
        'The AR tour runs on an Android phone. Everything else in '
        + 'SanctiWalk works here, including the scanner.',
    }
  }

  if (simulatorMode && !atParish) {
    return {
      allowed: false,
      reason: 'away',
      message:
        'The AR tour opens inside the parish. It places the parish’s '
        + 'own statues where they really stand, so it needs you to be '
        + 'there. The scanner below works anywhere.',
    }
  }

  return { allowed: true, reason: null, message: '' }
}
