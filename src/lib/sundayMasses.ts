import { parseTimes, type MassScheduleEntry } from './schedule'

/**
 * The Sunday Mass card's data: the anticipated Mass and the Sunday Masses,
 * with the real dates each falls on.
 *
 * The mockup carries "DATE 00" placeholders next to both. Those are not
 * decoration — a pilgrim looking at a Mass card on a Tuesday needs to know
 * WHICH Sunday it is describing, and a card that says "Sunday Masses" with no
 * date is ambiguous for six days out of seven.
 *
 * Everything here is derived from the parish's own schedule in data.ts (or an
 * admin's override), never hardcoded, so all 31 parishes get a correct card
 * from the moment someone enters their times.
 */

export interface SundayMassCard {
  /** The Saturday evening Mass that fulfils the Sunday obligation. */
  anticipated: { time: string; date: Date } | null
  /** Every Mass on the Sunday itself, in the order the parish lists them. */
  sunday: { times: string[]; date: Date }
  /** True when this parish's times are placeholders, not parish-confirmed. */
  unverified: boolean
}

/** The next Sunday on or after `from`. Sunday itself counts as today. */
export function nextSunday(from: Date): Date {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7))
  return date
}

/**
 * The Saturday belonging to a given Sunday — the day before it.
 *
 * Not "the next Saturday": on a Sunday those are six days apart, and the
 * anticipated Mass shown beside today's Sunday Masses must be the one that
 * has just happened, not one a week out.
 */
export function saturdayBefore(sunday: Date): Date {
  const date = new Date(sunday)
  date.setDate(date.getDate() - 1)
  return date
}

/**
 * The LAST time listed on Saturday — the anticipated (vigil) Mass.
 *
 * A parish that has both a 6:00 AM and a 6:00 PM Saturday Mass lists them in
 * that order, and only the evening one fulfils the Sunday obligation. Taking
 * the first would put a 6 AM weekday Mass under the heading "Anticipated",
 * which is wrong in a way a parishioner would notice immediately.
 *
 * Returns null when the parish lists no Saturday Mass at all, rather than
 * inventing one.
 */
export function anticipatedTime(schedule: MassScheduleEntry[]): string | null {
  const saturday = schedule.find(entry => entry.day === 'Saturday')
  if (!saturday) return null

  const times = parseTimes(saturday.time)
  if (times.length === 0) return null

  const evening = times.filter(t => /pm/i.test(t))
  // Prefer the last evening Mass; fall back to the last listed time only when
  // the parish lists no evening Mass, and let the caller's own labelling make
  // clear what it is.
  return (evening.length > 0 ? evening : times)[Math.max(0, (evening.length > 0 ? evening : times).length - 1)]
}

export function sundayMassCard(
  schedule: MassScheduleEntry[],
  now: Date,
  { verified = true }: { verified?: boolean } = {},
): SundayMassCard {
  const sunday = nextSunday(now)
  const anticipated = anticipatedTime(schedule)
  const sundayEntry = schedule.find(entry => entry.day === 'Sunday')

  return {
    anticipated: anticipated ? { time: anticipated, date: saturdayBefore(sunday) } : null,
    sunday: {
      times: sundayEntry ? parseTimes(sundayEntry.time) : [],
      date: sunday,
    },
    unverified: !verified,
  }
}

/** "07" — the day of the month, zero-padded, as the mockup's "DATE 00" slot. */
export function dayOfMonth(date: Date): string {
  return String(date.getDate()).padStart(2, '0')
}
