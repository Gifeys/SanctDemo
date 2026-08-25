// Pure search-filter logic for the diocese map's floating search bar,
// extracted so it is unit-testable without a MapLibre instance (the map
// canvas itself can't be inspected in this environment's headless browser —
// see docs/reports/map-prototype-design-swap.md). A substring scan over the
// parish *name only*, case-insensitive, capped at MAX_SEARCH_RESULTS. A
// substring scan is cheaper and more predictable here than any geocoding
// service for 31 records, and it keeps working with no network.
//
// The client's own prototype also matched against `location`, and this port
// originally did too — but this dataset's stand-in for that field,
// `vicariate`, is inferred (nearest vicariate seat), not official, flagged
// `vicariateVerified: false` in diocese-parishes.json. Matching search
// against it meant a guess could silently surface a parish; and because
// results are capped at MAX_SEARCH_RESULTS and kept in input order rather
// than ranked, a real name match could be crowded out of the visible
// results entirely by earlier-indexed parishes that only matched by
// (guessed) vicariate. Restricting matching to the name means search only
// ever surfaces what is actually known, and never buries a genuine name
// match behind a location guess.

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
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, MAX_SEARCH_RESULTS)
}
