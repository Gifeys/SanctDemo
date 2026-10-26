/**
 * Testing mode, and who may open the AR Museum.
 *
 * ## The gate
 *
 * The AR Museum is only meaningful inside a parish: it stands that
 * parish's own statues where they really are, read off a scan of the
 * building. Opened anywhere else it has nothing to anchor to, so it
 * shows a camera that finds nothing - which people reasonably report
 * as the AR being broken.
 *
 * So the location gate is the NORMAL behaviour, on for everyone.
 *
 * ## Why this changed
 *
 * It used to read `if (simulatorMode && !atParish)`, which meant the
 * gate only applied when a testing switch was turned on - and that
 * switch is off by default. So no visitor was ever stopped. The gate
 * existed, was tested, and never once ran for a real user.
 *
 * ## The switch now
 *
 * The proponents cannot be in the church every time they change
 * something, so the switch remains, as an explicit bypass:
 *
 *   OFF - the real behaviour, and the default. The AR Museum opens
 *         only at its own parish. Sancti Scan still works anywhere.
 *
 *   ON  - the location gate is lifted, for testing away from the
 *         churches.
 *
 * This is the opposite sense from before. The setting screen spells out
 * what each position does rather than relying on the name, which is why
 * the inversion is safe to make.
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

  // The gate, for everyone, unless testing has explicitly lifted it.
  if (!atParish && !simulatorMode) {
    return {
      allowed: false,
      reason: 'away',
      message:
        'The AR Museum opens inside the parish. It places the parish’s '
        + 'own statues where they really stand, so it needs you to be '
        + 'there. Sancti Scan below works anywhere.',
    }
  }

  return { allowed: true, reason: null, message: '' }
}
