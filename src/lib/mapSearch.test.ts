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

  it('matches a substring of the location', () => {
    const results = searchParishes('cathedral', PARISHES)
    // Matches p2 by name ("San Roque Cathedral") AND by location
    // ("Vicariate of the Cathedral") — both should surface, each once.
    expect(results.map(r => r.id)).toEqual(['p2'])
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
    // All six of p3..p8 are in "Vicariate of Sacred Heart" — the result
    // order should follow the input array, not be resorted.
    const results = searchParishes('sacred heart', PARISHES)
    expect(results.map(r => r.id)).toEqual(['p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(searchParishes('nonexistent parish xyz', PARISHES)).toEqual([])
  })
})
