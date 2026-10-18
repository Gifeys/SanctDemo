import { describe, expect, it } from 'vitest'
import {
  freshnessNote,
  groundingBlock,
  isGap,
  itemFacts,
  liveTimesFor,
  massFact,
  offersItem,
  type Fact,
} from './sanctiGrounding'
import type { ParishContent } from './parishContent'

const compiled = [{ day: 'Sunday', time: '6:00 AM, 9:00 AM' }]

describe('massFact', () => {
  it("prefers the parish's own schedule over the compiled one", () => {
    // The whole point of the admin portal. A parish that moves its Mass
    // must not be contradicted by a schedule baked into the bundle.
    const content = {
      massSchedule: [{ day: 'Sunday', time: '7:00 AM' }],
      updatedAt: '2026-10-01T00:00:00.000Z',
    } as ParishContent

    const f = massFact(content, compiled)
    expect(isGap(f)).toBe(false)
    if (isGap(f)) return
    expect(f.value).toContain('7:00 AM')
    expect(f.value).not.toContain('6:00 AM')
    expect(f.source).toBe('parish')
    expect(f.updatedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('falls back to compiled data and says so', () => {
    // Still a usable answer, but it must not be presented as the
    // parish office's own word.
    const f = massFact(null, compiled)
    expect(isGap(f)).toBe(false)
    if (isGap(f)) return
    expect(f.source).toBe('app')
    expect(f.updatedAt).toBeUndefined()
  })

  it('is a gap, not an empty answer, when nothing is published', () => {
    const f = massFact(null, [])
    expect(isGap(f)).toBe(true)
    if (!isGap(f)) return
    expect(f.reason).toMatch(/no mass schedule/i)
  })

  it('treats an empty parish schedule as no entry, not as a cancelled day', () => {
    // An admin who has opened the page but saved nothing has not
    // abolished Mass; the compiled schedule is still the better answer.
    const content = { massSchedule: [] } as unknown as ParishContent
    const f = massFact(content, compiled)
    expect(isGap(f)).toBe(false)
    if (isGap(f)) return
    expect(f.source).toBe('app')
  })

  it('leaves out times the parish has suspended', () => {
    const content = {
      massSchedule: [{ day: 'Sunday', time: '6:00 AM, 9:00 AM', suspended: ['6:00 AM'] }],
    } as unknown as ParishContent

    const f = massFact(content, compiled)
    if (isGap(f)) throw new Error('expected a fact')
    expect(f.value).toContain('9:00 AM')
    expect(f.value).not.toContain('6:00 AM')
  })

  it('says a day has no Mass rather than listing it blank', () => {
    const content = {
      massSchedule: [{ day: 'Monday', time: '6:00 AM', suspended: ['6:00 AM'] }],
    } as unknown as ParishContent

    const f = massFact(content, compiled)
    if (isGap(f)) throw new Error('expected a fact')
    expect(f.value).toMatch(/Monday: no Mass currently scheduled/)
  })
})

describe('liveTimesFor', () => {
  it('splits a comma-separated day', () => {
    expect(liveTimesFor({ day: 'Sunday', time: '6:00 AM, 9:00 AM' })).toEqual(['6:00 AM', '9:00 AM'])
  })

  it('ignores the case the parish typed a suspension in', () => {
    const e = { day: 'Sunday', time: '6:00 AM', suspended: ['6:00 am'] } as never
    expect(liveTimesFor(e)).toEqual([])
  })
})

describe('itemFacts', () => {
  it('reports a published requirement as a fact', () => {
    const content = {
      itemContent: { 'sac-baptism': { requirements: ['Birth certificate'] } },
    } as unknown as ParishContent

    const { facts } = itemFacts(content, 'sac-baptism', 'Baptism')
    expect(facts.some(f => f.value.includes('Birth certificate'))).toBe(true)
  })

  it('reports an unpublished requirement as a gap, not as "no requirements"', () => {
    // The distinction the whole module exists for. "Nothing listed" and
    // "nothing needed" are opposite answers to a pilgrim packing a bag.
    const { gaps } = itemFacts(null, 'sac-baptism', 'Baptism')
    expect(gaps.some(g => g.topic === 'sac-baptism.requirements')).toBe(true)
  })

  it('weighs each field separately', () => {
    // An about with no requirements has published one and not the other.
    const content = {
      itemContent: { 'sac-wedding': { about: 'Arranged with the office.' } },
    } as unknown as ParishContent

    const { facts, gaps } = itemFacts(content, 'sac-wedding', 'Wedding')
    expect(facts.some(f => f.topic === 'sac-wedding.about')).toBe(true)
    expect(gaps.some(g => g.topic === 'sac-wedding.requirements')).toBe(true)
  })

  it('does not count whitespace as published content', () => {
    const content = {
      itemContent: { 'sac-baptism': { requirements: ['   ', ''] } },
    } as unknown as ParishContent

    const { facts, gaps } = itemFacts(content, 'sac-baptism', 'Baptism')
    expect(facts.some(f => f.topic === 'sac-baptism.requirements')).toBe(false)
    expect(gaps.some(g => g.topic === 'sac-baptism.requirements')).toBe(true)
  })
})

describe('offersItem', () => {
  it('will not claim a service on the strength of no data', () => {
    // Requirement 3: never claim a parish offers something unless the
    // data supports it. Silence is 'unstated', never 'yes'.
    expect(offersItem(null, 'sac-baptism')).toBe('unstated')
    expect(offersItem({} as ParishContent, 'sac-baptism')).toBe('unstated')
  })

  it('says yes when the parish has actually written about it', () => {
    const content = {
      itemContent: { 'sac-baptism': { schedule: 'Saturdays, 9:00 AM' } },
    } as unknown as ParishContent
    expect(offersItem(content, 'sac-baptism')).toBe('yes')
  })

  it('says no when applications are explicitly closed', () => {
    const content = { closedApplications: ['sac-baptism'] } as ParishContent
    expect(offersItem(content, 'sac-baptism')).toBe('no')
  })

  it('lets an explicit closure beat published content', () => {
    const content = {
      closedApplications: ['sac-baptism'],
      itemContent: { 'sac-baptism': { about: 'We baptise on Saturdays.' } },
    } as unknown as ParishContent
    expect(offersItem(content, 'sac-baptism')).toBe('no')
  })
})

describe('freshnessNote', () => {
  const now = new Date('2026-10-18T00:00:00.000Z')
  const parishFact = (updatedAt?: string): Fact => ({
    topic: 'mass',
    value: 'Sunday: 6:00 AM',
    source: 'parish',
    updatedAt,
  })

  it('says how old the parish entry is', () => {
    expect(freshnessNote(parishFact('2026-10-18T00:00:00.000Z'), now)).toMatch(/today/)
    expect(freshnessNote(parishFact('2026-10-17T00:00:00.000Z'), now)).toMatch(/yesterday/)
    expect(freshnessNote(parishFact('2026-10-08T00:00:00.000Z'), now)).toMatch(/10 days ago/)
  })

  it('flags a schedule nobody has touched in a long time', () => {
    // A year-old Mass schedule may well be right, but a pilgrim
    // deserves to know nobody has confirmed it recently.
    expect(freshnessNote(parishFact('2024-01-01T00:00:00.000Z'), now)).toMatch(/over a year/)
  })

  it('says nothing about compiled app data, which has no parish date', () => {
    const appFact: Fact = { topic: 'mass', value: 'Sunday: 6:00 AM', source: 'app' }
    expect(freshnessNote(appFact, now)).toBeNull()
  })

  it('stays quiet on a missing or unparseable date rather than inventing one', () => {
    expect(freshnessNote(parishFact(undefined), now)).toBeNull()
    expect(freshnessNote(parishFact('not a date'), now)).toBeNull()
  })
})

describe('groundingBlock', () => {
  const now = new Date('2026-10-18T00:00:00.000Z')

  it('lists the gaps, so the model has something true to say', () => {
    // A model given only facts fills a silence, and what it fills it
    // with is a plausible Mass time.
    const block = groundingBlock(
      {
        parishId: 'route-mhcp',
        parishName: 'Mary Help of Christians Parish',
        facts: [],
        gaps: [{ topic: 'mass', reason: 'No Mass schedule has been published for this parish.' }],
      },
      now,
    )
    expect(block).toContain('NOT AVAILABLE')
    expect(block).toMatch(/never guess/i)
    expect(block).toContain('No Mass schedule has been published')
  })

  it('marks compiled data as not the parish office speaking', () => {
    const block = groundingBlock(
      {
        parishId: 'route-src',
        parishName: 'San Roque Cathedral Parish',
        facts: [{ topic: 'mass', value: 'Sunday: 6:00 AM', source: 'app' }],
        gaps: [],
      },
      now,
    )
    expect(block).toMatch(/not maintained by this parish/)
  })

  it('attributes and dates a parish-entered fact', () => {
    const block = groundingBlock(
      {
        parishId: 'route-mhcp',
        parishName: 'Mary Help of Christians Parish',
        facts: [
          {
            topic: 'mass',
            value: 'Sunday: 7:00 AM',
            source: 'parish',
            updatedAt: '2026-10-17T00:00:00.000Z',
          },
        ],
        gaps: [],
      },
      now,
    )
    expect(block).toMatch(/parish office, updated by the parish yesterday/)
  })

  it('says plainly when it knows nothing at all about a parish', () => {
    const block = groundingBlock(
      { parishId: 'x', parishName: 'Some Parish', facts: [], gaps: [] },
      now,
    )
    expect(block).toMatch(/none available/i)
  })
})
