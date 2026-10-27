import { beforeEach, describe, expect, it } from 'vitest'

import {
  OPEN_DEDUPE_MS,
  byDay,
  markRecorded,
  recentEvents,
  shouldRecord,
  summarisePageEvents,
  monthlyActiveUsers,
  withTrailingMonths,
  visitorId,
  type PageEvent,
} from './pageEvents'

beforeEach(() => {
  localStorage.clear()
})

const ev = (kind: 'open' | 'download', visitor: string, at: string): PageEvent => ({
  kind,
  visitorId: visitor,
  at,
})

describe('visitorId', () => {
  it('is stable for the same browser', () => {
    expect(visitorId()).toBe(visitorId())
  })

  it('is a random token, not anything about the person', () => {
    const id = visitorId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('starts again when site data is cleared', () => {
    const before = visitorId()
    localStorage.clear()
    expect(visitorId()).not.toBe(before)
  })
})

describe('shouldRecord', () => {
  const now = 1_700_000_000_000

  it('records the first open', () => {
    expect(shouldRecord('open', now, () => null)).toBe(true)
  })

  it('does not record a second open straight away', () => {
    // A reload or a remount is not a person arriving.
    expect(shouldRecord('open', now, () => String(now - 1000))).toBe(false)
  })

  it('records an open again after the quiet period', () => {
    expect(shouldRecord('open', now, () => String(now - OPEN_DEDUPE_MS - 1))).toBe(true)
  })

  it('always records a download', () => {
    // Downloading twice usually means the first one failed, and that
    // is worth seeing.
    expect(shouldRecord('download', now, () => String(now))).toBe(true)
  })

  it('records when the stored value is nonsense', () => {
    expect(shouldRecord('open', now, () => 'not a number')).toBe(true)
  })

  it('round-trips through real storage', () => {
    markRecorded('open')
    expect(shouldRecord('open')).toBe(false)
  })
})

describe('summarisePageEvents', () => {
  it('counts nothing for nothing', () => {
    expect(summarisePageEvents([])).toEqual({
      opens: 0, downloads: 0, people: 0, downloaders: 0,
      apkPeople: 0, webPeople: 0, unknownSurfacePeople: 0,
    })
  })

  it('separates opens from downloads', () => {
    const got = summarisePageEvents([
      ev('open', 'a', '2026-10-20T08:00:00Z'),
      ev('open', 'b', '2026-10-20T09:00:00Z'),
      ev('download', 'a', '2026-10-20T10:00:00Z'),
    ])
    expect(got.opens).toBe(2)
    expect(got.downloads).toBe(1)
  })

  it('tells four browsers apart from forty opens', () => {
    // The distinction the parish actually needs: a busy Sunday and one
    // person reloading all afternoon look identical in a raw total.
    const many = Array.from({ length: 40 }, (_, i) =>
      ev('open', `v${i % 4}`, '2026-10-20T08:00:00Z'))
    const got = summarisePageEvents(many)
    expect(got.opens).toBe(40)
    expect(got.people).toBe(4)
  })

  it('counts distinct downloaders', () => {
    const got = summarisePageEvents([
      ev('download', 'a', '2026-10-20T08:00:00Z'),
      ev('download', 'a', '2026-10-20T08:05:00Z'),
      ev('download', 'b', '2026-10-20T09:00:00Z'),
    ])
    // Three downloads, two people: "a" downloaded twice.
    expect(got.downloads).toBe(3)
    expect(got.downloaders).toBe(2)
  })

  it('ignores a row with no visitor id rather than counting it as a person', () => {
    const got = summarisePageEvents([ev('open', '', '2026-10-20T08:00:00Z')])
    expect(got.opens).toBe(1)
    expect(got.people).toBe(0)
  })
})

describe('recentEvents', () => {
  const now = new Date('2026-10-22T12:00:00Z')

  it('keeps what falls inside the window', () => {
    const got = recentEvents([ev('open', 'a', '2026-10-21T12:00:00Z')], 7, now)
    expect(got).toHaveLength(1)
  })

  it('drops what falls outside it', () => {
    const got = recentEvents([ev('open', 'a', '2026-09-01T12:00:00Z')], 7, now)
    expect(got).toHaveLength(0)
  })

  it('returns newest first', () => {
    const got = recentEvents([
      ev('open', 'a', '2026-10-18T12:00:00Z'),
      ev('open', 'b', '2026-10-21T12:00:00Z'),
    ], 7, now)
    expect(got[0].visitorId).toBe('b')
  })

  it('discards a row with an unreadable date', () => {
    expect(recentEvents([ev('open', 'a', 'whenever')], 7, now)).toHaveLength(0)
  })
})

describe('byDay', () => {
  it('tallies per calendar day, oldest first', () => {
    const got = byDay([
      ev('open', 'a', '2026-10-20T08:00:00Z'),
      ev('open', 'b', '2026-10-20T20:00:00Z'),
      ev('open', 'c', '2026-10-21T08:00:00Z'),
    ], 'open')
    expect(got).toEqual([
      { day: '2026-10-20', count: 2 },
      { day: '2026-10-21', count: 1 },
    ])
  })

  it('counts only the kind asked for', () => {
    const got = byDay([
      ev('open', 'a', '2026-10-20T08:00:00Z'),
      ev('download', 'a', '2026-10-20T08:00:00Z'),
    ], 'download')
    expect(got).toEqual([{ day: '2026-10-20', count: 1 }])
  })

  it('gives an empty list when nothing matches', () => {
    expect(byDay([ev('open', 'a', '2026-10-20T08:00:00Z')], 'download')).toEqual([])
  })
})

describe('surfaces', () => {
  const ev = (over: Partial<PageEvent>): PageEvent =>
    ({ kind: 'open', visitorId: 'a', at: '2026-10-26T00:00:00Z', ...over })

  it('counts the app and the web apart', () => {
    const totals = summarisePageEvents([
      ev({ visitorId: 'a', surface: 'apk' }),
      ev({ visitorId: 'b', surface: 'web' }),
      ev({ visitorId: 'c', surface: 'web' }),
    ])
    expect(totals.apkPeople).toBe(1)
    expect(totals.webPeople).toBe(2)
  })

  it('does not count an old row as a web visit', () => {
    // Everything recorded before surfaces existed has none. Treating
    // that as "web" would invent a figure nobody measured.
    const totals = summarisePageEvents([ev({ visitorId: 'a' })])
    expect(totals.webPeople).toBe(0)
    expect(totals.apkPeople).toBe(0)
    expect(totals.unknownSurfacePeople).toBe(1)
  })

  it('counts somebody who used both in both', () => {
    // And once in `people`, so the three do not sum to it.
    const totals = summarisePageEvents([
      ev({ visitorId: 'a', surface: 'apk' }),
      ev({ visitorId: 'a', surface: 'web' }),
    ])
    expect(totals.people).toBe(1)
    expect(totals.apkPeople).toBe(1)
    expect(totals.webPeople).toBe(1)
  })

  it('leaves the headline numbers exactly as they were', () => {
    // Adding this must not move the figures the parish already reads.
    const totals = summarisePageEvents([
      ev({ visitorId: 'a' }),
      ev({ visitorId: 'b', surface: 'web' }),
      ev({ kind: 'download', visitorId: 'a' }),
    ])
    expect(totals.opens).toBe(2)
    expect(totals.people).toBe(2)
    expect(totals.downloads).toBe(1)
    expect(totals.downloaders).toBe(1)
  })

  it('ignores a surface on a download, which has no surface question', () => {
    const totals = summarisePageEvents([ev({ kind: 'download', visitorId: 'a', surface: 'web' })])
    expect(totals.webPeople).toBe(0)
  })
})

describe('monthlyActiveUsers', () => {
  const open = (visitorId: string, at: string): PageEvent =>
    ({ kind: 'open', visitorId, at })

  it('has nothing to show before anything is recorded', () => {
    // The chart needs an empty state rather than a flat line at zero
    // stretching back to the epoch.
    expect(monthlyActiveUsers([])).toEqual([])
  })

  it('counts distinct people, not opens', () => {
    const rows = monthlyActiveUsers([
      open('a', '2026-10-01T00:00:00Z'),
      open('a', '2026-10-15T00:00:00Z'),
      open('b', '2026-10-20T00:00:00Z'),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].users).toBe(2)
  })

  it('counts a returning person again in each month', () => {
    // Monthly ACTIVE users: coming back in November is being active in
    // November, not a duplicate of October.
    const rows = monthlyActiveUsers([
      open('a', '2026-10-05T00:00:00Z'),
      open('a', '2026-11-05T00:00:00Z'),
    ])
    expect(rows.map(r => r.users)).toEqual([1, 1])
  })

  it('fills a quiet month rather than closing the gap', () => {
    // A line jumping from September to November implies they are next
    // to each other, and a month nobody opened it is worth seeing.
    const rows = monthlyActiveUsers([
      open('a', '2026-09-10T00:00:00Z'),
      open('b', '2026-11-10T00:00:00Z'),
    ])
    expect(rows.map(r => r.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(rows[1].users).toBe(0)
  })

  it('crosses a year end', () => {
    const rows = monthlyActiveUsers([
      open('a', '2026-12-10T00:00:00Z'),
      open('b', '2027-01-10T00:00:00Z'),
    ])
    expect(rows.map(r => r.month)).toEqual(['2026-12', '2027-01'])
  })

  it('ignores downloads, which are not app usage', () => {
    const rows = monthlyActiveUsers([
      { kind: 'download', visitorId: 'a', at: '2026-10-01T00:00:00Z' },
    ])
    expect(rows).toEqual([])
  })

  it('ignores a row with an unreadable date rather than throwing', () => {
    const rows = monthlyActiveUsers([
      open('a', 'not a date'),
      open('b', '2026-10-01T00:00:00Z'),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].users).toBe(1)
  })

  it('labels months readably', () => {
    expect(monthlyActiveUsers([open('a', '2026-10-01T00:00:00Z')])[0].label)
      .toBe('Oct 2026')
  })
})

describe('withTrailingMonths', () => {
  const row = (month: string, label: string, users: number) => ({ month, label, users })

  it('leaves nothing as nothing', () => {
    // No data at all is an empty state, not a flat line to nowhere.
    expect(withTrailingMonths([], 6)).toEqual([])
  })

  it('pads a single month back to a window worth drawing', () => {
    const out = withTrailingMonths([row('2026-10', 'Oct 2026', 5)], 4)
    expect(out.map(r => r.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(out[3].users).toBe(5)
    expect(out[0].users).toBe(0)
  })

  it('crosses a year boundary backwards', () => {
    const out = withTrailingMonths([row('2027-01', 'Jan 2027', 2)], 3)
    expect(out.map(r => r.month)).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('leaves a long history alone', () => {
    const many = [
      row('2026-08', 'Aug 2026', 1),
      row('2026-09', 'Sep 2026', 2),
      row('2026-10', 'Oct 2026', 3),
    ]
    expect(withTrailingMonths(many, 3)).toEqual(many)
  })

  it('keeps the real figures where they exist', () => {
    const out = withTrailingMonths([row('2026-10', 'Oct 2026', 9)], 3)
    expect(out.find(r => r.month === '2026-10')?.users).toBe(9)
  })
})
