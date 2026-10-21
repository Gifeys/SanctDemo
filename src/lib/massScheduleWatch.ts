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

/**
 * One day of the stored schedule.
 *
 * `time` is a COMMA-SEPARATED STRING, not an array, because that is
 * what MassScheduleEntry in lib/schedule actually holds and what the
 * admin writes to Firestore.
 *
 * This type used to declare `times?: string[]`, which no caller ever
 * supplied. The field was therefore always undefined, every day
 * fingerprinted as "sunday|", and the fingerprint encoded nothing but
 * the LIST OF DAY NAMES - so moving a Mass, adding one, or suspending
 * one all produced an identical fingerprint and no notification was
 * ever sent for any of them. The tests passed because they were
 * written against this same wrong shape.
 */
export interface MassEntryLike {
  day?: string
  /** "6:00 AM, 9:00 AM" */
  time?: string
  /** Times the parish has suspended. Exact matches against `time`. */
  unavailableTimes?: string[]
  note?: string
}

/** Splits a stored "6:00 AM, 9:00 AM" into its parts, normalised. */
function partsOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
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
    const times = partsOf(e.time).join(',')
    // Suspensions belong in the fingerprint. A parish calling off this
    // Sunday's 6:00 AM has not changed a single time in `time`, so
    // without this the schedule looks untouched and the one person who
    // most needs telling - the one who goes at six - is told nothing.
    const off = (e.unavailableTimes ?? [])
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(',')
    return `${day}|${times}|${off}`
  })
  return parts.join(';')
}

/** One suspended or restored Mass, for the wording below. */
export interface MassMoved {
  day: string
  time: string
}

/**
 * Which Masses were called off, and which came back.
 *
 * Read back out of the two fingerprints rather than the schedules
 * themselves, because the fingerprint is the only thing kept between
 * runs. That is also why its shape above is parseable.
 */
export function massDiff(
  previous: string | null,
  current: string | null,
): { suspended: MassMoved[]; restored: MassMoved[] } {
  const none = { suspended: [], restored: [] }
  if (!previous || !current || previous === 'UNAVAILABLE') return none

  const read = (fp: string): Map<string, Set<string>> => {
    const map = new Map<string, Set<string>>()
    for (const part of fp.split(';')) {
      const [day = '', , off = ''] = part.split('|')
      map.set(day, new Set(off.split(',').filter(Boolean)))
    }
    return map
  }

  const before = read(previous)
  const after = read(current)

  const suspended: MassMoved[] = []
  const restored: MassMoved[] = []

  for (const [day, nowOff] of after) {
    const wasOff = before.get(day) ?? new Set<string>()
    for (const time of nowOff) if (!wasOff.has(time)) suspended.push({ day, time })
    for (const time of wasOff) if (!nowOff.has(time)) restored.push({ day, time })
  }

  return { suspended, restored }
}

/** "sunday" + "6:00 am" -> "6:00 AM Sunday". */
function spoken({ day, time }: MassMoved): string {
  const Day = day.charAt(0).toUpperCase() + day.slice(1)
  return `${time.toUpperCase()} ${Day}`
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
export function massNotice(
  change: MassChange,
  parishName: string,
  /**
   * What exactly moved, from massDiff.
   *
   * Optional, and the generic wording below is used without it. With
   * it the notice can name the Mass, which is the difference between
   * something the reader must open the app to act on and something
   * they can act on from the lock screen: "the 6:00 AM Sunday Mass is
   * suspended" either does or does not concern you, and you know
   * which without tapping anything.
   */
  moved?: { suspended: MassMoved[]; restored: MassMoved[] },
): MassNotice | null {
  switch (change) {
    case 'updated': {
      const suspended = moved?.suspended ?? []
      const restored = moved?.restored ?? []

      if (suspended.length === 1 && restored.length === 0) {
        return {
          title: `${spoken(suspended[0])} Mass is suspended`,
          body: `${parishName} has called off the ${spoken(suspended[0])} Mass. The rest of the schedule is unchanged.`,
        }
      }
      if (suspended.length > 1 && restored.length === 0) {
        return {
          title: `${suspended.length} Masses suspended`,
          body: `${parishName} has called off ${suspended.map(spoken).join(', ')}.`,
        }
      }
      if (restored.length === 1 && suspended.length === 0) {
        return {
          title: `${spoken(restored[0])} Mass is back`,
          body: `${parishName} is celebrating the ${spoken(restored[0])} Mass again.`,
        }
      }
      if (restored.length > 1 && suspended.length === 0) {
        return {
          title: `${restored.length} Masses are back`,
          body: `${parishName} is celebrating ${restored.map(spoken).join(', ')} again.`,
        }
      }

      // Times themselves moved, or both happened at once. Nothing
      // short and true can be said, so it says the true vague thing.
      return {
        title: 'Mass schedule updated',
        body: `${parishName} has changed its Mass times. Open SanctiWalk to see the new schedule.`,
      }
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
