import { addDoc, collection, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getProfile } from "./userProfile";
import { notifySubmitted, notifyStatusChanged } from "./notifications";
import { isArchived } from "./applicationFilters";
import type { ApplicationDoc, ApplicationStatus } from "../types";

/**
 * Submitting and deciding applications.
 *
 * ## Why every submission goes through here
 *
 * The security rules refuse an application unless it carries the submitter's
 * own uid, a status of exactly "pending", a kind of "sacrament" or
 * "ministry", and a churchId equal to the one on the submitter's profile.
 * Four conditions, and a form that gets any of them wrong fails at the last
 * moment in front of the person filling it in. One place builds the
 * document so there is one place that has to be right.
 *
 * ## Why churchId is read from the profile and not passed in
 *
 * The rules compare it against the profile anyway, so a caller that passed
 * a different one would simply be refused. Reading it here means the caller
 * cannot be wrong, rather than being wrong and finding out late.
 */

/** Statuses, in the order the parish works through them. */
export const STATUS_ORDER: ApplicationStatus[] = [
  "pending", "under_review", "approved", "rejected", "completed",
];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

/**
 * A reference the applicant can quote on the phone.
 *
 * Six random characters, not a running number. A sequence like 000123 needs
 * a counter that two submissions cannot both read at once, which means a
 * transaction on a shared document or a server - and the server is Cloud
 * Functions, which needs the Blaze plan this project is not on. A random
 * tail cannot collide in practice at parish volumes and cannot be guessed
 * at, which matters more here than being able to tell that yours was the
 * hundred-and-twenty-third.
 *
 * Ambiguous characters are left out so the reference survives being read
 * aloud and written on paper.
 */
const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY349";

export function referenceFor(kind: "sacrament" | "ministry", when: Date = new Date()): string {
  const prefix = kind === "sacrament" ? "SAC" : "MIN";
  let tail = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) tail += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${when.getFullYear()}-${tail}`;
}

export class SubmitError extends Error {}

export interface SubmitInput {
  kind: "sacrament" | "ministry";
  /**
   * Which ministry or sacrament, by id - "min-altar-servers",
   * "sac-baptism".
   *
   * Required, and required by the security rules too: it is what the rule
   * checks against the parish's closed list, and an application that
   * could omit it could be submitted to a ministry the parish had shut.
   * The display name cannot do this job - it is editable text, and
   * renaming a ministry would silently reopen it.
   */
  itemId: string;
  /** "Baptism", or the ministry's name. Shown in the parish's list. */
  type: string;
  applicantName: string;
  /** Everything the form asked that is not one of the fields above. */
  formData?: Record<string, unknown>;
}

/**
 * Writes an application for the signed-in user, to their own parish.
 *
 * Throws rather than returning an error object: every caller here is a
 * form submit handler that has to stop and say something, and a thrown
 * error is harder to forget to check than a returned one.
 */
export async function submitApplication(input: SubmitInput): Promise<ApplicationDoc> {
  const user = auth.currentUser;
  if (!user) {
    throw new SubmitError("Please sign in first, so the parish can reply to you.");
  }

  const profile = await getProfile(user.uid);
  if (!profile?.churchId) {
    throw new SubmitError(
      "Your account is not linked to a parish yet, so there is nowhere to send this. " +
      "Please contact your parish office.",
    );
  }

  if (!input.itemId) {
    // A caller bug, not something a pilgrim can cause. Caught here with a
    // sentence rather than at the database with "permission denied".
    throw new SubmitError("This application form is misconfigured. Please tell the parish office.");
  }

  const now = new Date();
  const document: ApplicationDoc = {
    uid: user.uid,
    itemId: input.itemId,
    applicantName: input.applicantName.trim() || profile.fullName || "",
    applicantEmail: profile.email || user.email || "",
    churchId: profile.churchId,
    kind: input.kind,
    type: input.type,
    status: "pending",
    referenceNumber: referenceFor(input.kind, now),
    formData: input.formData ?? {},
    createdAt: now.toISOString(),
    history: [{ status: "pending", at: now.toISOString() }],
  };

  const ref = await addDoc(collection(db, "applications"), document);
  // A record of the submission, for the pilgrim's own list. Written after
  // the application so a failure here cannot lose the application itself.
  await notifySubmitted(document.churchId, ref.id, document.type, document.referenceNumber);
  return { ...document, id: ref.id };
}

/**
 * Records a parish's decision.
 *
 * Appends to `history` rather than replacing it, with arrayUnion so two
 * reviewers acting at once cannot erase each other's entry. The rules allow
 * exactly these fields and nothing else, so an attempt to "correct" the
 * applicant's answers while approving is refused by the database, not by
 * this function.
 */
export async function setApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  note?: string,
  /**
   * Who to tell, and about what. Passed in rather than re-read here: the
   * caller is already holding the document, and a second read would be a
   * second chance for the two to disagree.
   */
  applicant?: { uid: string; churchId: string; what: string },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new SubmitError("You are not signed in.");

  const at = new Date().toISOString();
  await updateDoc(doc(db, "applications", applicationId), {
    status,
    reviewedBy: user.uid,
    reviewedAt: at,
    updatedAt: at,
    ...(note ? { adminNote: note } : {}),
    history: arrayUnion({ status, at, by: user.uid, ...(note ? { note } : {}) }),
  });

  if (applicant) {
    await notifyStatusChanged(
      applicant.uid, applicant.churchId, applicationId, applicant.what, status, note,
    );
  }
}

/**
 * True for the statuses that end an application's life.
 *
 * Used to decide whether to offer the decision buttons at all. Re-approving
 * something already completed is not a thing the parish means to do.
 *
 * Delegates rather than repeating the list. The same two statuses are what
 * moves an application into the admin's archive, and two copies of that
 * rule would eventually disagree about one of them - leaving a row the
 * table files as finished but the detail page still offers to decide.
 */
export function isClosed(status: ApplicationStatus): boolean {
  return isArchived(status);
}
