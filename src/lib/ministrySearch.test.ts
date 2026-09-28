import { describe, expect, it } from 'vitest'
import { acronymOf, normalize, searchMinistries, suggestionsFor } from './ministrySearch'
import type { Ministry } from '../data'

const MINISTRIES: Ministry[] = [
  {
    id: 'min-altar-servers',
    name: 'Ministry of Altar Servers (MAS)',
    description: 'Paglilingkod sa dambana ng Panginoon.',
    requirements: [],
  },
  {
    id: 'min-emhc',
    name: 'Extraordinary Ministers of Holy Communion (EMHC)',
    description: 'Sumusuporta sa pari sa pagbibigay ng Komunyon.',
    requirements: [],
  },
  {
    id: 'min-choir-marian-youth',
    name: 'Marian Youth Choir',
    description: 'Nangangasiwa sa angkop na paggamit ng musika sa liturhiya.',
    requirements: [],
  },
  {
    id: 'min-catechetical',
    name: 'Catechetical Ministry',
    description: 'Ituro ang mga saligan ng pananampalatayang Katoliko.',
    requirements: [],
  },
]

describe('normalize', () => {
  it('strips accents so a tilde is not needed on a phone keyboard', () => {
    expect(normalize('Santo Niño')).toBe('santo nino')
  })

  it('flattens punctuation to spaces', () => {
    expect(normalize('Lectors and Commentators (MLC)')).toBe('lectors and commentators mlc')
  })
})

describe('acronymOf', () => {
  it('takes the bracketed short name the parish actually says', () => {
    expect(acronymOf('Extraordinary Ministers of Holy Communion (EMHC)')).toBe('emhc')
  })

  it('ignores a bracketed category', () => {
    // "(choir)" describes a kind of ministry. Treated as a short name, every
    // choir would answer to the word twice and rank oddly.
    expect(acronymOf('Teatro Pilipino Choir (choir)')).toBe('')
  })

  it('is empty when there is no bracket', () => {
    expect(acronymOf('Catechetical Ministry')).toBe('')
  })
})

describe('searchMinistries', () => {
  it('returns everything for an empty query', () => {
    expect(searchMinistries(MINISTRIES, '   ')).toHaveLength(4)
  })

  it('matches a word anywhere in the name, not just the start', () => {
    const hits = searchMinistries(MINISTRIES, 'servers')
    expect(hits.map(m => m.id)).toEqual(['min-altar-servers'])
  })

  it('matches the acronym people say out loud', () => {
    expect(searchMinistries(MINISTRIES, 'emhc').map(m => m.id)).toEqual(['min-emhc'])
  })

  it('matches words only in the description', () => {
    // "musika" appears in no ministry NAME, which is the whole point.
    expect(searchMinistries(MINISTRIES, 'musika').map(m => m.id)).toEqual(['min-choir-marian-youth'])
  })

  it('ignores case and accents', () => {
    expect(searchMinistries(MINISTRIES, 'PANGINOON').map(m => m.id)).toEqual(['min-altar-servers'])
  })

  it('requires every term, but lets them match different fields', () => {
    // "youth" is in the name, "musika" only in the description.
    expect(searchMinistries(MINISTRIES, 'youth musika').map(m => m.id))
      .toEqual(['min-choir-marian-youth'])
  })

  it('finds nothing for a word nobody uses', () => {
    expect(searchMinistries(MINISTRIES, 'basketball')).toHaveLength(0)
  })
})

describe('suggestionsFor', () => {
  it('only suggests things that would actually find something', () => {
    // A suggestion that leads to an empty screen is worse than no
    // suggestion, so each is checked against the ministries present.
    for (const chip of suggestionsFor(MINISTRIES)) {
      expect(searchMinistries(MINISTRIES, chip).length).toBeGreaterThan(0)
    }
  })

  it('drops a suggestion this parish has no ministry for', () => {
    const onlyAltar = [MINISTRIES[0]]
    expect(suggestionsFor(onlyAltar)).not.toContain('Choir')
  })
})
