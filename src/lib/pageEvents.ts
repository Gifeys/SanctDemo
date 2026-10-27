/**
 * Counting who opened SanctiWalk and who downloaded it.
 *
 * ## Why this is separate from `visits`
 *
 * `visits` answers "who came to the church" - it needs a signed-in uid
 * and a parish, because its question is about a building. This answers
 * "how many people found the app at all", which is a question about
 * everyone, most of whom never sign in and are not standing anywhere
 * near a parish.
 *
 * ## What is stored, and what deliberately is not
 *
 * A kind, a timestamp, and a random id generated in the browser. No
 * account, no name, no address, nothing that reaches a person. The id
 * exists only so that one visitor opening the app ten times on Sunday
 * is not reported as ten visitors; it is meaningless outside this
 * collection and is never shown.
 *
 * The parish office asked to see who downloads the app. It gets counts
 * instead, which is the same decision already made for Visitor
 * Activity: "how many came on Sunday" and "who came on Sunday" are
 * different questions, and only the first has been answered here.
 *
 * ## Why the count can only ever start today
 *
 * Nothing recorded this before, so there is no history to recover. A
 * figure for last month cannot be produced from data that was never
 * written, and inventing one would be worse than the gap.
 */

/** What happened. Two kinds, because two were asked for. */
export type PageEventKind = 'open' | 'download'

/**
 * Where the app was being used.
 *
 * Absent on everything recorded before this was added, which is why
 * the totals report it separately rather than folding it into the
 * headline numbers: an unknown surface is not a web visit, and
 * counting it as one would quietly rewrite the past.
 */
export type PageEventSurface = 'apk' | 'web'

export interface PageEvent {
  kind: PageEventKind
  /** Random per-browser token. See the note above. */
  visitorId: string
  /** ISO 8601, from the server's clock where there is one. */
  at: string
  /** Absent on rows written before surfaces were recorded. */
  surface?: PageEventSurface
}

const VISITOR_KEY = 'sanctiwalk.visitor'

/**
 * A stable random id for this browser.
 *
 * Not a fingerprint and not derived from anything about the device or
 * the person: it is random, kept in this browser's own storage, and
 * cleared whenever they clear site data. Private mode gets a fresh one
 * each session, which overcounts slightly - the honest direction for a
 * number nobody acts on.
 */
export function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const made = randomId()
    localStorage.setItem(VISITOR_KEY, made)
    return made
  } catch {
    // Storage refused. A per-session id still separates this visitor
    // from the others in the same window.
    return randomId()
  }
}

function randomId(): string {
  try {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
  }
}

/** How long before the same browser's "open" counts again. */
export const OPEN_DEDUPE_MS = 30 * 60 * 1000

function lastKey(kind: PageEventKind): string {
  return `sanctiwalk.lastEvent.${kind}`
}

/**
 * Whether this event is worth writing.
 *
 * An "open" fires on every mount, and React remounts for reasons that
 * have nothing to do with a person arriving - a reload, a tab coming
 * back, a route change in some future version. Half an hour of silence
 * per browser turns that into something closer to a visit.
 *
 * A download is not deduped. Somebody downloading twice has in fact
 * downloaded twice, usually because the first one failed, and that is
 * worth seeing.
 */
