import { describe, expect, it } from 'vitest'
import {
  MAX_SEARCH_RESULTS,
  acronymOf,
  editDistance,
  isNearMeQuery,
  normalizeText,
  searchParishes,
  searchParishesScored,
  type SearchableParish,
} from './mapSearch'

// Shaped like the real records, with real coordinates for the two live
// parishes so distance ranking is exercised against genuine geography
// rather than invented numbers.
const MHCP: SearchableParish = {
  id: 'mhcp',
  name: 'Mary Help of Christians Parish',
  location: 'Caloocan City',
  coordinates: { lat: 14.637702, lng: 120.97344 },
}
const SAN_ROQUE: SearchableParish = {
  id: 'src',
  name: 'San Roque Cathedral Parish',
  location: 'Caloocan City',
  coordinates: { lat: 14.651647, lng: 120.972648 },
}
const STO_NINO: SearchableParish = {
  id: 'sn',
  name: 'Santo Niño Parish',
  location: 'Malabon City',
  coordinates: { lat: 14.6578, lng: 120.9573 },
}
const IMMACULATE: SearchableParish = {
  id: 'ic',
  name: 'Immaculate Conception Parish',
  location: 'Navotas City',
  coordinates: { lat: 14.6605, lng: 120.9412 },
}
const PARISHES = [MHCP, SAN_ROQUE, STO_NINO, IMMACULATE]

const names = (query: string, origin?: { lat: number; lng: number }) =>
  searchParishes(query, PARISHES, { origin }).map(p => p.name)

describe('normalizeText', () => {
  it('strips case, accents and punctuation', () => {
    expect(normalizeText('Santo Niño Parish')).toBe('santo nino parish')
    expect(normalizeText('Sto. Niño')).toBe('sto nino')
    expect(normalizeText('  MARY   HELP  ')).toBe('mary help')
  })
})

describe('acronymOf', () => {
  // The stopword skip is the whole point: MHOCP is not what anyone types.
  it('skips joining words', () => {
    expect(acronymOf('Mary Help of Christians Parish')).toBe('mhcp')
  })

  it('handles names with no stopwords', () => {
    expect(acronymOf('Immaculate Conception Parish')).toBe('icp')
    expect(acronymOf('San Roque Cathedral Parish')).toBe('srcp')
  })
})

describe('editDistance', () => {
  it('counts substitutions, insertions and deletions', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('mary', 'mary')).toBe(0)
    expect(editDistance('', 'abc')).toBe(3)
  })

  // The cap exists for speed, but it must never under-report a distance
  // that is within budget.
  it('reports accurately within the cap and bails beyond it', () => {
    expect(editDistance('christians', 'chirstians', 2)).toBe(2)
    expect(editDistance('mary', 'immaculate', 2)).toBeGreaterThan(2)
  })
})

describe("searchParishes — the client's own examples", () => {
  // Quoted verbatim from the brief. Every one must find Mary Help.
  it.each([
    'Mary Help',
    'Mary Help Christians',
    'Mary Help of Christians',
    'MHCP',
    'Christians Parish',
    'Mary Help Caloocan',
  ])('finds MHCP from %j', query => {
    expect(names(query)[0]).toBe('Mary Help of Christians Parish')
  })
})

describe('searchParishes — matching behaviour', () => {
  it('matches the full name exactly', () => {
    expect(names('Mary Help of Christians Parish')[0]).toBe('Mary Help of Christians Parish')
  })

  it('ignores capitalization', () => {
    expect(names('mARY hELP')[0]).toBe('Mary Help of Christians Parish')
    expect(names('SAN ROQUE')[0]).toBe('San Roque Cathedral Parish')
  })

  it('tolerates words in a different order', () => {
    expect(names('Parish Roque San')[0]).toBe('San Roque Cathedral Parish')
  })

  it('tolerates minor misspellings', () => {
    expect(names('Chirstians')[0]).toBe('Mary Help of Christians Parish')
    expect(names('Imaculate')[0]).toBe('Immaculate Conception Parish')
  })

  it('matches accented names typed without accents', () => {
    expect(names('santo nino')[0]).toBe('Santo Niño Parish')
  })

  it('matches on church plus location', () => {
    expect(names('Roque Caloocan')[0]).toBe('San Roque Cathedral Parish')
  })

  it('returns nothing for an unrelated query', () => {
    expect(names('helicopter')).toEqual([])
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
  })

  it('caps the result count', () => {
    expect(names('parish').length).toBeLessThanOrEqual(MAX_SEARCH_RESULTS)
  })
})

