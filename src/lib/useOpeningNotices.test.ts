import { describe, expect, it } from 'vitest'

import { newlyOpened, openedNotice } from './useOpeningNotices'

describe('newlyOpened', () => {
  it('says nothing on a first run', () => {
    // No baseline means no "was closed", and announcing every open
    // ministry in the parish on first launch is the bug this prevents.
    expect(newlyOpened(null, ['choir'])).toEqual([])
  })

  it('finds the one that came off the closed list', () => {
    expect(newlyOpened(['choir', 'lector'], ['lector'])).toEqual(['choir'])
  })

  it('finds several', () => {
    expect(newlyOpened(['choir', 'lector'], [])).toEqual(['choir', 'lector'])
  })

  it('says nothing when nothing moved', () => {
    expect(newlyOpened(['choir'], ['choir'])).toEqual([])
  })

  it('does not report a newly CLOSED item as opened', () => {
    expect(newlyOpened([], ['choir'])).toEqual([])
  })

  it('handles a parish that has never closed anything', () => {
    expect(newlyOpened([], [])).toEqual([])
  })
})

describe('openedNotice', () => {
  it('says nothing for nothing', () => {
    expect(openedNotice([], 'Mary Help of Christians')).toBeNull()
  })

  it('names the one thing in both the title and the body', () => {
    const notice = openedNotice(['Confirmation'], 'Mary Help of Christians')
    expect(notice?.title).toBe('Confirmation is open')
    expect(notice?.body).toContain('Confirmation')
    expect(notice?.body).toContain('Mary Help of Christians')
  })

  it('lists them all when there are several', () => {
    const notice = openedNotice(['Choir', 'Lectors'], 'San Roque Cathedral')
    expect(notice?.body).toContain('Choir')
    expect(notice?.body).toContain('Lectors')
  })

  it('does not put a single name in the plural title', () => {
    expect(openedNotice(['Choir'], 'P')?.title).not.toBe('Now open at your parish')
  })
})
