/**
 * The server's side of the scan allowance: who is asking, and whether
 * they have one left.
 *
 * Server-only. It uses the Firebase Admin SDK, which holds credentials
 * that must never reach a browser, so nothing under src/components may
 * import it. The pure rules live in scanQuota.ts and are shared.
 *
 * ## Why a transaction and not read-then-write
 *
 * Two scans fired at once - a double tap, or a retry arriving beside
 * the original - both read "19 used" and both write 20, and the user
 * has spent two scans for one increment. Firestore's transaction
 * retries on contention, so the second attempt sees the first's write.
 * The allowance is small enough that one free scan matters.
 *
 * ## Why the allowance is spent before the model is asked
 *
 * A scan that is paid for and then fails is unfair; a scan that is free
 * when it fails is an exploit, because a client that aborts every
 * request has an unlimited allowance. The middle course, and the one
 * taken here: reserve first, and refund only when the failure is ours
 * (the model timed out, the key is wrong), never when it is simply a
 * photograph the model could not name.
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

import {
  SCANS_PER_PARISH_PER_DAY,
  budgetFrom,
  scanQuotaDocId,
  utcDay,
  type ScanBudget,
} from './scanQuota'

const COLLECTION = 'scanQuotas'

let ready = false

/**
 * Starts the Admin SDK once, from whichever credential the host gives.
 *
 * On Render the service account arrives as one JSON blob in an
 * environment variable, because that is the only shape a dashboard can
 * hold. Locally, GOOGLE_APPLICATION_CREDENTIALS pointing at a file is
 * the usual route. Either is fine; neither is ever committed.
 */
export function initQuotaStore(): boolean {
  if (ready) return true
  if (getApps().length) {
    ready = true
    return true
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  try {
    if (raw && raw.trim().startsWith('{')) {
      initializeApp({ credential: cert(JSON.parse(raw)) })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() })
    } else {
      return false
    }
    ready = true
    return true
  } catch (err) {
    console.error('[Quota] could not start the Admin SDK:', (err as Error).message)
    return false
  }
}

/** True when the server can verify tokens and count scans. */
export function quotaStoreReady(): boolean {
  return ready || initQuotaStore()
}

/**
 * The uid behind a bearer token, or null.
 *
 * Verified by the Admin SDK against Google's keys, so a forged token
 * cannot pass. This is the whole reason the allowance is trustworthy:
 * the client says which parish, but never who it is.
 */
export async function uidFromToken(authorization: string | undefined): Promise<string | null> {
  if (!quotaStoreReady()) return null
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid
  } catch (err) {
    console.warn('[Quota] rejected a token:', (err as Error).message)
    return null
  }
}

/** What this user has left at this parish today, without spending any. */
export async function readBudget(uid: string, parishId: string): Promise<ScanBudget> {
  const day = utcDay()
  if (!quotaStoreReady()) return budgetFrom(0, parishId, day)

  const snap = await getFirestore()
    .collection(COLLECTION)
    .doc(scanQuotaDocId(uid, parishId, day))
    .get()

  return budgetFrom((snap.data()?.used as number) ?? 0, parishId, day)
}

export interface SpendResult {
  allowed: boolean
  budget: ScanBudget
}

/**
 * Takes one scan from the allowance, or refuses.
 *
 * The read and the write are one transaction, so two requests racing
 * cannot both be told they were the twentieth.
 */
export async function spendScan(uid: string, parishId: string): Promise<SpendResult> {
  const day = utcDay()
  if (!quotaStoreReady()) {
    // No credentials configured. Refusing every scan would take the
    // feature away over a deployment mistake, so it is allowed and the
    // log says loudly why the count will be wrong.
    console.warn('[Quota] no Admin credentials — allowing the scan uncounted')
    return { allowed: true, budget: budgetFrom(0, parishId, day) }
  }

  const ref = getFirestore().collection(COLLECTION).doc(scanQuotaDocId(uid, parishId, day))

  return getFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref)
    const used = (snap.data()?.used as number) ?? 0

    if (used >= SCANS_PER_PARISH_PER_DAY) {
      return { allowed: false, budget: budgetFrom(used, parishId, day) }
    }

    tx.set(ref, {
      uid,
      parishId,
      day,
      used: used + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return { allowed: true, budget: budgetFrom(used + 1, parishId, day) }
  })
}

/**
 * Gives a reserved scan back, after a failure that was not the user's.
 *
 * Never below zero: a refund arriving after the daily reset must not
 * leave tomorrow's counter negative and hand out twenty-one.
 */
export async function refundScan(uid: string, parishId: string): Promise<void> {
  const day = utcDay()
  if (!quotaStoreReady()) return

  const ref = getFirestore().collection(COLLECTION).doc(scanQuotaDocId(uid, parishId, day))
  try {
    await getFirestore().runTransaction(async tx => {
      const snap = await tx.get(ref)
      const used = (snap.data()?.used as number) ?? 0
      if (used <= 0) return
      tx.set(ref, { used: used - 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    })
  } catch (err) {
    console.warn('[Quota] refund failed:', (err as Error).message)
  }
}