describe('searchParishes — ranking', () => {
  it('keeps location-only matches together and excludes unrelated cities', () => {
    const results = names('Caloocan')
    expect(results.slice(0, 2).sort()).toEqual(
      ['Mary Help of Christians Parish', 'San Roque Cathedral Parish'].sort(),
    )
  })

  it('ranks an exact name first', () => {
    expect(names('Santo Niño Parish')[0]).toBe('Santo Niño Parish')
  })

  // The defect this rewrite exists to fix: results were capped in input
  // order, so a weaker match could crowd out the one actually wanted.
  it('never lets a fuzzy match outrank a literal one', () => {
    const scored = searchParishesScored('Immaculate', PARISHES)
    expect(scored[0].parish.name).toBe('Immaculate Conception Parish')
    expect(scored[0].score).toBeGreaterThan(scored[1]?.score ?? 0)
  })

  it('prefers a whole-word prefix over one that cuts a word in half', () => {
    // Both names begin with the letters "san", but only San Roque begins
    // with that *word*. Without the boundary check the shorter name wins on
    // its length bonus, which is how "San" used to return Santo Nino first.
    const scored = searchParishesScored('San', PARISHES)
    expect(scored[0].parish.name).toBe('San Roque Cathedral Parish')
    expect(scored[1].parish.name).toBe('Santo Niño Parish')
  })

  it('breaks a genuine tie by distance from the pilgrim', () => {
    // Same name, so the name score is identical and only distance can
    // separate them.
    const near = { id: 'near', name: 'Holy Cross Parish', location: 'Caloocan City', coordinates: { lat: 14.6380, lng: 120.9735 } }
    const far = { id: 'far', name: 'Holy Cross Parish', location: 'Navotas City', coordinates: { lat: 14.6700, lng: 120.9400 } }
    const atMHCP = { lat: 14.637702, lng: 120.97344 }
    const scored = searchParishesScored('Holy Cross', [far, near], { origin: atMHCP })
    expect(scored[0].score).toBe(scored[1].score)
    expect(scored[0].parish.id).toBe('near')
  })
})

describe('isNearMeQuery', () => {
  it.each(['churches near me', 'nearby churches', 'nearest church', 'closest parish', 'malapit na simbahan'])(
    'recognises %j',
    query => {
      expect(isNearMeQuery(query)).toBe(true)
    },
  )

  it('does not fire on an ordinary parish name', () => {
    expect(isNearMeQuery('Mary Help of Christians')).toBe(false)
    expect(isNearMeQuery('San Roque')).toBe(false)
  })
})

describe('searchParishes — near me', () => {
  const atMHCP = { lat: 14.637702, lng: 120.97344 }

  it('sorts by real distance from the pilgrim', () => {
    const results = names('churches near me', atMHCP)
    expect(results[0]).toBe('Mary Help of Christians Parish')
    expect(results[1]).toBe('San Roque Cathedral Parish')
  })

  it('reports the distance for each result', () => {
    const scored = searchParishesScored('churches near me', PARISHES, { origin: atMHCP })
    expect(scored[0].distanceMeters).toBeCloseTo(0, 0)
    // San Roque is ~1.5km north of Mary Help.
    expect(scored[1].distanceMeters!).toBeGreaterThan(1000)
    expect(scored[1].distanceMeters!).toBeLessThan(2500)
  })

  // Without a fix there is nothing honest to sort by, so it must not invent
  // an order and present it as proximity.
  it('falls back to ordinary matching when no position is known', () => {
    expect(names('churches near me')).toEqual([])
  })

  it('still answers a named search while a position is known', () => {
    expect(names('MHCP', atMHCP)[0]).toBe('Mary Help of Christians Parish')
  })
})
