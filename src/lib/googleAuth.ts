import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { isNativeApp } from './speech'

/**
 * Signing in with a Google account.
 *
 * ## Why there are two routes and not one
 *
 * Google refuses OAuth requests that come from an embedded webview and
 * answers `disallowed_useragent`. Capacitor runs the app inside exactly
 * such a webview, so `signInWithPopup` in the APK does not degrade
 * gracefully - it shows the pilgrim a Google error page.
 *
 * So the installed app uses Android's own account picker through the
 * native plugin and then hands the resulting credential to the
 * JavaScript SDK, which is the SDK the rest of the app and every
 * Firestore rule actually reads. A browser keeps the popup, which is
 * the right flow there.
 *
 * ## Why a parish still has to be chosen
 *
 * Google supplies an email address and a name. It does not know which
 * parish somebody belongs to, and the security rules refuse an
 * application whose submitter has no `churchId`. A Google account
 * therefore cannot be a complete profile on its own: the parish the
 * app is currently showing is recorded as a starting point, exactly as
 * it is for a pilgrim who never signs in, and Me > Change Parish moves
 * it. That is the same deliberate decision as the absent first-run
 * picker, not a new guess.
 */

export type SignInRoute = 'native' | 'popup'

/** Which flow this device must use. */
export function signInRoute(native: boolean): SignInRoute {
  return native ? 'native' : 'popup'
}

/** The fields of a profile this module reads to decide if it is usable. */
export interface ProfileLike {
  uid: string
  churchId?: string
}

/**
 * Whether this account still needs a profile written for it.
 *
 * A profile with no parish counts as missing. It exists, but the rules
 * will refuse every application made from it, so treating it as
 * complete would leave the pilgrim unable to apply for anything with no
 * explanation.
 */
export function needsProfile(profile: ProfileLike | null): boolean {
  if (!profile) return true
  return !profile.churchId
}

export interface GoogleUserLike {
  uid: string
  email: string | null
  displayName: string | null
}

/** The profile to write for somebody whose first sign-in was Google. */
export function googleProfileFrom(user: GoogleUserLike, churchId: string) {
  const email = user.email ?? ''
  // The email's first word is the fallback, which is how somebody came
  // to be greeted as "sanctiwalk" on their own home screen once.
  const fullName = user.displayName?.trim() || email.split('@')[0] || 'Pilgrim'
  return {
    uid: user.uid,
    email,
    fullName,
    // Home greets you by one name, not three.
    nickname: fullName.split(/\s+/)[0],
    churchId,
    role: 'user' as const,
    // Google verifies an email address. It does not verify a phone, and
    // the rules reject a profile that claims otherwise.
    phoneNumber: '',
    phoneVerified: false,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Signs in with Google and returns the Firebase user.
 *
 * The native branch deliberately signs in TWICE: once natively, which
 * is what opens the account picker, and once in the JavaScript SDK with
 * the credential that returns. Without the second call `auth.currentUser`
 * stays null, and every Firestore read in the app is made as a signed-out
 * visitor while the pilgrim looks at their own name on screen.
 */
export async function signInWithGoogle(): Promise<User> {
  if (signInRoute(isNativeApp()) === 'native') {
    const result = await FirebaseAuthentication.signInWithGoogle()
    const idToken = result.credential?.idToken
    if (!idToken) {
      throw new Error('Google did not return a sign-in token. Please try again.')
    }
    const credential = GoogleAuthProvider.credential(idToken)
    const signed = await signInWithCredential(auth, credential)
    return signed.user
  }

  const provider = new GoogleAuthProvider()
  // Always ask which account. Silently reusing the last one is wrong on
  // a shared phone, and parish devices are shared.
  provider.setCustomParameters({ prompt: 'select_account' })
  const signed = await signInWithPopup(auth, provider)
  return signed.user
}

/**
 * Writes the profile for a first Google sign-in, and leaves an existing
 * one alone.
 *
 * Returns true when a profile was created, so the caller can tell a new
 * pilgrim which parish they have been placed in rather than letting
 * them discover it.
 */
export async function ensureGoogleProfile(
  user: User,
  churchId: string,
): Promise<boolean> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data() as ProfileLike) : null
  if (!needsProfile(existing)) return false

  // merge, not overwrite: a profile that exists but lacks a parish keeps
  // whatever else it already holds.
  await setDoc(ref, googleProfileFrom(user, churchId), { merge: true })
  return true
}

/** Signs out of both SDKs, so the native session does not outlive the web one. */
export async function signOutGoogle(): Promise<void> {
  if (isNativeApp()) {
    try {
      await FirebaseAuthentication.signOut()
    } catch {
      // Not signed in natively. Nothing to undo.
    }
  }
}
