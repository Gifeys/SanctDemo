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

export interface PageEvent {
  kind: PageEventKind
  /** Random per-browser token. See the note above. */
  visitorId: string
  /** ISO 8601, from the server's clock where there is one. */
  at: string
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
  let opens = 0
  let downloads = 0

  for (const e of events) {
    if (e.kind === 'open') {
      opens += 1
      if (e.visitorId) openers.add(e.visitorId)
    } else if (e.kind === 'download') {
      downloads += 1
      if (e.visitorId) downloaders.add(e.visitorId)
    }
  }

  return { opens, downloads, people: openers.size, downloaders: downloaders.size }
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
