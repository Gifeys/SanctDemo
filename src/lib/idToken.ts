/**
 * The signed-in user's identity token, for calls the backend must trust.
 *
 * The scanner's allowance is twenty a day per person per parish, and
 * the server has to know which person without taking the client's word
 * for it. A Firebase ID token is signed by Google and verified by the
 * Admin SDK on the other side, so a forged one cannot pass and a user
 * cannot mint themselves a second identity to get a second twenty.
 *
 * Deliberately not cached here. The SDK already caches the token and
 * refreshes it when it is close to expiring; caching it again in app
 * code is how a request ends up presenting a token that expired four
 * minutes ago and gets a 401 nobody can explain.
 */
import { auth } from './firebase'

/** The current user's token, or null when nobody is signed in. */
export async function idToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    // Offline, or the account was disabled while the app was open.
    // Null reads as "not signed in", which is the right thing for the
    // caller to do about it either way.
    return null
  }
}

/** Whether anyone is signed in at all, for deciding what to show. */
export function isSignedIn(): boolean {
  return auth.currentUser !== null
}
