import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { MEMBERSHIPS, membershipId, type MembershipDoc, type RegistrationType } from "./memberships";

/**
 * Reading and writing memberships.
 *
 * Separate from memberships.ts so every rule about who belongs to what
 * stays testable without Firebase. This file is only the part that
 * cannot be: the four calls that touch the database.
 */

/** One person's memberships, live. Returns the unsubscribe. */
export function watchMyMemberships(
  uid: string,
  onRows: (rows: MembershipDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, MEMBERSHIPS), where("uid", "==", uid)),
    snap => onRows(snap.docs.map(d => d.data() as MembershipDoc)),
    error => onError?.(error),
  );
}

/** Every membership in one parish, live. For the admin side. */
export function watchParishMemberships(
  churchId: string,
  onRows: (rows: MembershipDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, MEMBERSHIPS), where("churchId", "==", churchId)),
    snap => onRows(snap.docs.map(d => d.data() as MembershipDoc)),
    error => onError?.(error),
  );
}

export interface GrantInput {
  uid: string;
  churchId: string;
  itemId: string;
  ministryName: string;
  registrationType: RegistrationType;
  applicationId: string;
}

/**
 * Records that somebody belongs to a ministry.
 *
 * set(), not add(): the id is derived from the person and the ministry,
 * so approving twice writes the same row twice rather than making two.
 * Two admins approving at the same moment is therefore harmless.
 */
export async function grantMembership(input: GrantInput): Promise<void> {
  const admin = auth.currentUser;
  if (!admin) throw new Error("You are not signed in.");

  const membership: MembershipDoc = {
    uid: input.uid,
    churchId: input.churchId,
    itemId: input.itemId,
    ministryName: input.ministryName,
    registrationType: input.registrationType,
    applicationId: input.applicationId,
    approvedAt: new Date().toISOString(),
    approvedBy: admin.uid,
  };

  await setDoc(doc(db, MEMBERSHIPS, membershipId(input.uid, input.itemId)), membership);
}

/**
 * Takes one membership away.
 *
 * The id names the person AND the ministry, so this cannot reach
 * somebody's other memberships even by mistake - which is the parish's
 * requirement, enforced by the shape of the key rather than by a
 * filter somebody could get wrong.
 *
 * The application is untouched. Its history is the audit trail of what
 * was decided and when, and withdrawing a membership does not unmake
 * the decision that granted it.
 */
export async function revokeMembership(uid: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, MEMBERSHIPS, membershipId(uid, itemId)));
}
