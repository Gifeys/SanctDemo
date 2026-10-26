import { Capacitor } from "@capacitor/core";
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
export async function recordPageEvent(kind: PageEventKind): Promise<void> {
  try {
    if (!shouldRecord(kind)) return;
    // Marked before the write, not after. A write that fails must not
    // be retried on every render for the rest of the session.
    markRecorded(kind);
    await addDoc(collection(db, "pageEvents"), {
      kind,
      visitorId: visitorId(),
      // Which surface this was. Capacitor knows for certain whether it
      // is the installed app; the user agent only guesses, and guesses
      // wrong inside a WebView that trims it.
      surface: Capacitor.isNativePlatform() ? "apk" : "web",
      // The server's clock. A handset with a wrong date cannot file
      // itself into last month.
      createdAt: serverTimestamp(),
    });
  } catch {
    /* counting is not worth interrupting anybody for */
  }
}