export function shouldRecord(
  kind: PageEventKind,
  now: number = Date.now(),
  read: (key: string) => string | null = safeGet,
): boolean {
  if (kind === 'download') return true
  const last = Number(read(lastKey(kind)) ?? '')
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= OPEN_DEDUPE_MS
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function markRecorded(kind: PageEventKind, now: number = Date.now()): void {
  try {
    localStorage.setItem(lastKey(kind), String(now))
  } catch {
    /* private mode; it will simply record again next time */
  }
}

// ---------------------------------------------------------------- reading

export interface PageEventTotals {
  opens: number
  downloads: number
  /** Distinct browsers that opened it, not distinct opens. */
  people: number
  /** Distinct browsers that downloaded it. */
  downloaders: number
  /** Distinct browsers that opened the installed Android app. */
  apkPeople: number
  /** Distinct browsers that opened it in a web browser. */
  webPeople: number
  /**
   * Distinct browsers whose surface was never recorded.
   *
   * Reported rather than hidden. Every row written before this field
   * existed is one of these, so for a while apkPeople + webPeople will
   * be far short of people - and a panel that did not say so would
   * look like most of the parish had stopped using the app.
   */
  unknownSurfacePeople: number
}

/**
 * The totals, from whatever rows the admin screen was given.
 *
 * Counting distinct ids as well as rows because the two answer
 * different questions and the difference matters: forty opens from
 * four browsers is a very different Sunday from forty from forty.
 */
export function summarisePageEvents(events: PageEvent[]): PageEventTotals {
  const openers = new Set<string>()
  const downloaders = new Set<string>()
  const apk = new Set<string>()
  const web = new Set<string>()
  const unknown = new Set<string>()
  let opens = 0
  let downloads = 0

  for (const e of events) {
    if (e.kind === 'open') {
      opens += 1
      if (!e.visitorId) continue
      openers.add(e.visitorId)
      if (e.surface === 'apk') apk.add(e.visitorId)
      else if (e.surface === 'web') web.add(e.visitorId)
      else unknown.add(e.visitorId)
    } else if (e.kind === 'download') {
      downloads += 1
      if (e.visitorId) downloaders.add(e.visitorId)
    }
  }

  // Somebody who opened it both ways is in both sets, and is one
  // person in `people`. The three do not add up to it, and should not
  // be presented as though they do.
  return {
    opens,
    downloads,
    people: openers.size,
    downloaders: downloaders.size,
    apkPeople: apk.size,
    webPeople: web.size,
    unknownSurfacePeople: unknown.size,
  }
}

/** Rows from the last `days` days, newest first. */
export function recentEvents(events: PageEvent[], days: number, now: Date = new Date()): PageEvent[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return events
    .filter(e => {
      const t = Date.parse(e.at)
      return Number.isFinite(t) && t >= cutoff
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** A count per calendar day, oldest first, for a small bar chart. */
export function byDay(events: PageEvent[], kind: PageEventKind): { day: string; count: number }[] {
  const tally = new Map<string, number>()
  for (const e of events) {
    if (e.kind !== kind) continue
    const t = Date.parse(e.at)
    if (!Number.isFinite(t)) continue
    const day = new Date(t).toISOString().slice(0, 10)
    tally.set(day, (tally.get(day) ?? 0) + 1)
  }
  return [...tally.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** One month's usage, for the admin's chart. */
export interface MonthlyUsers {
  /** YYYY-MM, which sorts correctly as a string. */
  month: string
  /** "Nov 2026", for the axis. */
  label: string
  /** Distinct browsers that opened the app that month. */
  users: number
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Distinct people per month, from opens that actually happened.
 *
 * ## What the number means
 *
 * Monthly active users: how many different browsers opened the app in
 * that calendar month. Not registrations - somebody who signed up in
 * March and never came back is not a user in April, and presenting
 * registrations as usage is the specific thing the parish asked not
 * to see.
 *
 * Counted per month, not cumulatively, so the same person returning
 * in three months is one user in each of them.
 *
 * ## Empty months
 *
 * A month with no opens is returned with zero rather than skipped. A
 * line that jumps straight from September to November implies the two
 * are adjacent, and a quiet month is a fact worth seeing.
 */
export function monthlyActiveUsers(events: PageEvent[]): MonthlyUsers[] {
  const perMonth = new Map<string, Set<string>>()

  for (const e of events) {
    if (e.kind !== 'open' || !e.visitorId) continue
    const when = new Date(e.at)
    if (Number.isNaN(when.getTime())) continue
    const month = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
    const seen = perMonth.get(month) ?? new Set<string>()
    seen.add(e.visitorId)
    perMonth.set(month, seen)
  }

  if (perMonth.size === 0) return []

  const months = [...perMonth.keys()].sort()
  const out: MonthlyUsers[] = []

  // Walk the calendar from the first month to the last so the gaps are
  // filled rather than closed up.
  const [firstYear, firstMonth] = months[0].split('-').map(Number)
  const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number)

  let year = firstYear
  let month = firstMonth
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    out.push({
      month: key,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      users: perMonth.get(key)?.size ?? 0,
    })
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }

  return out
}
