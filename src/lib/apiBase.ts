// Where the Express backend lives.
//
// On the web, SanctiWalk is served BY that backend, so "/api/identify" is a
// relative path to the same origin and everything just works. Packaged as an
// Android app it is not: the APK serves its own files from a local scheme,
// there is no server at its origin, and every relative /api call 404s.
//
// So the base URL becomes a build-time setting. Set VITE_API_BASE when
// building the APK and leave it unset for the web build.
//
// Worth being clear about what this does and does not affect. The features
// behind these calls - AI recognition, the emailer - need the internet
// regardless, because they reach Gemini and an SMTP server. Bundling the app
// into an APK makes the app shell, the parish data, the Rosary and the
// station content work offline; it was never going to make the AI work
// offline. This setting only decides WHERE the server is, not whether one is
// needed.
//
// Pure and dependency-free so the joining rules can be tested.

/**
 * Base URL for backend calls. Empty string means "same origin as this page",
 * which is correct for the web build.
 */
export function apiBase(): string {
  const configured = import.meta.env?.VITE_API_BASE
  return typeof configured === 'string' ? configured.trim().replace(/\/+$/, '') : ''
}

/**
 * Joins a backend path onto the base.
 *
 * Takes the path exactly as it is written at the call site ("/api/identify")
 * so the change is invisible on the web and every call site reads the same as
 * before.
 */
export function apiUrl(path: string): string {
  const base = apiBase()
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
