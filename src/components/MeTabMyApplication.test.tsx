import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MeTab from './MeTab'
import { MINISTRY_APPLICATION_TYPE } from '../lib/ministryApplication'

// Settings -> My Application, which cannot be reached in a browser while
// Firebase Auth is unconfigured for this project (auth/configuration-not-found
// on every sign-in), so it is verified here instead of by hand.

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
  return render(
    <MeTab
      isLoggedIn
      userEmail="juan@gmail.com"
      isAdmin={false}
      userProgress={progress}
      applications={applications}
      onLoginSuccess={noop}
      onLogout={noop}
      onOpenChangeParish={noop}
      onOpenRosarySettings={noop}
      onOpenAdmin={noop}
      onOpenSimulator={noop}
      onOpenSignIn={noop}
      parishName="Mary Help of Christians Parish"
    />,
  )
}

const ministryApp = {
  id: 'app-1',
  type: MINISTRY_APPLICATION_TYPE,
  applicant: 'Juan dela Cruz',
  details: 'Singing Servants of Christ (Choir) — Mary Help of Christians Parish',
  date: '21/09/2026',
  status: 'Pending',
  ministryName: 'Singing Servants of Christ (Choir)',
  parishName: 'Mary Help of Christians Parish',
}

describe('MeTab — My Application', () => {
  it('shows the ministry, parish, date submitted and status', () => {
    renderMe([ministryApp])

    expect(screen.getByText('Singing Servants of Christ (Choir)')).toBeTruthy()
    expect(screen.getByText('21/09/2026')).toBeTruthy()

    // The parish also appears in the profile header, so this checks the one
    // inside the application row specifically.
    const parishInRow = screen
      .getAllByText('Mary Help of Christians Parish')
      .find(node => node.tagName === 'DD')
    expect(parishInRow).toBeTruthy()
    expect(screen.getByText('Parish')).toBeTruthy()
    expect(screen.getByText(/Pending/)).toBeTruthy()
  })

  it('shows the status with its colour, so the state reads at a glance', () => {
    renderMe([ministryApp])
    expect(screen.getByText(/🟡/)).toBeTruthy()
  })

  it('tells the applicant how the parish will reach them', () => {
    renderMe([ministryApp])
    expect(
      screen.getByText(/We will contact you through your registered email regarding your application/),
    ).toBeTruthy()
  })

  it('says so plainly when nothing has been submitted', () => {
    renderMe([])
    expect(screen.getByText(/No ministry application submitted yet/)).toBeTruthy()
  })

  it('keeps sacrament bookings visible rather than hiding them behind the ministry filter', () => {
    // These were listed here before this feature existed. Filtering the list
    // down to ministry applications would have quietly removed them.
    renderMe([
      ministryApp,
      {
        id: 'app-2',
        type: 'Sacrament Booking',
        applicant: 'Juan dela Cruz',
        details: 'Holy Baptism - May 24, 2026',
        date: '12/05/2026',
        status: 'Awaiting Parish Interview',
      },
    ])

    expect(screen.getByText('Other Submissions')).toBeTruthy()
    expect(screen.getByText('Sacrament Booking')).toBeTruthy()
    expect(screen.getByText('Holy Baptism - May 24, 2026')).toBeTruthy()
  })

  it('falls back to the summary for a row stored before the structured fields existed', () => {
    const { ministryName, parishName, ...legacy } = ministryApp
    renderMe([legacy])
    expect(screen.getByText(legacy.details)).toBeTruthy()
  })
})
