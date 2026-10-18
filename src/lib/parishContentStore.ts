/**
 * Reading a parish's admin-managed content on the server.
 *
 * ## Why this exists at all
 *
 * Sancti could only ever see the content of the ONE parish the pilgrim
 * had open, because that is the only document the client subscribes to.
 * Ask about any other parish and the answer quietly fell back to the
 * schedule compiled into the bundle - so a parish office could move its
 * Mass in the admin portal and Sancti would keep telling everybody else
 * the old time. Reading from the server removes that limit: the Admin
 * SDK can fetch any parish's document, so an answer about San Roque is
 * as current as an answer about the parish you are standing in.
 *
 * ## Why it is read-only, and server-only
 *
 * Server-only because it uses the Admin SDK, whose credentials must
 * never reach a browser - nothing under src/components may import this.
 * Read-only because the assistant answers questions; nothing it does
 * should ever write to a parish's document. The Admin SDK bypasses
 * security rules, so the narrowness is the safeguard.
 *
 * Reuses the Admin app started by scanQuotaStore rather than starting a
 * second one: two initialisations of the same credential is a warning
 * at best and a leak at worst.
 */
import { getFirestore } from 'firebase-admin/firestore'

import type { ParishContent } from './parishContent'
import { quotaStoreReady } from './scanQuotaStore'

const COLLECTION = 'parishContent'

/** True when the server can read Firestore at all. */
export function parishStoreReady(): boolean {
  return quotaStoreReady()
}

/**
 * One parish's content, or null when there is none to be had.
 *
 * Null covers three different situations on purpose - no Admin SDK, no
 * document, or a read that failed - because the caller does the same
 * thing in all three: ground on what it has, and say what it does not.
 * The alternative, throwing, would turn a parish that has simply not
 * filled anything in into an error page.
 */
export async function readParishContent(parishId: string): Promise<ParishContent | null> {
  if (!parishId || !parishStoreReady()) return null

  try {
    const snap = await getFirestore().collection(COLLECTION).doc(parishId).get()
    if (!snap.exists) return null
    return (snap.data() ?? null) as ParishContent | null
  } catch (err) {
    console.warn('[Sancti] could not read parish content:', (err as Error).message)
    return null
  }
}
