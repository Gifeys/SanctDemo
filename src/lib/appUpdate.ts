/**
 * Telling an installed SanctiWalk that a newer one exists.
 *
 * ## Why this is needed at all
 *
 * SanctiWalk is handed out as an APK from its own download page, not
 * through Google Play, so nothing updates it. Parish content does not
 * need this - Mass times, announcements and availability stream from
 * Firestore and change under the running app - but a code change does,
 * and until now the only way anyone would learn of one is if somebody
 * told them to go and download it again.
 *
 * ## How the version is known on both sides
 *
 * One number, from package.json, used twice. Vite bakes it into the web
 * bundle as __APP_VERSION__, and the Android build reads the same field
 * for versionName and derives versionCode from it. They cannot drift,
 * because there is only one of them.
 *
 * The published copy is a small JSON file written beside the APK at
 * build time. A static file rather than an endpoint on the backend:
 * the backend sleeps when idle and takes several seconds to wake, and
 * an update check is the last thing that should keep somebody waiting
 * at a church door.
 */

/** Shape of /download/latest.json, written by tools/write-latest-version. */
export interface LatestRelease {
  versionName: string
  versionCode: number
  /** Where the APK is, as an absolute or site-relative URL. */
  url: string
  /** Optional one-line summary shown in the banner. */
  notes?: string
}

/**
 * major.minor.patch as one integer, the same way build.gradle does it.
 *
 * Comparing version STRINGS is the classic way to get this wrong: by
 * string order "1.10.0" sorts before "1.9.0", so the update that
 * mattered would be the one never offered.
 */
export function versionCodeOf(versionName: string): number {
  const parts = versionName.trim().split('.')
  if (parts.length !== 3) return 0

  const nums = parts.map(p => (/^\d+$/.test(p) ? Number(p) : NaN))
  if (nums.some(n => !Number.isFinite(n))) return 0

  return nums[0] * 10000 + nums[1] * 100 + nums[2]
}

/**
 * Whether what is published is newer than what is running.
 *
 * Strictly newer. Equal is not an update, and a published version OLDER
 * than the installed one is not either - that happens while a deploy is
 * half-rolled-out, and offering a downgrade would be worse than silence
 * because Android will refuse to install it.
 */
export function isNewer(installed: string, latest: LatestRelease | null): boolean {
  if (!latest) return false

  const here = versionCodeOf(installed)
  // Trust the published code where there is one; fall back to its name.
  const there = Number.isFinite(latest.versionCode) && latest.versionCode > 0
    ? latest.versionCode
    : versionCodeOf(latest.versionName ?? '')

  if (here === 0 || there === 0) return false
  return there > here
}

/**
 * Reads the published release, or null.
 *
 * Every failure is null and none of them are reported to the pilgrim.
 * An update check is a courtesy; a church with bad signal must not show
 * somebody an error about one.
 */
export async function fetchLatest(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatestRelease | null> {
  try {
    const response = await fetchImpl(url, { cache: 'no-store' })
    if (!response.ok) return null

    const data: unknown = await response.json()
    if (!data || typeof data !== 'object') return null

    const record = data as Record<string, unknown>
    const versionName = typeof record.versionName === 'string' ? record.versionName : ''
    const apkUrl = typeof record.url === 'string' ? record.url : ''
    if (!versionName || !apkUrl) return null

    return {
      versionName,
      versionCode: typeof record.versionCode === 'number' ? record.versionCode : 0,
      url: apkUrl,
      notes: typeof record.notes === 'string' ? record.notes : undefined,
    }
  } catch {
    return null
  }
}

/** Key for the version a pilgrim has already been offered and declined. */
const DISMISSED_KEY = 'sanctiwalk.update.dismissed'

/**
 * Whether this exact version has already been turned down.
 *
 * Asked once per release, not once per launch. Somebody who taps "Later"
 * has answered the question, and asking again every time they open the
 * app is how a helpful prompt becomes the reason they stop opening it.
 * A NEWER release asks again, because that is a different question.
 */
export function wasDismissed(versionName: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === versionName
  } catch {
    return false
  }
}

export function dismiss(versionName: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, versionName)
  } catch {
    /* private mode; it will ask again, which is the harmless failure */
  }
}
