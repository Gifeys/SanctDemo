// The link between the two id spaces this app carries.
//
// `diocese-parishes.json` identifies all 31 parishes as `parish-<slug>`.
// `data.ts` identifies the two with a tour, schedule and history as
// `route-mhcp` / `route-src`. Nothing in either file points at the other, so
// the correspondence has to be written down — and it belongs in exactly one
// place.
//
// It was previously written out inline in four components, each with the
// `parish-` prefix missing. Every lookup silently missed: the Home hero
// never found a Mass time even standing at Mary Help, search's "Mass soon"
// filter never matched anything, and the church page lost its vicariate and
// founding date. Nothing threw — the code simply behaved as though the two
// documented parishes had no data, which is indistinguishable from the state
// the other 29 are genuinely in.
//
// Hence assertKnownParishIds below: a typo here now fails loudly in
// development instead of quietly degrading into "no data collected yet".

import parishData from '../data/diocese-parishes.json'

const PARISHES = (parishData as { parishes: { id: string; status?: string }[] }).parishes

/** Diocese parish id → the id of its tour in data.ts. */
export const PARISH_TO_ROUTE: Record<string, string> = {
  'parish-mary-help-of-christians-parish': 'route-mhcp',
  'parish-san-roque-cathedral': 'route-src',
}

/** The reverse: tour id → diocese parish id. */
export const ROUTE_TO_PARISH: Record<string, string> = Object.fromEntries(
  Object.entries(PARISH_TO_ROUTE).map(([parishId, routeId]) => [routeId, parishId]),
)

/** The tour for a diocese parish, or null for the 29 without one. */
export function routeIdForParish(parishId: string | null | undefined): string | null {
  return parishId ? (PARISH_TO_ROUTE[parishId] ?? null) : null
}

/** The diocese record's id for a tour. */
export function parishIdForRoute(routeId: string | null | undefined): string | null {
  return routeId ? (ROUTE_TO_PARISH[routeId] ?? null) : null
}

/**
 * Fails loudly when a key above does not exist in the parish data, or when a
 * parish marked live has no tour mapped to it.
 *
 * Called once at startup in development. The failure this guards is not a
 * crash but a silence: a stale or mistyped id makes a documented parish look
 * undocumented, and every screen dutifully renders "not collected yet".
 */
export function assertKnownParishIds(): void {
  const known = new Set(PARISHES.map(p => p.id))

  for (const parishId of Object.keys(PARISH_TO_ROUTE)) {
    if (!known.has(parishId)) {
      throw new Error(
        `parishIds: "${parishId}" is not a parish in diocese-parishes.json. ` +
          `Mass times, distances and the parish page will all silently show as uncollected. ` +
          `Ids look like "parish-san-roque-cathedral".`,
      )
    }
  }

  for (const parish of PARISHES) {
    if (parish.status === 'live' && !PARISH_TO_ROUTE[parish.id]) {
      throw new Error(
        `parishIds: "${parish.id}" is marked live in diocese-parishes.json but has no tour ` +
          `mapped to it, so its schedule and history will never be found.`,
      )
    }
  }
}
