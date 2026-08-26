// Search for the diocese map's floating search bar.
//
// Pure and map-free so it is unit-testable without a MapLibre instance (the
// map canvas can't be inspected in this environment's headless browser — see
// docs/reports/map-prototype-design-swap.md).
//
// This replaced a plain substring filter, which failed the moment anyone
// typed the parish's name in a different order, abbreviated it, or misspelled
// it — and, because results were capped in *input order* rather than by
// relevance, could push the parish someone actually wanted off the visible
// list entirely. Everything here is scored first and truncated second.
//
// 31 records means a full scan per keystroke costs nothing, so there is no
// index to build or keep in sync, and no network dependency.

import { haversineMeters, type Coordinates } from './geo'

export interface SearchableParish {
  id: string
  name: string
  location: string
  coordinates?: Coordinates
}

export const MAX_SEARCH_RESULTS = 6

/**
 * Words skipped when building an acronym. "Mary Help of Christians Parish"
 * has to yield MHCP, not MHOCP — nobody writes the "of".
 */
const ACRONYM_STOPWORDS = new Set(['of', 'the', 'and', 'de', 'del', 'la', 'las', 'los', 'ng', 'sa'])

/** Recognises "churches near me" and its common phrasings, including Tagalog. */
const NEAR_ME_PATTERN = /\b(near|nearby|nearest|closest|malapit)\b/i

/**
 * Strips case, accents and punctuation so "Sto. Niño" and "sto nino" compare
 * equal. Parish names in this dataset carry both, and a pilgrim typing on a
 * phone keyboard will produce neither consistently.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value)
  return normalized === '' ? [] : normalized.split(' ')
}

/** "Mary Help of Christians Parish" → "mhcp". */
export function acronymOf(name: string): string {
  return tokenize(name)
    .filter(token => !ACRONYM_STOPWORDS.has(token))
    .map(token => token[0])
    .join('')
}

/**
 * Levenshtein distance, capped.
 *
 * `max` lets the row scan bail as soon as every cell exceeds the budget,
 * which matters because this runs across every parish on every keystroke and
 * most comparisons are hopeless from the second character.
 */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  if (Math.abs(a.length - b.length) > max) return max + 1

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  let current = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    let rowMin = current[0]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution)
      if (current[j] < rowMin) rowMin = current[j]
    }
    if (rowMin > max) return max + 1
    const swap = previous
    previous = current
    current = swap
  }

  return previous[b.length]
}

/**
 * How far a typo may stray before a token stops counting as a match.
 *
 * Scaled to the word's length: a short word gets no latitude, a long one gets
 * two edits. A flat threshold either rejects "chirstians" or lets "mary"
 * match "mass".
 */
function typoBudget(token: string): number {
  if (token.length <= 3) return 0
  if (token.length <= 6) return 1
  return 2
}

// Score bands, spaced so a weaker band can never outrank a stronger one no
// matter how many bonuses accumulate inside it. This is what stops an
// unrelated parish that fuzzily matches a couple of tokens from displacing
// the one whose name literally starts with what was typed.
const SCORE_EXACT_NAME = 10000
const SCORE_ACRONYM = 8000
const SCORE_NAME_PREFIX = 6000
const SCORE_NAME_SUBSTRING = 4000
const SCORE_ALL_TOKENS = 2000
const SCORE_FUZZY = 500

export interface SearchOptions {
  /** The pilgrim's position, used to rank ties and to answer "near me". */
  origin?: Coordinates | null
}

export interface ScoredParish<T> {
  parish: T
  score: number
  distanceMeters: number | null
}

/** True when the query is asking for proximity rather than naming a parish. */
export function isNearMeQuery(query: string): boolean {
  return NEAR_ME_PATTERN.test(query)
}

