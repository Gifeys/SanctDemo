// The pilgrim's home parish, chosen once on first run and remembered
// thereafter. Follows the same shape as src/lib/rosarySettings.ts (typed
// module, single localStorage key, safe fallback on missing/corrupt data),
// but deliberately uses a *different* key — this is not rosary data and
// must not collide with it.
//
// Unlike rosary settings, the set of valid values isn't a fixed enum: it's
// whatever live parish ids exist in ROUTES at the time of validation. So the
// loader takes the caller's current list of valid ids rather than hardcoding
// them here, keeping this module decoupled from ../data.

export const HOME_PARISH_KEY = "sanctiwalk.homeParish";

/**
 * Never throws. Returns null when nothing is stored, the stored value is
 * malformed, or it no longer matches a known parish id (e.g. diocese data
 * changed underneath a stale localStorage entry).
 */
export function loadHomeParishId(validParishIds: readonly string[]): string | null {
  try {
    const raw = localStorage.getItem(HOME_PARISH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "string" || !parsed) return null;
    return validParishIds.indexOf(parsed) !== -1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveHomeParishId(parishId: string): void {
  try {
    localStorage.setItem(HOME_PARISH_KEY, JSON.stringify(parishId));
  } catch {
    // Storage may be unavailable (private mode, quota, etc). The choice
    // still applies for this session via React state.
  }
}
