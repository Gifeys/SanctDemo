import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "./firebase";
import {
  markRecorded, shouldRecord, visitorId, type PageEventKind,
} from "./pageEvents";

/**
 * Writes one page event, or quietly does not.
 *
 * Separated from pageEvents.ts so the rules there stay testable
 * without a Firestore: this file is the only part that talks to one.
 *
 * Every failure is swallowed. A pilgrim opening the app must never see
 * an error because a counter did not save, and the count is a courtesy
 * to the parish office rather than something the app depends on.
 */
/**
 * The three fields below are the ONLY ones firestore.rules permits.
 *
 *     hasOnly(['kind', 'visitorId', 'createdAt'])
 *
 * A fourth key does not get ignored - the whole write is refused, and
 * refused silently, because the catch below swallows it so that
 * counting never interrupts anybody. A `surface` field was added here
 * once and every open and download was rejected for a day before
 * anyone noticed the counter had stopped moving.
 *
 * Anything added here has to be added to that rule and deployed in the
 * same breath, or it stops the counting entirely.
 */
export async function recordPageEvent(kind: PageEventKind): Promise<void> {
  try {
    if (!shouldRecord(kind)) return;
    // Marked before the write, not after. A write that fails must not
    // be retried on every render for the rest of the session.
    markRecorded(kind);
    await addDoc(collection(db, "pageEvents"), {
      kind,
      visitorId: visitorId(),
      // The server's clock. A handset with a wrong date cannot file
      // itself into last month.
      createdAt: serverTimestamp(),
    });
  } catch {
    /* counting is not worth interrupting anybody for */
  }
}
