/**
 * Telling somebody their parish changed the Mass times.
 *
 * ## Why a notification at all
 *
 * The Mass schedule is the one thing in the app a person acts on
 * physically: they read it, and then they leave the house at a
 * particular time. When the parish moves a Mass, anyone who checked
 * last week is now wrong, and nothing in an app they are not looking
 * at will tell them. So the phone does.
 *
 * ## The two cases, and why they read differently
 *
 * Updated - the times changed. That is news the reader must act on.
 *
 * Unavailable - the parish has taken the schedule down, or has not
 * published one. That is also worth saying, because the alternative is
 * a person opening the app on Sunday morning, finding nothing, and not
 * knowing whether the app is broken or the parish simply has not said.
 *
 * ## Why a fingerprint rather than a timestamp
 *
 * An admin saving the page without changing a time bumps updatedAt,
 * and a notification for "the Mass times changed" when they have not
 * is how people learn to ignore notifications. The fingerprint is of
 * the times themselves, so only a real change speaks.
 *
 * Pure and dependency-free so the rules can be tested without a
 * device, a network or a Firestore.
 */

export interface MassEntryLike {
  day?: string
  times?: string[]
  note?: string
}

export type MassChange = 'none' | 'first-seen' | 'updated' | 'unavailable' | 'restored'

/** Where the last-seen schedule is remembered, per parish. */
export function massFingerprintKey(parishId: string): string {
  return `sanctiwalk.massSeen.${parishId}`
}

/**
 * A stable summary of the schedule's content.
 *
 * Only the day and the times, in order, lowercased and trimmed:
 * whitespace and capitalisation are the admin's typing, not a change
 * to when Mass is. Returns null when there is no schedule at all,
 * which is a different thing from an empty one.
 */
export function massFingerprint(schedule: MassEntryLike[] | null | undefined): string | null {
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  const parts = schedule.map(e => {
    const day = (e.day ?? '').trim().toLowerCase()
    const times = (e.times ?? []).map(t => t.trim().toLowerCase()).join(',')
    return `${day}|${times}`
  })
  return parts.join(';')
}

/**
 * What happened between the schedule last seen and the one now.
 *
 * `first-seen` is deliberately not a notification. A fresh install has
 * no baseline, and announcing "the Mass times changed" to somebody who
 * has never seen them is both untrue and the worst possible first
 * impression of the app's notifications.
 */
export function classifyMassChange(
  previous: string | null,
  current: string | null,
): MassChange {
  if (previous === null && current === null) return 'none'
  if (previous === null) return 'first-seen'
  if (current === null) return 'unavailable'
  if (previous === 'UNAVAILABLE') return 'restored'
  return previous === current ? 'none' : 'updated'
}

/** What gets stored, given what just happened. */
export function nextStoredFingerprint(current: string | null): string {
  return current === null ? 'UNAVAILABLE' : current
}

export interface MassNotice {
  title: string
  body: string
}

/** The words for a change, or null when there is nothing to say. */
export function massNotice(change: MassChange, parishName: string): MassNotice | null {
  switch (change) {
    case 'updated':
      return {
        title: 'Mass schedule updated',
        body: `${parishName} has changed its Mass times. Open SanctiWalk to see the new schedule.`,
      }
    case 'unavailable':
      return {
        title: 'Mass schedule unavailable',
        body: `${parishName} has taken its Mass schedule down. Contact the parish office for times.`,
      }
    case 'restored':
      return {
        title: 'Mass schedule is back',
        body: `${parishName} has published its Mass times again.`,
      }
    default:
      return null
  }
}
