import { ROUTES } from '../data'
import type { Route, Station } from '../types'

/**
 * Turning a scanned QR code into the station it names.
 *
 * The codes themselves already existed — `Station.qrCode` in types.ts, with a
 * value on all five stations in data.ts — but nothing ever read one. MapTab
 * printed the code on screen as text and that was the whole of it. This is the
 * part that was missing.
 *
 * Kept separate from the camera and the decoder so the matching rules can be
 * tested without either, the same way mapSearch.ts and parishIds.ts are.
 */

export interface StationMatch {
  station: Station
  /** The tour this station belongs to, e.g. "route-mhcp". */
  routeId: string
  route: Route
}

/**
 * What a scanned code turned out to be.
 *
 * `unknown` is deliberately distinct from `not-a-sanctiwalk-code`: one is a
 * SanctiWalk code for a station this build does not carry (a poster printed
 * for a parish whose content has not shipped yet), the other is somebody's
 * wifi password or a shop's payment code. A pilgrim who scanned the parish's
 * own poster and is told "that isn't a SanctiWalk code" will reasonably
 * conclude the app is broken.
 */
export type QrScanResult =
  | { kind: 'station'; match: StationMatch }
  | { kind: 'unknown-station'; code: string }
  | { kind: 'not-ours'; raw: string }

/**
 * Pulls the station code out of whatever the QR actually encoded.
 *
 * Parish posters should carry a URL rather than a bare code, because a bare
 * code does nothing at all in a phone's built-in camera app — the overwhelming
 * majority of scans. A URL opens the app (or the web app) and still works for
 * someone who has never installed anything. So both forms are accepted:
 *
 *   MHCP-ALTAR
 *   https://sanctiwalk.app/s/MHCP-ALTAR
 *   sanctiwalk://station/MHCP-ALTAR
 *
 * Case and surrounding whitespace are ignored: printers, laminators and
 * hand-typed codes are not careful about either.
 */
export function extractStationCode(raw: string): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  // The last non-empty path segment of a URL, or the whole string otherwise.
  // Query strings and fragments are dropped — a poster's code may well carry
  // a campaign parameter appended by whoever generated the QR.
  const withoutQuery = trimmed.split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  const candidate = segments.length > 0 ? segments[segments.length - 1] : withoutQuery

  const normalized = candidate.trim().toUpperCase()

  // Station codes are letters, digits and hyphens. Anything else — a wifi
  // string, a payment code, a sentence — is not one of ours.
  return /^[A-Z0-9][A-Z0-9-]*$/.test(normalized) ? normalized : null
}

/** True for a code shaped like one of ours, whether or not it is known. */
export function looksLikeStationCode(code: string): boolean {
  // Two hyphen-separated parts: a parish prefix and a station name.
  return /^[A-Z0-9]+-[A-Z0-9-]+$/.test(code)
}

/** Finds the station a code names, across every route. */
export function findStationByCode(code: string): StationMatch | null {
  const wanted = code.trim().toUpperCase()

  for (const route of ROUTES) {
    for (const station of route.stations ?? []) {
      if ((station.qrCode ?? '').trim().toUpperCase() === wanted) {
        return { station, routeId: route.id, route }
      }
    }
  }

  return null
}

/**
 * The whole job: a raw decoded QR payload in, a decision out.
 *
 * Never throws and never guesses. A code it cannot place is reported as
 * exactly that, so the scanner can say something true rather than opening the
 * nearest station and hoping.
 */
export function resolveScannedQr(raw: string): QrScanResult {
  const code = extractStationCode(raw)
  if (!code) return { kind: 'not-ours', raw: (raw ?? '').trim() }

  const match = findStationByCode(code)
  if (match) return { kind: 'station', match }

  return looksLikeStationCode(code)
    ? { kind: 'unknown-station', code }
    : { kind: 'not-ours', raw: (raw ?? '').trim() }
}

/** Every station code this build knows, for the admin's poster sheet. */
export function allStationCodes(): { code: string; station: string; parish: string }[] {
  return ROUTES.flatMap(route =>
    (route.stations ?? [])
      .filter(station => station.qrCode)
      .map(station => ({
        code: station.qrCode,
        station: station.name,
        parish: route.name.replace(' Guide', '').replace(' Tour', ''),
      })),
  )
}
