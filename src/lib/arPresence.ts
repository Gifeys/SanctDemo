import { ROUTES } from '../data'
import type { GpsStatus } from '../context/PresenceContext'

/**
 * Whether the AR museum can be opened from where the pilgrim is.
 *
 * ## Why this gate exists
 *
 * The AR museum anchors content to real places inside a specific
 * church. Away from the building there is no marker to find and no
 * geometry to anchor to, so it opens the camera, finds nothing, and
 * looks broken. People then report the AR as broken when it is working
 * exactly as designed - they are simply not in the room.
 *
 * ## Why an unknown location lets you through
 *
 * Decided with the parish. A denied, lost or still-searching fix is
 * indistinguishable from being far away, and a cold GPS inside a stone
 * church routinely takes tens of seconds - which is precisely when
 * somebody opens the app. Refusing then would strand a pilgrim standing
 * at the altar with no way to proceed and nothing to do about it.
 *
 * So the rule is: block only when the app positively knows you are
 * elsewhere. When it does not know, warn and allow.
 */
export interface ArSiteState {
  /** Whether the button may be pressed. */
  canOpen: boolean
  /** Whether to show the caution, which is about doubt, not refusal. */
  warn: boolean
  /** What to tell them, in every case. */
  reason: string
}

export interface ArSiteInput {
  gpsStatus: GpsStatus
  /** The parish the pilgrim is standing in, from presence. */
  hereParishId: string | null
  /** The parish whose tour they are trying to open. */
  tourParishId: string
}

function nameOf(parishId: string): string {
  return ROUTES.find(r => r.id === parishId)?.name ?? 'the parish'
}

export function arSiteReadiness({
  gpsStatus,
  hereParishId,
  tourParishId,
}: ArSiteInput): ArSiteState {
  const there = nameOf(tourParishId)

  if (hereParishId === tourParishId) {
    return {
      canOpen: true,
      warn: false,
      reason: `You are at ${there}. The tour is ready.`,
    }
  }

  // Only a fix we actually have can say someone is elsewhere.
  if (gpsStatus === 'granted') {
    return {
      canOpen: false,
      warn: true,
      reason: hereParishId
        ? `This tour runs at ${there}. You are at ${nameOf(hereParishId)}, so there is nothing here for it to find.`
        : `This tour only works inside ${there}. Open it again when you are there.`,
    }
  }

  return {
    canOpen: true,
    warn: true,
    reason:
      gpsStatus === 'denied'
        ? `SanctiWalk cannot check where you are, so this is left open. It only works inside ${there}.`
        : `Still finding your location. This tour only works inside ${there}.`,
  }
}
