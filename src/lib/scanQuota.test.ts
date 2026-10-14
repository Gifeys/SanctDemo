import { describe, expect, it } from 'vitest'
import {
  SCANNABLE_PARISHES,
  SCANS_PER_PARISH_PER_DAY,
  budgetFrom,
  emptyBudget,
  isScannableParish,
  scanQuotaDocId,
  spentMessage,
  utcDay,
} from './scanQuota'

describe('utcDay', () => {
  it('is the calendar day in UTC, not the machine’s timezone', () => {
    // Manila is UTC+8. 7am on the 14th in Manila is still the 13th in
    // UTC, and the server must agree with the phone about which day a
    // scan belongs to without either being told the other's timezone.
    expect(utcDay(new Date('2026-10-13T23:30:00Z'))).toBe('2026-10-13')
    expect(utcDay(new Date('2026-10-14T00:30:00Z'))).toBe('2026-10-14')
  })
})

describe('isScannableParish', () => {
  it('accepts the two parishes that have a scanner', () => {
    expect(isScannableParish('route-mhcp')).toBe(true)
    expect(isScannableParish('route-src')).toBe(true)
  })

  it('refuses anything else, including rubbish from a client', () => {
    // The parish id decides which counter is spent, so an unchecked
    // value is a free scan: send a new one each time and the allowance
    // never runs out.
    for (const bad of ['route-holy-trinity', '', '../route-mhcp', null, 7, {}]) {
      expect(isScannableParish(bad)).toBe(false)
    }
  })
})

describe('scanQuotaDocId', () => {
  it('is one document per user, per parish, per day', () => {
    const a = scanQuotaDocId('uid1', 'route-mhcp', '2026-10-13')
    expect(a).toBe('uid1__route-mhcp__2026-10-13')
    expect(scanQuotaDocId('uid1', 'route-src', '2026-10-13')).not.toBe(a)
    expect(scanQuotaDocId('uid2', 'route-mhcp', '2026-10-13')).not.toBe(a)
    expect(scanQuotaDocId('uid1', 'route-mhcp', '2026-10-14')).not.toBe(a)
  })
})

describe('budgetFrom', () => {
  it('counts down from the daily allowance', () => {
    const b = budgetFrom(3, 'route-mhcp', '2026-10-13')
    expect(b.limit).toBe(SCANS_PER_PARISH_PER_DAY)
    expect(b.used).toBe(3)
    expect(b.remaining).toBe(SCANS_PER_PARISH_PER_DAY - 3)
  })

  it('never reports a negative remainder', () => {
    // Two requests that overlap can both commit before either reads the
    // other, so a stored count above the limit is possible. It must read
    // as "none left", not "minus one left".
    expect(budgetFrom(25, 'route-mhcp', '2026-10-13').remaining).toBe(0)
  })

  it('treats a missing or corrupt count as none used', () => {
    for (const bad of [NaN, -4, undefined as unknown as number]) {
      expect(budgetFrom(bad, 'route-mhcp', '2026-10-13').used).toBe(0)
    }
  })

  it('starts a fresh parish at the full allowance', () => {
    expect(emptyBudget('route-src').remaining).toBe(SCANS_PER_PARISH_PER_DAY)
  })
})

describe('the two parishes are independent', () => {
  it('spending one leaves the other whole', () => {
    const mhcp = budgetFrom(SCANS_PER_PARISH_PER_DAY, 'route-mhcp', '2026-10-13')
    const src = emptyBudget('route-src', '2026-10-13')
    expect(mhcp.remaining).toBe(0)
    expect(src.remaining).toBe(SCANS_PER_PARISH_PER_DAY)
  })

  it('covers every scannable parish', () => {
    expect([...SCANNABLE_PARISHES].sort()).toEqual(['route-mhcp', 'route-src'])
  })
})

describe('spentMessage', () => {
  it('names the parish, so the other one is not written off too', () => {
    const m = spentMessage('Mary Help of Christians Parish')
    expect(m).toContain('Mary Help of Christians Parish')
    expect(m).toContain('20')
    // A visitor standing in the second church must not read this as
    // "the app is finished with you for today".
    expect(m).toMatch(/other parishes have their own/i)
  })
})
