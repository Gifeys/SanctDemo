// The shared key the app sends with every backend call.
//
// Once the Express server is deployed it is reachable by anyone who finds the
// URL, and /api/identify spends a real Gemini quota. This header is what
// stops a bot or a passer-by draining it.
//
// Be clear about what this is worth. The key is compiled into the app, so
// anyone willing to unpack the APK can read it. It is a speed bump, not
// authentication: it stops opportunistic and automated abuse, which is the
// realistic threat for a student project with a published URL. Real
// per-user auth would mean signing in before scanning, which the app
// deliberately does not require.
//
// Paired with the per-IP daily cap on the server, the damage one determined
// person can do is bounded.

export const APP_KEY_HEADER = 'X-SanctiWalk-Key'

/**
 * The key for this build, or empty when unset.
 *
 * Unset is the correct state for local development: the server only enforces
 * the key when APP_KEY is set in its own environment, so a developer running
 * both halves locally needs no configuration at all.
 */
export function appKey(): string {
  const configured = import.meta.env?.VITE_APP_KEY
  return typeof configured === 'string' ? configured.trim() : ''
}

/**
 * Adds the key to request headers, leaving them untouched when none is set.
 */
export function withAppKey(headers: Record<string, string> = {}): Record<string, string> {
  const key = appKey()
  return key ? { ...headers, [APP_KEY_HEADER]: key } : { ...headers }
}
