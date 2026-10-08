import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Session and visit events, kept out of the applications collection.
 *
 * ## Why this exists
 *
 * Three call sites were writing "User Authenticated", "Station Visited" and
 * "Station Comment Posted" into `applications`, each inventing its own
 * status - "Session Authorized", "Stamp Awarded", "Moderated Approval".
 * That had two costs. The parish office's queue, which is meant to be the
 * list of things needing a decision, filled up with login records; and the
 * security rules that make an application an application - owner's uid,
 * status "pending", a real church - cannot hold for a row that is not one.
 *
 * So they moved here. The parish can still see them; they are simply not
 * pretending to be sacrament applications.
 *
 * ## Why a failure here is swallowed
 *
 * This is telemetry. A pilgrim who scans a station and loses the log entry
 * has lost nothing they can see; a pilgrim whose check-in throws because
 * the log write failed has lost the thing they came for. Errors go to the
 * console, not to the person.
 */
export type ActivityKind = "sign_in" | "station_visit" | "station_comment";

export async function logActivity(
  kind: ActivityKind,
  summary: string,
  churchId?: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "activity"), {
      uid: user.uid,
      kind,
      summary,
      churchId: churchId ?? "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.debug("[activity] not recorded:", err);
  }
}
