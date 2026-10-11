import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { ACTIVE_WINDOW_MS, shouldRecordVisit, visitKey } from './visits'

/**
 * Writing the two things the parish dashboard counts.
 *
 * Both are deliberately cheap. Firestore on the free plan is billed by
 * the document, and a tour guide that spends a parish's quota counting
 * its own users would be a poor trade.
 */

/** Reads the device's note of when it last recorded a visit here. */
function lastVisitAt(uid: string, churchId: string): number | null {
  try {
    const raw = localStorage.getItem(visitKey(uid, churchId))
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    // Storage blocked. Treated as "never", which at worst records one
    // extra visit per session rather than losing the feature.
    return null
  }
}

function rememberVisit(uid: string, churchId: string, at: number): void {
  try {
    localStorage.setItem(visitKey(uid, churchId), String(at))
  } catch {
    /* ignore */
  }
}

/**
 * Records that a signed-in pilgrim was inside a parish's geofence.
 *
 * Called when presence.ts moves to 'present', which already requires
 * the pilgrim to be within the parish's radius and to have stayed
 * there past the dwell gate. This adds only the deduplication and the
 * write.
 *
 * Signed out, nothing is recorded. An anonymous visit could not be
 * deduplicated, could not be attributed to a parish's own
 * congregation, and would need a rule that let anyone write anything
 * into the collection.
 *
 * Failures are swallowed on purpose. A pilgrim who walks into a church
 * and gets an error about analytics has been given a worse experience
 * so that a statistic could be collected, which is the wrong way round.
 */
export async function recordChurchVisit(churchId: string): Promise<boolean> {
  const user = auth.currentUser
  if (!user || !churchId) return false

  const now = Date.now()
  if (!shouldRecordVisit(lastVisitAt(user.uid, churchId), now)) return false

  // Written before the request, not after. Two geofence events can
  // arrive in the same tick, and a cooldown recorded on success would
  // let both through.
  rememberVisit(user.uid, churchId, now)

  try {
    await addDoc(collection(db, 'visits'), {
      uid: user.uid,
      churchId,
      at: new Date(now).toISOString(),
      // The server's own clock, for anything that must not trust the
      // handset's. The rules check it.
      createdAt: serverTimestamp(),
    })
    return true
  } catch (err) {
    console.debug('[visits] not recorded:', err)
    return false
  }
}

/**
 * The last time this device told Firestore the pilgrim was using the app.
 *
 * Module scope rather than storage: it only has to survive the session,
 * and reading storage on every heartbeat is more work than the write it
 * is trying to avoid.
 */
let lastHeartbeat = 0

/**
 * How often a heartbeat may be written.
 *
 * A third of the active window. Often enough that somebody using the
 * app continuously is never counted as having left, rare enough that an
 * hour of use costs twelve writes rather than one per screen.
 */
export const HEARTBEAT_INTERVAL_MS = ACTIVE_WINDOW_MS / 3

/**
 * Marks the signed-in pilgrim as active, at most once per interval.
 *
 * Throttled hard. The naive version - a write per navigation - turns a
 * ten-minute visit into dozens of writes per user, and the figure it
 * produces is no better for it.
 */
export async function touchActivity(): Promise<void> {
  const user = auth.currentUser
  if (!user) return

  const now = Date.now()
  if (now - lastHeartbeat < HEARTBEAT_INTERVAL_MS) return
  lastHeartbeat = now

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      lastActiveAt: new Date(now).toISOString(),
    })
  } catch (err) {
    // A profile that does not exist yet, or rules refusing it. Neither
    // is worth interrupting anybody over.
    console.debug('[activity] heartbeat not written:', err)
  }
}

/** Lets a sign-out reset the throttle, so the next account is seen at once. */
export function resetHeartbeat(): void {
  lastHeartbeat = 0
}
