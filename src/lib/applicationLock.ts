import type { ApplicationStatus } from "../types";

/**
 * One ministry application at a time, per pilgrim.
 *
 * ## Why a separate document
 *
 * The restriction is "does this person already have a ministry
 * application open", which is a QUERY across the applications
 * collection. A Firestore rule cannot query. It can only `get()` one
 * document by a path it is able to construct, so the question has to
 * be turned into a document with a predictable id - and that is all
 * this is.
 *
 * Checking it only in the app would leave it bypassable with curl,
 * which is the standard firestore.rules already holds itself to:
 * "the button is not the control".
 *
 * ## Why it is atomic
 *
 * The lock and the application are written in one batch. A second
 * submission cannot create a lock that exists, and because a batch is
 * all or nothing, its application is not written either. Two taps in
 * the same second resolve to exactly one application, decided by
 * Firestore at commit rather than by a check-then-write race in the
 * client.
 *
 * ## Why it can recover
 *
 * A lock whose application has been decided is dead, and the worst
 * outcome of this feature would be a parishioner permanently unable
 * to apply because one admin write half-failed. So the lock names the
 * application it belongs to, and the owner may delete it once that
 * application reads terminal - a rule can `get()` the application by
 * the id stored here. The app heals itself on next load.
 */

/** One per pilgrim, at `applicationLocks/{uid}`. */
export interface ApplicationLock {
  /** The application this lock is held for. */
  applicationId: string;
  /** Whose it is. Pinned to the caller by the rules. */
  uid: string;
  /** The parish, so an admin can see their own without reading others. */
  churchId: string;
  createdAt: string;
}

/** Where the lock for a pilgrim lives. */
export const APPLICATION_LOCKS = "applicationLocks";

/**
 * Statuses that still hold the lock.
 *
 * Decided with the parish: pending and under_review are live, and
 * everything else is a decision - including `completed`, which is a
 * sacrament that has happened and no reason to stop somebody joining
 * a ministry.
 */
export const LOCKING_STATUSES: ApplicationStatus[] = ["pending", "under_review"];

/** Statuses that release it. */
export const TERMINAL_STATUSES: ApplicationStatus[] = ["approved", "rejected", "completed"];

/** Whether an application in this state should still be holding a lock. */
export function stillHoldsLock(status: ApplicationStatus): boolean {
  return LOCKING_STATUSES.includes(status);
}

/** Whether reaching this state should release it. */
export function releasesLock(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Whether this kind of application is restricted at all.
 *
 * Ministries only, on the parish's instruction. A sacrament is not a
 * membership and somebody arranging a baptism has no reason to be
 * blocked from asking about a wedding.
 */
export function isRestricted(kind: string): boolean {
  return kind === "ministry";
}

/**
 * What to tell somebody whose Apply button is unavailable for this
 * reason, as distinct from the item being closed.
 */
export function blockedMessage(openApplicationType?: string): string {
  const which = openApplicationType ? `your application for ${openApplicationType}` : "your application";
  return (
    `The parish is still reviewing ${which}. ` +
    `You can apply for another ministry once they have decided on it.`
  );
}
