import { beforeEach, describe, expect, it } from 'vitest'

import {
  OPEN_DEDUPE_MS,
  byDay,
  markRecorded,
  recentEvents,
  shouldRecord,
  summarisePageEvents,
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
