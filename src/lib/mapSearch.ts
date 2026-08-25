// Pure search-filter logic for the diocese map's floating search bar,
// extracted so it is unit-testable without a MapLibre instance (the map
// canvas itself can't be inspected in this environment's headless browser —
// see docs/reports/map-prototype-design-swap.md). Matches the client's own
// prototype (DioceseMap.jsx's inline results filter): a substring scan over
// name + location, case-insensitive, capped at MAX_SEARCH_RESULTS. A
// substring scan is cheaper and more predictable here than any geocoding
// service for 31 records, and it keeps working with no network.

export interface SearchableParish {
  id: string
  name: string
  location: string
}

export const MAX_SEARCH_RESULTS = 6

export function searchParishes<T extends SearchableParish>(query: string, parishes: T[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return parishes
    .filter(p => (p.name + ' ' + (p.location || '')).toLowerCase().includes(q))
    .slice(0, MAX_SEARCH_RESULTS)
}