function scoreParish<T extends SearchableParish>(query: string, parish: T): number {
  const q = normalizeText(query)
  if (q === '') return 0

  const name = normalizeText(parish.name)
  const location = normalizeText(parish.location ?? '')
  const queryTokens = tokenize(query)
  const nameTokens = tokenize(parish.name)
  const haystackTokens = [...nameTokens, ...tokenize(parish.location ?? '')]

  if (name === q) return SCORE_EXACT_NAME

  // Checked before substring: "MHCP" is not a substring of the name, and a
  // pilgrim typing an abbreviation knows exactly which parish they want.
  if (acronymOf(parish.name) === q.replace(/\s/g, '')) return SCORE_ACRONYM

  // A prefix that lands on a word boundary beats one that cuts a word in
  // half. Typing "San" means San Roque, not Santo Niño — both names start
  // with those three letters, but only one of them starts with that *word*,
  // and without this the shorter name wins on the length bonus alone.
  if (name.startsWith(q)) {
    const endsOnBoundary = name.length === q.length || name[q.length] === ' '
    const band = endsOnBoundary ? SCORE_NAME_PREFIX + 500 : SCORE_NAME_PREFIX
    return band + Math.round((q.length / name.length) * 400)
  }
  if (name.includes(q)) {
    const at = name.indexOf(q)
    const startsWord = at === 0 || name[at - 1] === ' '
    const band = startsWord ? SCORE_NAME_SUBSTRING + 500 : SCORE_NAME_SUBSTRING
    return band + Math.round((q.length / name.length) * 400)
  }

  // Every typed word appears somewhere, in any order — "Christians Parish"
  // and "Mary Help Caloocan" both land here. Name hits are weighted above
  // location hits so a parish matched only by its town never outranks one
  // matched by name.
  const tokenHits = queryTokens.map(token => {
    if (nameTokens.some(word => word.startsWith(token))) return 2
    if (name.includes(token)) return 2
    if (location.includes(token)) return 1
    return 0
  })
  if (tokenHits.length > 0 && tokenHits.every(hit => hit > 0)) {
    return SCORE_ALL_TOKENS + tokenHits.reduce((sum, hit) => sum + hit, 0) * 100
  }

  // Last resort: typo tolerance. Every query token has to land near some word
  // in the record, and the score falls off with total edit distance.
  let totalDistance = 0
  for (const token of queryTokens) {
    const budget = typoBudget(token)
    let best = Number.POSITIVE_INFINITY
    for (const word of haystackTokens) {
      const distance = editDistance(token, word, budget)
      if (distance < best) best = distance
      if (best === 0) break
    }
    if (best > budget) return 0
    totalDistance += best
  }
  return SCORE_FUZZY - totalDistance * 50
}

/**
 * Ranked search. Returns at most MAX_SEARCH_RESULTS, best first.
 */
export function searchParishes<T extends SearchableParish>(
  query: string,
  parishes: T[],
  options: SearchOptions = {},
): T[] {
  return searchParishesScored(query, parishes, options).map(result => result.parish)
}

/**
 * As `searchParishes`, but keeps each result's score and distance so the UI
 * can show "0.8 km away".
 *
 * "churches near me" (and similar) short-circuits name scoring entirely and
 * ranks by real geographic distance — but only when a position is known.
 * Without one there is nothing honest to sort by, so it falls through to
 * ordinary matching rather than returning an arbitrary order.
 */
export function searchParishesScored<T extends SearchableParish>(
  query: string,
  parishes: T[],
  { origin }: SearchOptions = {},
): ScoredParish<T>[] {
  if (normalizeText(query) === '') return []

  const withDistance = (parish: T): number | null =>
    origin && parish.coordinates ? haversineMeters(origin, parish.coordinates) : null

  if (isNearMeQuery(query) && origin) {
    return parishes
      .map(parish => ({ parish, score: SCORE_ALL_TOKENS, distanceMeters: withDistance(parish) }))
      .filter((result): result is ScoredParish<T> & { distanceMeters: number } => result.distanceMeters !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_SEARCH_RESULTS)
  }

  return parishes
    .map(parish => ({ parish, score: scoreParish(query, parish), distanceMeters: withDistance(parish) }))
    .filter(result => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Equal relevance: the nearer parish is the more useful answer.
      if (a.distanceMeters !== null && b.distanceMeters !== null) {
        return a.distanceMeters - b.distanceMeters
      }
      return a.parish.name.localeCompare(b.parish.name)
    })
    .slice(0, MAX_SEARCH_RESULTS)
}
