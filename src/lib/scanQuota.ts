/**
 * Who may spend a recognition, and how many are left.
 *
 * ## Why this replaced the per-IP cap
 *
 * The old ceiling counted scans against the caller's IP address. Inside
 * a church, a school or a house, every phone on the same Wi-Fi shares
 * one public address — so twenty scans were twenty for the whole room,
 * and the first person through the door could spend everybody's. The
 * opposite failed too: a visitor who walked outside and dropped to
 * mobile data became a new IP and got a fresh twenty.
 *
 * An address is not a person. An account is, so the allowance is
 * counted against the signed-in user.
 *
 * ## Why per parish
 *
 * A pilgrim visiting both churches is on two separate visits and should
 * not arrive at the second one with an allowance already spent at the
 * first. Each parish keeps its own counter.
 *
 * ## Why the day is UTC
 *
 * The counter has to reset on a boundary the server and the phone agree
 * on without being told each other's timezone. Manila is UTC+8, so the
 * reset lands at 08:00 local - inconvenient to explain, but a counter
 * that resets at a predictable wrong-looking hour is better than one
 * that resets twice for a traveller or not at all.
 *
 * Pure and dependency-free: the server enforces these rules and the app
 * only displays them, so both can import the same file and neither can
 * drift from the other.
 */

/** Recognitions per user, per parish, per day. */
export const SCANS_PER_PARISH_PER_DAY = 20

/** The parishes that have a scanner at all. */
export const SCANNABLE_PARISHES = ['route-mhcp', 'route-src'] as const

export type ScannableParish = (typeof SCANNABLE_PARISHES)[number]

export interface ScanBudget {
  limit: number
  used: number
  remaining: number
  /** The UTC day this count belongs to, as YYYY-MM-DD. */
  day: string
  parishId: string
}

/** The UTC day a moment falls in. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10)
}

export function isScannableParish(parishId: unknown): parishId is ScannableParish {
  return typeof parishId === 'string'
    && (SCANNABLE_PARISHES as readonly string[]).includes(parishId)
}

/**
 * The Firestore document a user's allowance for one parish-day lives in.
 *
 * One document per user per parish per day, rather than one growing
 * document per user. A day's counter is then a single read, old days
 * fall out of the way on their own, and two parishes cannot contend for
 * the same document while someone scans in both.
 *
 * The id is built from values the server already has, never from
 * anything the client sends unchecked: the uid comes from a verified
 * token and the parish from a fixed list.
 */
export function scanQuotaDocId(uid: string, parishId: string, day: string): string {
  return `${uid}__${parishId}__${day}`
}

export function budgetFrom(used: number, parishId: string, day: string): ScanBudget {
  const safe = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0
  return {
    limit: SCANS_PER_PARISH_PER_DAY,
    used: safe,
    remaining: Math.max(0, SCANS_PER_PARISH_PER_DAY - safe),
    day,
    parishId,
  }
}

/** An untouched allowance, for a user who has not scanned here today. */
export function emptyBudget(parishId: string, day: string = utcDay()): ScanBudget {
  return budgetFrom(0, parishId, day)
}

/**
 * What to tell somebody who has none left.
 *
 * Names the parish, because the other one still has its own twenty and
 * a visitor standing in the second church should not be told the app is
 * finished with them for the day.
 */
export function spentMessage(parishName: string): string {
  return `You have used all ${SCANS_PER_PARISH_PER_DAY} scans for ${parishName} today. `
    + `The count resets at midnight UTC, and other parishes have their own.`
}
