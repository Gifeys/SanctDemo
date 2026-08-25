import { describe, it, expect } from 'vitest'
import { searchParishes, MAX_SEARCH_RESULTS, type SearchableParish } from './mapSearch'

const PARISHES: SearchableParish[] = [
  { id: 'p1', name: 'Mary Help of Christians Parish', location: 'Vicariate of Our Lady' },
  { id: 'p2', name: 'San Roque Cathedral', location: 'Vicariate of the Cathedral' },
  { id: 'p3', name: 'Birhen ng Lourdes Parish', location: 'Vicariate of Sacred Heart' },
  { id: 'p4', name: 'Sacred Heart Parish', location: 'Vicariate of Sacred Heart' },
  { id: 'p5', name: 'Santo Nino Parish', location: 'Vicariate of Sacred Heart' },
  { id: 'p6', name: 'San Isidro Parish', location: 'Vicariate of Sacred Heart' },
  { id: 'p7', name: 'San Jose Parish', location: 'Vicariate of Sacred Heart' },
  { id: 'p8', name: 'San Pedro Parish', location: 'Vicariate of Sacred Heart' },
]

describe('searchParishes', () => {
  it('returns nothing for an empty query', () => {
    expect(searchParishes('', PARISHES)).toEqual([])
    expect(searchParishes('   ', PARISHES)).toEqual([])
  })

  it('matches a substring of the parish name', () => {
    const results = searchParishes('mary help', PARISHES)
    expect(results.map(r => r.id)).toEqual(['p1'])
  })

  it('does not match on location — vicariate is unverified data', () => {
    // p2 matches "cathedral" by name ("San Roque Cathedral"); every other
    // parish's location also contains "Vicariate of the Cathedral"/"Sacred
    // Heart" etc, but those must NOT surface — vicariate is an inferred
    // guess (vicariateVerified: false in diocese-parishes.json), and search
    // must never present a guess as if it were a known fact.
    const results = searchParishes('cathedral', PARISHES)
    expect(results.map(r => r.id)).toEqual(['p2'])

    // "vicariate" appears in every parish's *location* and in no parish's
    // name — nothing should match now that location is excluded.
    expect(searchParishes('vicariate', PARISHES)).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(searchParishes('SAN ROQUE', PARISHES).map(r => r.id)).toEqual(['p2'])
    expect(searchParishes('SaN rOqUe', PARISHES).map(r => r.id)).toEqual(['p2'])
  })

  it('trims surrounding whitespace before matching', () => {
    expect(searchParishes('  san roque  ', PARISHES).map(r => r.id)).toEqual(['p2'])
  })

  it('caps results at MAX_SEARCH_RESULTS', () => {
    expect(MAX_SEARCH_RESULTS).toBe(6)
    const results = searchParishes('parish', PARISHES)
    expect(results.length).toBe(MAX_SEARCH_RESULTS)
  })

  it('preserves input order among matches', () => {
    // p2 ("San Roque"), p5 ("Santo Nino" — "san" is a substring of "santo"),
    // p6, p7, p8 (all "San …") all contain "san" in their name — the result
    // order should follow the input array, not be resorted.
    const results = searchParishes('san', PARISHES)
    expect(results.map(r => r.id)).toEqual(['p2', 'p5', 'p6', 'p7', 'p8'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(searchParishes('nonexistent parish xyz', PARISHES)).toEqual([])
  })
})
