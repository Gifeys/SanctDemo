import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'

import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  checkCode,
  codeEmail,
  generateCode,
  mayResend,
  messageFor,
  type OtpRecord,
} from './adminOtp'

const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const NOW = 1_700_000_000_000

function record(over: Partial<OtpRecord> = {}): OtpRecord {
  return {
    codeHash: hash('123456'),
    createdAt: NOW,
    expiresAt: NOW + CODE_TTL_MS,
    attempts: 0,
    ...over,
  }
}

describe('generateCode', () => {
  it('is always six digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/)
    }
  })

  it('keeps leading zeros', () => {
    // 7 would otherwise be sent as "7" and typed as "7", which no
    // six-box input accepts.
    expect(generateCode(() => 7)).toBe('000007')
  })

  it('rejects values that would skew the distribution', () => {
    // The first draw is in the biased tail and must be discarded.
    const draws = [4_200_000_000, 42]
    let i = 0
    expect(generateCode(() => draws[i++])).toBe('000042')
  })
})

describe('checkCode', () => {
  it('accepts the right code', () => {
    expect(checkCode(record(), '123456', hash('123456'), NOW)).toEqual({ ok: true })
  })

  it('refuses when no code was ever sent', () => {
    expect(checkCode(null, '123456', hash('123456'), NOW))
      .toEqual({ ok: false, reason: 'no-code' })
  })

  it('refuses the wrong code', () => {
    expect(checkCode(record(), '999999', hash('999999'), NOW))
      .toEqual({ ok: false, reason: 'wrong' })
  })

  it('refuses an expired code', () => {
    expect(checkCode(record(), '123456', hash('123456'), NOW + CODE_TTL_MS + 1))
      .toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses a code that has already been used', () => {
    // Replay: the same code mailed once must not sign in twice.
    expect(checkCode(record({ usedAt: NOW }), '123456', hash('123456'), NOW))
      .toEqual({ ok: false, reason: 'used' })
  })

  it('burns the code after too many wrong guesses', () => {
    const r = record({ attempts: MAX_ATTEMPTS })
    expect(checkCode(r, '123456', hash('123456'), NOW))
      .toEqual({ ok: false, reason: 'too-many' })
  })

  it('refuses anything that is not six digits', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56']) {
      expect(checkCode(record(), bad, hash(bad), NOW).ok).toBe(false)
    }
  })

  it('a used code is refused even before it expires', () => {
    expect(checkCode(record({ usedAt: NOW }), '123456', hash('123456'), NOW + 1000).ok)
      .toBe(false)
  })
})

describe('mayResend', () => {
  it('allows the first send', () => {
    expect(mayResend(null, NOW)).toBe(true)
  })

  it('refuses a second send straight away', () => {
    // Otherwise the button is a way to post mail to somebody.
    expect(mayResend(record(), NOW + 1000)).toBe(false)
  })

  it('allows one after the cooldown', () => {
    expect(mayResend(record(), NOW + RESEND_COOLDOWN_MS)).toBe(true)
  })
})

describe('messageFor', () => {
  it('never says how many attempts are left', () => {
    for (const reason of ['no-code', 'expired', 'used', 'too-many', 'wrong'] as const) {
      const text = messageFor(reason)
      expect(text).not.toMatch(/\d+\s*(attempt|tries|left|remaining)/i)
      expect(text.length).toBeGreaterThan(10)
    }
  })

  it('invites a resend when the code expired', () => {
    expect(messageFor('expired')).toMatch(/new one/i)
  })
})

describe('codeEmail', () => {
  it('puts the code in the subject, so it is readable from a notification', () => {
    expect(codeEmail('123456', 'Mary Help of Christians').subject).toContain('123456')
  })

  it('names the parish', () => {
    expect(codeEmail('123456', 'San Roque Cathedral').body).toContain('San Roque Cathedral')
  })

  it('says what to do if you did not ask for it', () => {
    expect(codeEmail('123456', 'P').body).toMatch(/did not try to sign in/i)
  })
})
