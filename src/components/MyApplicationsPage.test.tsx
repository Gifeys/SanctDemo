import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyApplicationsPage from './MyApplicationsPage'
import { MINISTRY_APPLICATION_TYPE } from '../lib/ministryApplication'

// "My Applications", which moved off the Me tab onto a page of its own -
// it grew without limit and turned "your account" into a list you had to
// scroll past. The requirements did not change with the move, so neither
// did these tests; only the component under test did.
//
// It cannot be reached in a browser while Firebase Auth is unconfigured
// for this project, so it is verified here instead of by hand.
//
// ## What changed, and what did not
//
// The two lists - "My Application" for ministries and "Other Submissions"
// for everything else - became one. The split was never meaningful to the
// person reading it: they submitted things, and they want to know where
// each one got to. It also could not survive the new documents, which put
// the ministry's own name in `type` rather than the literal words
// "Ministry Application", so the filter that separated the two stopped
// separating anything.
//
// Every requirement these tests were written for still holds and is still
// asserted below: the ministry is named, the date and status show,
// sacrament bookings are not hidden, the applicant is told how the parish
// will reach them, an empty list says so, and a row stored before the
// structured fields still renders.
//
// Two things are deliberately gone. The per-row "Parish" line, because
// every application a pilgrim can see belongs to their own parish and the
// header above already names it. And the emoji dot, replaced by a tinted
// badge whose WORD carries the meaning - a dot that is the only difference
// between approved and rejected fails on a printed page and for anyone who
// cannot separate the hues.

const progress = {
  completedStations: [],
  completedRoutes: [],
  badges: [],
  steps: 0,
  distanceKm: 0,
  points: 0,
}

const noop = () => {}

function renderMe(applications: any[]) {
  return render(<MyApplicationsPage applications={applications} onBack={noop} />)
}

/** A row as the old code wrote it, and as the database still holds it. */
const legacyMinistryApp = {
  id: 'app-1',
  type: MINISTRY_APPLICATION_TYPE,
  applicant: 'Juan dela Cruz',
  details: 'Singing Servants of Christ (Choir) — Mary Help of Christians Parish',
  date: '21/09/2026',
  status: 'Pending',
  ministryName: 'Singing Servants of Christ (Choir)',
  parishName: 'Mary Help of Christians Parish',
}

/** A row as submitApplication writes it now. */
const newSacramentApp = {
  id: 'app-3',
  uid: 'u1',
  applicantName: 'Juan dela Cruz',
  applicantEmail: 'juan@gmail.com',
  churchId: 'route-mhcp',
  kind: 'sacrament',
  type: 'Baptism',
  status: 'under_review',
  referenceNumber: 'SAC-2026-ACDEFG',
  createdAt: '2026-10-06T02:00:00.000Z',
  reviewedAt: '2026-10-06T06:00:00.000Z',
  adminNote: 'Interview booked for Tuesday.',
}

describe('My Applications', () => {
  it('names the ministry and shows when it was submitted', () => {
    renderMe([legacyMinistryApp])
    expect(screen.getByText('Singing Servants of Christ (Choir)')).toBeTruthy()
    expect(screen.getByText('21/09/2026')).toBeTruthy()
    expect(screen.getByText('Submitted')).toBeTruthy()
  })

  it('shows the status as a word, not only as a colour', () => {
    renderMe([legacyMinistryApp])
    // An old row's free-text status is printed as written rather than
    // guessed into one of the five.
    const badge = screen.getByText('Pending')
    expect(badge).toBeTruthy()
    expect(badge.getAttribute('style')).toContain('background')
  })

  it('maps a stored status to language a person would use', () => {
    renderMe([newSacramentApp])
    expect(screen.getByText('Under review')).toBeTruthy()
    // Nobody should ever be shown the stored value.
    expect(screen.queryByText('under_review')).toBeNull()
  })

  it('shows the reference number, which is how the parish looks it up', () => {
    renderMe([newSacramentApp])
    expect(screen.getByText('SAC-2026-ACDEFG')).toBeTruthy()
  })

  it("shows the parish's note and when they last acted", () => {
    renderMe([newSacramentApp])
    expect(screen.getByText(/Interview booked for Tuesday/)).toBeTruthy()
    expect(screen.getByText('Last update')).toBeTruthy()
  })

  it('tells the applicant how the parish will reach them', () => {
    renderMe([legacyMinistryApp])
    expect(screen.getByText(/contact you at your registered email/)).toBeTruthy()
  })

  it('says so plainly when nothing has been submitted', () => {
    renderMe([])
    expect(screen.getByText(/Nothing submitted yet/)).toBeTruthy()
  })

  it('keeps sacrament bookings visible rather than hiding them behind a filter', () => {
    // These were listed here before the ministry feature existed.
    // Filtering down to ministry applications quietly removed them once.
    renderMe([
      legacyMinistryApp,
      {
        id: 'app-2',
        type: 'Sacrament Booking',
        applicant: 'Juan dela Cruz',
        details: 'Holy Baptism - May 24, 2026',
        date: '12/05/2026',
        status: 'Awaiting Parish Interview',
      },
    ])

    expect(screen.getByText('Singing Servants of Christ (Choir)')).toBeTruthy()
    expect(screen.getByText('Holy Baptism - May 24, 2026')).toBeTruthy()
    // "Awaiting Parish Interview" means the parish has not acted yet, so it
    // must not be reported to the applicant as already under review.
    expect(screen.getByText('Awaiting Parish Interview')).toBeTruthy()
  })

  it('falls back to the summary for a row stored before the structured fields existed', () => {
    const { ministryName, parishName, ...legacy } = legacyMinistryApp
    renderMe([legacy])
    expect(screen.getByText(legacy.details)).toBeTruthy()
  })
})
