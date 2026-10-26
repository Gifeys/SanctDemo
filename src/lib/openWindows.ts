/**
 * The dates a sacrament or ministry is open for applications.
 *
 * ## Why this exists
 *
 * availability.ts holds a list of CLOSED ids, which the parish office
 * toggles by hand. That works, and it is the right model for "the choir
 * is shut for Lent". It is the wrong model for anything that happens on
 * a season: baptisms every November, confirmation in the summer. Those
 * had to be opened and closed by hand each year, and an office that
 * forgets leaves a sacrament open all year or shut all year.
 *
 * So a window is a date range the item is open FOR. The manual switch
 * stays - it is how a parish shuts something immediately, whatever the
 * calendar says.
 *
 * ## Absent means open
 *
 * No windows at all means "no seasonal rule, use the manual switch".
 * This is the same reasoning as closedIds and it matters for the same
 * reason: 29 of 31 parishes have no parishContent document, and a model
 * where "unset" reads as "closed" would shut every sacrament in the
 * diocese on the day it shipped.
 *
 * ## Plain YYYY-MM-DD, not timestamps
 *
 * A parish opens baptisms "in November", not "from 00:00:00+08:00 on the
 * 1st". Comparing dates as strings in this format is also exact - no
 * timezone, no drift at midnight, and no Date parsing differences
 * between the admin's browser and the pilgrim's phone.
 */

/** One date range, inclusive at both ends. */
export interface OpenWindow {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD, the last open day. */
  to: string
}

/**
 * How many ranges one item may carry.
 *
 * These live in the parish's single shared content document, which
 * Firestore caps at 1 MiB. A list nobody bounds is how that document
 * eventually fails to save, taking every other edit with it.
 */
export const MAX_WINDOWS_PER_ITEM = 24

const DATE = /^\d{4}-\d{2}-\d{2}$/

function usable(window: OpenWindow | null | undefined): window is OpenWindow {
  return !!window && DATE.test(window.from ?? '') && DATE.test(window.to ?? '')
}

/**
 * The stored value, with anything unusable removed.
 *
 * Read defensively because this comes from Firestore, where an older
 * version of the admin, a hand edit, or a half-finished write can leave
 * a shape this code never produced.
 */
export function normaliseWindows(raw: OpenWindow[] | undefined | null): OpenWindow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(usable).map(({ from, to }) => ({ from, to }))
}

/** The range as [earlier, later], so a backwards entry still works. */
function ordered(window: OpenWindow): [string, string] {
  return window.from <= window.to ? [window.from, window.to] : [window.to, window.from]
}

/**
 * Whether `day` falls inside any window.
 *
 * No windows means open: see the note at the top.
 */
export function isWithinWindows(
  windows: OpenWindow[] | undefined | null,
  day: string,
): boolean {
  const usableWindows = normaliseWindows(windows)
  if (usableWindows.length === 0) return true

  return usableWindows.some(window => {
    const [start, end] = ordered(window)
    // Inclusive at both ends. "1 Nov to 30 Nov" is open on the 30th;
    // an exclusive end quietly costs the parish a day every season.
    return day >= start && day <= end
  })
}

/** The first day it opens again, or null if open now or never again. */
export function nextOpening(
  windows: OpenWindow[] | undefined | null,
  day: string,
): string | null {
  const usableWindows = normaliseWindows(windows)
  if (usableWindows.length === 0) return null
  if (isWithinWindows(usableWindows, day)) return null

  const upcoming = usableWindows
    .map(window => ordered(window)[0])
    .filter(start => start > day)
    .sort()

  return upcoming[0] ?? null
}

/** Adds a range, sorted, deduplicated and capped. */
export function withWindow(current: OpenWindow[], window: OpenWindow): OpenWindow[] {
  if (!usable(window)) return current
  const [from, to] = ordered(window)
  const already = current.some(w => w.from === from && w.to === to)
  if (already || current.length >= MAX_WINDOWS_PER_ITEM) return current

  return [...current, { from, to }].sort((a, b) => a.from.localeCompare(b.from))
}

/** Removes a range. */
export function withoutWindow(current: OpenWindow[], window: OpenWindow): OpenWindow[] {
  return current.filter(w => !(w.from === window.from && w.to === window.to))
}

/** A sentence for the admin, so the effect of the dates is visible. */
export function describeWindows(
  windows: OpenWindow[] | undefined | null,
  day: string,
): string {
  const usableWindows = normaliseWindows(windows)
  if (usableWindows.length === 0) {
    return 'No dates set — open any time the switch above is on.'
  }

  if (isWithinWindows(usableWindows, day)) return 'Open today.'

  const next = nextOpening(usableWindows, day)
  if (!next) return 'Closed — every date set is in the past.'
  return `Closed until it opens on ${next}.`
}
