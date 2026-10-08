import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { STATUS_LABEL } from "./applications";
import type { ApplicationStatus, NotificationDoc } from "../types";

/**
 * In-app notifications.
 *
 * ## Why these are not emails
 *
 * The spec asks for email on every status change. Sending mail from a
 * trusted place means Cloud Functions, which means the Blaze plan, and this
 * project is on Spark. Sending it from the browser would mean an email
 * provider's API key in client code, where anyone can read it and send mail
 * as the parish - which is worse than not sending the email.
 *
 * So the record is written here, where it is real, and the person sees it
 * next time they open the app. Firebase's own verification and
 * password-reset mail still goes out, because Firebase sends that itself.
 *
 * ## Who is allowed to write one
 *
 * The rules permit a notification addressed to yourself, or one written by
 * the admin of the church it names. That is exactly the two cases: a
 * pilgrim recording their own submission, and a parish telling a pilgrim
 * what they decided. Nobody can write a notification into a stranger's
 * list.
 *
 * ## Why failures are swallowed
 *
 * A notification is a copy of something that already happened. If writing
 * it fails, the application was still submitted and the decision was still
 * recorded; throwing here would roll back nothing and would tell the
 * person their application failed when it did not.
 */

async function write(entry: Omit<NotificationDoc, "id" | "createdAt">): Promise<void> {
  try {
    await addDoc(collection(db, "notifications"), {
      ...entry,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
  } catch (err) {
    console.debug("[notifications] not recorded:", err);
  }
}

/** Written by the applicant, about their own submission. */
export async function notifySubmitted(
  churchId: string,
  applicationId: string,
  what: string,
  reference: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await write({
    userId: user.uid,
    churchId,
    applicationId,
    title: "Application submitted",
    body: `Your application for ${what} has been sent to your parish. Reference ${reference}.`,
  });
}

/**
 * Written by the parish, to the applicant.
 *
 * The wording differs per outcome rather than being one templated line,
 * because "approved" and "rejected" are the two most consequential words
 * this app says to anyone and a shared sentence makes both sound
 * administrative.
 */
export async function notifyStatusChanged(
  applicantUid: string,
  churchId: string,
  applicationId: string,
  what: string,
  status: ApplicationStatus,
  note?: string,
): Promise<void> {
  const body: Record<ApplicationStatus, string> = {
    pending: `Your application for ${what} is back in the queue.`,
    under_review: `Your parish is now reviewing your application for ${what}.`,
    approved: `Good news - your application for ${what} has been approved.`,
    rejected: `Your application for ${what} was not approved.`,
    completed: `Your application for ${what} is complete.`,
  };

  await write({
    userId: applicantUid,
    churchId,
    applicationId,
    title: STATUS_LABEL[status] ?? status,
    body: note ? `${body[status]} ${note}` : body[status],
  });
}

/**
 * Live notifications for the signed-in user, newest first.
 *
 * Sorted here rather than with orderBy because a composite query on
 * userId + createdAt needs an index, and an index that has not been
 * deployed makes the list throw instead of render. The volume per person
 * is small enough that the cost is nothing.
 */
export function watchNotifications(
  onChange: (items: NotificationDoc[]) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => {};
  }

  const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as NotificationDoc) }));
      items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      onChange(items);
    },
    err => {
      console.debug("[notifications] subscription failed:", err);
      onChange([]);
    },
  );
}

/** The only change a reader may make. The rules allow this field alone. */
export async function markRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      readAt: new Date().toISOString(),
    });
  } catch (err) {
    console.debug("[notifications] could not mark read:", err);
  }
}

export function unreadCount(items: NotificationDoc[]): number {
  return items.filter(n => !n.readAt).length;
}

/**
 * Telling the whole parish about something.
 *
 * ## Why this is a fan-out from the browser, and what that costs
 *
 * A notification is a document addressed to one person, so "tell the
 * parish" means one write per parishioner. The usual way is a Cloud
 * Function triggered by the change; that needs the Blaze plan, and this
 * project is on Spark. So the admin's own browser does it, one write at
 * a time, under the rule that lets a parish admin write to their own
 * parishioners.
 *
 * That is fine for a parish of a few hundred and would not be for a
 * diocese. It is capped rather than left to run: a change that would
 * notify more people than the cap tells the admin so instead of locking
 * their browser up for a minute. When this project moves to Blaze the
 * right shape is a Function on parishContent and announcements, and this
 * becomes a few lines calling it.
 *
 * ## Why it is never automatic
 *
 * Every caller passes an explicit opt-in from a checkbox the admin
 * ticked. A parish office correcting a typo in a Mass time must not send
 * four hundred phones a notification, and the surest way to make people
 * ignore notifications is to send them one that did not matter.
 */

/** Above this, the admin is told to use an announcement instead. */
export const MAX_PARISH_NOTIFICATIONS = 400;

export interface BroadcastResult {
  sent: number;
  /** Set when nothing was sent because the parish is larger than the cap. */
  tooManyFor?: number;
}

export async function notifyParish(
  churchId: string,
  title: string,
  body: string,
): Promise<BroadcastResult> {
  const snap = await getDocs(
    query(collection(db, "users"), where("churchId", "==", churchId)),
  );

  if (snap.size > MAX_PARISH_NOTIFICATIONS) {
    return { sent: 0, tooManyFor: snap.size };
  }

  let sent = 0;
  for (const person of snap.docs) {
    // Sequential, not Promise.all: a few hundred simultaneous writes from
    // one browser is how a connection gets throttled and half of them
    // fail. write() already swallows its own failures, so one bad
    // document cannot stop the rest.
    await write({
      userId: person.id,
      churchId,
      title,
      body,
    });
    sent++;
  }
  return { sent };
}
