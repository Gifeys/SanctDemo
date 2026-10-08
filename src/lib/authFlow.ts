import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { createProfile, getProfile } from "./userProfile";

/**
 * Account creation, sign-in, verification and the second factor.
 *
 * ## Why the second factor is an email link and not an SMS code
 *
 * Firebase's own multi-factor authentication sends SMS, and it is only
 * available on projects upgraded to Google Cloud Identity Platform - a
 * billing change, plus a per-message cost. This project is on the Spark
 * plan, so that door is shut.
 *
 * What is open is the email sign-in link, which Firebase sends itself for
 * free. Requiring one after the password gives the real property a second
 * factor is for: a stolen password alone does not get you in, because the
 * attacker also has to be reading the inbox. It is weaker than SMS against
 * someone who has already taken over the mailbox, and that is an honest
 * trade rather than a hidden one.
 *
 * The flow is deliberately NOT "password, then optionally a link". The
 * challenge is issued before the session is treated as trusted, and
 * `pendingSecondFactor` is what the app checks - not a boolean the login
 * screen sets for itself.
 *
 * ## Why errors are translated
 *
 * Firebase's codes name internals ("auth/invalid-credential") and, worse,
 * distinguish "no such user" from "wrong password", which tells an attacker
 * which addresses are registered. Everything below collapses to messages
 * that are true, useful, and say no more than the person needs.
 */

/** Where the email link returns to. Must be an Authorized Domain in Firebase. */
function linkSettings() {
  return {
    url: `${window.location.origin}/finish-sign-in`,
    handleCodeInApp: true,
  };
}

const PENDING_EMAIL_KEY = "sanctiwalk.pendingSecondFactorEmail";

export class AuthError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * A Firebase error as something worth showing a person.
 *
 * Unknown codes fall through to a generic line rather than the raw message,
 * because the raw message is written for whoever wrote the SDK.
 */
export function friendlyAuthError(err: unknown): AuthError {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";

  const map: Record<string, string> = {
    // Deliberately identical for all three: telling someone which half was
    // wrong tells them which addresses have accounts.
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/invalid-email": "That does not look like an email address.",
    "auth/email-already-in-use": "An account already exists for that email. Try signing in.",
    "auth/weak-password": "Please choose a password of at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/requires-recent-login": "Please sign in again before changing this.",
    "auth/invalid-action-code": "That link has expired or has already been used.",
    "auth/user-disabled": "This account has been disabled. Please contact your parish.",
    "auth/operation-not-allowed":
      "Email sign-in is not switched on for this app yet. Please contact the parish office.",
    // Firebase Authentication has not been set up on the project at all.
    // Distinct from operation-not-allowed, which means the product exists
    // but this one provider is off.
    "auth/configuration-not-found":
      "Accounts are not set up for this app yet. Please contact the parish office.",
    "auth/admin-restricted-operation":
      "New accounts are currently closed. Please contact the parish office.",
  };

  const known = map[code];
  if (!known) {
    // The generic line is for the person; the code is for whoever has to
    // find out why. Without this, an unmapped failure reads as "Something
    // went wrong" in the UI and leaves nothing at all in the console -
    // which is how a project with Authentication switched off looked
    // exactly like a bug in the form.
    console.error("[auth] unmapped Firebase error:", code || "(no code)", err);
  }

  return new AuthError(known ?? "Something went wrong. Please try again.", code || undefined);
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  churchId: string;
  phoneNumber?: string;
  /** What Home will call them. Optional; falls back to their first name. */
  nickname?: string;
}

/**
 * Creates the account, writes the profile, and sends the verification email.
 *
 * The profile write happens before the verification email so that a person
 * who closes the tab immediately still has an account the admin can see,
 * rather than an auth user with no parish and no name attached to it.
 */
export async function signUp(input: SignUpInput): Promise<User> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
    await createProfile(
      cred.user, input.fullName, input.churchId, input.phoneNumber, input.nickname,
    );
    await sendEmailVerification(cred.user);
    return cred.user;
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthError("You are not signed in.");
  try {
    await sendEmailVerification(user);
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

/** Re-reads the account from Firebase, so a just-clicked link is noticed. */
export async function refreshEmailVerified(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  return auth.currentUser?.emailVerified ?? false;
}

export interface SignInResult {
  user: User;
  /** True when a second factor is still owed. The session is not trusted yet. */
  pendingSecondFactor: boolean;
}

/**
 * Password sign-in, then the second-factor decision.
 *
 * An unverified email short-circuits this: there is no point sending a
 * one-time link to an address nobody has proved they can read.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getProfile(cred.user.uid);

    // Administrators always take the second factor. They can change other
    // people's records, so their password alone is worth more.
    const required = profile?.role === "church_admin" || cred.user.emailVerified;

    return { user: cred.user, pendingSecondFactor: required };
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

/** Sends the one-time sign-in link that completes the second factor. */
export async function sendSecondFactorLink(email: string): Promise<void> {
  try {
    await sendSignInLinkToEmail(auth, email, linkSettings());
    // Needed to finish the link on return: Firebase requires the address to
    // be supplied again, and asking for it twice is a worse experience than
    // remembering it on this device.
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

export function isSecondFactorLink(url: string = window.location.href): boolean {
  return isSignInWithEmailLink(auth, url);
}

/**
 * Finishes the second factor from the link the person clicked.
 *
 * `email` is only asked for when the link is opened on a different device
 * from the one that requested it, which is the case localStorage cannot
 * cover.
 */
export async function completeSecondFactor(email?: string): Promise<User> {
  const stored = email ?? window.localStorage.getItem(PENDING_EMAIL_KEY) ?? "";
  if (!stored) {
    throw new AuthError(
      "Please enter the email address you used, to finish signing in on this device.",
    );
  }
  try {
    const cred = await signInWithEmailLink(auth, stored, window.location.href);
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
    return cred.user;
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    // A reset request deliberately reports success whatever happened: the
    // error distinguishes registered addresses from unregistered ones, and
    // the screen that calls this says "if an account exists, we've sent a
    // link" for the same reason.
    if ((err as { code?: string })?.code !== "auth/user-not-found") {
      throw friendlyAuthError(err);
    }
  }
}

/**
 * Changes the password, proving the current one first.
 *
 * Firebase would demand a recent login anyway; doing it explicitly means the
 * person is asked for their password at the moment it makes sense, rather
 * than being thrown back to the login screen mid-change.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new AuthError("You are not signed in.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, newPassword);
  } catch (err) {
    throw friendlyAuthError(err);
  }
}

export async function signOutNow(): Promise<void> {
  window.localStorage.removeItem(PENDING_EMAIL_KEY);
  await signOut(auth);
}
