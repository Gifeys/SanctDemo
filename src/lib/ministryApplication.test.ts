import { describe, it, expect } from 'vitest'
import {
  buildMinistryApplication,
  statusPresentation,
  isMinistryApplication,
  MINISTRY_APPLICATION_TYPE,
  MINISTRY_STATUSES,
} from './ministryApplication'

const input = {
  uid: 'uid-123',
  fullName: '  Juan dela Cruz  ',
  email: ' juan@gmail.com ',
  mobile: ' 0917-1234567 ',
  ministryId: 'min-choir',
  ministryName: 'Singing Servants of Christ (Choir)',
  parishId: 'route-mhcp',
  parishName: 'Mary Help of Christians Parish',
  message: '  I sing at weddings.  ',
  consent: true,
  now: new Date('2026-09-21T10:30:00.000Z'),
}

describe('buildMinistryApplication', () => {
  it('starts every application as Pending', () => {
    expect(buildMinistryApplication(input).status).toBe('Pending')
  })

  it('carries the uid through, because the Firestore rules reject a write without it', () => {
    expect(buildMinistryApplication(input).uid).toBe('uid-123')
  })

  it('trims what the applicant typed', () => {
    const doc = buildMinistryApplication(input)
    expect(doc.applicant).toBe('Juan dela Cruz')
    expect(doc.email).toBe('juan@gmail.com')
    expect(doc.mobile).toBe('0917-1234567')
    expect(doc.message).toBe('I sing at weddings.')
  })

  it('records ministry and parish as fields, not only inside a sentence', () => {
    const doc = buildMinistryApplication(input)
    expect(doc.ministryId).toBe('min-choir')
    expect(doc.parishId).toBe('route-mhcp')
    expect(doc.parishName).toBe('Mary Help of Christians Parish')
  })

  it('still writes the legacy fields the existing lists render', () => {
    const doc = buildMinistryApplication(input)
    expect(doc.type).toBe(MINISTRY_APPLICATION_TYPE)
    expect(doc.details).toContain('Singing Servants of Christ (Choir)')
    expect(doc.date).toBeTruthy()
  })

  it('keeps an exact instant alongside the display date, which cannot be sorted', () => {
    expect(buildMinistryApplication(input).submittedAt).toBe('2026-09-21T10:30:00.000Z')
  })

  it('records consent as given, and as withheld', () => {
    expect(buildMinistryApplication(input).consent).toBe(true)
    expect(buildMinistryApplication({ ...input, consent: false }).consent).toBe(false)
  })
})

describe('isMinistryApplication', () => {
  it('separates ministry applications from the sacrament bookings sharing the collection', () => {
    expect(isMinistryApplication({ type: MINISTRY_APPLICATION_TYPE })).toBe(true)
    expect(isMinistryApplication({ type: 'Sacrament Booking' })).toBe(false)
    expect(isMinistryApplication({})).toBe(false)
  })
})

describe('statusPresentation', () => {
  it('gives each of the four statuses its own colour', () => {
    const dots = MINISTRY_STATUSES.map(s => statusPresentation(s).dot)
    expect(dots).toEqual(['🟡', '🔵', '🟢', '🔴'])
    expect(new Set(dots).size).toBe(4)
  })

  it('shows a status written before these four existed in its own words', () => {
    // Rewriting those rows would be an unasked-for migration, and calling
    // them "Pending" would misreport them.
    const scheduled = statusPresentation('Interview Scheduled')
    expect(scheduled.label).toBe('Interview Scheduled')
    expect(scheduled.dot).toBe('🔵')

    expect(statusPresentation('Approved (Simulated)').dot).toBe('🟢')
    expect(statusPresentation('Awaiting Parish Interview').dot).toBe('🟡')
  })

  it('does not invent an outcome for something it cannot read', () => {
    const odd = statusPresentation('Filed under Q')
    expect(odd.label).toBe('Filed under Q')
    expect(odd.dot).toBe('⚪')
  })
})
