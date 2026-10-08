import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { UserProfile } from "../types";

/**
 * The account document at users/{uid}.
 *
 * ## What this module is careful about
 *
 * `role` and `churchId` are what the security rules read to decide what an
 * account may touch. The rules refuse to let an account change either one
 * after creation, and refuse to let it create itself as anything but
 * "user" - so this module can never grant a privilege, only record a choice
 * the rules already allow. That is deliberate: if the only way to become an
 * admin is a write the client is forbidden to make, there is no client bug
 * that can make someone an admin.
 *
 * `emailVerified` is mirrored here for display. It is NOT the source of
 * truth and the rules never read it; Firebase Auth is. A mirror is only as
 * honest as whoever last refreshed it, and the one place that must not be
 * guessed is whether someone proved they own an address.
 */

/** A new account, as the rules will accept it. */
export async function createProfile(
  user: User,
  fullName: string,
  churchId: string,
  phoneNumber?: string,
  nickname?: string,
): Promise<void> {
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    fullName,
    churchId,
    // Never true at creation - the rules reject a profile that claims it,
    // and claiming it is the one thing phone verification exists to prevent.
    phoneVerified: false,
    emailVerified: user.emailVerified,
    role: "user",
    createdAt: new Date().toISOString(),
    points: 0,
    steps: 0,
    completedStations: [],
    badges: [],
  };
  if (phoneNumber) profile.phoneNumber = phoneNumber;
  // Falls back to the first word of the full name rather than to the
  // email address, which is what Home used to greet people with.
  profile.nickname = (nickname?.trim() || fullName.trim().split(/\s+/)[0] || "").slice(0, 24);

  await setDoc(doc(db, "users", user.uid), profile);
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/**
 * The fields an account may change about itself.
 *
 * Typed as a subset rather than Partial<UserProfile> so that passing `role`
 * or `churchId` is a compile error here, instead of a permission error in
 * front of the user. The rules would refuse it either way; this refuses it
 * earlier and more legibly.
 */
export type EditableProfile = Partial<
  Pick<
    UserProfile,
    | "fullName"
    | "nickname"
    | "photoUrl"
    | "phoneNumber"
    | "points"
    | "steps"
    | "completedStations"
    | "badges"
  >
>;

export async function updateProfile(uid: string, changes: EditableProfile): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { ...changes, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/**
 * Brings the mirrored emailVerified flag up to date with Firebase Auth.
 *
 * Called after a reload() of the auth user, because Firebase does not tell
 * the app when someone clicks the link in their inbox - the flag only
 * changes on the next token refresh.
 *
 * Writing this requires the field to be in the rules' editable list, which
 * it deliberately is not. So the write is attempted and allowed to fail:
 * the display falls back to Firebase Auth's own value, which is the truth
 * anyway. Silently wrong UI would be worse than a mirror that lags.
 */
export async function syncEmailVerified(user: User): Promise<boolean> {
  const verified = user.emailVerified;
  try {
    await setDoc(doc(db, "users", user.uid), { emailVerified: verified }, { merge: true });
  } catch {
    /* The rules own this field. Auth remains the source of truth. */
  }
  return verified;
}

/** True when this account administers a church. Display only - rules decide. */
export function isChurchAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "church_admin";
}

export { serverTimestamp };
