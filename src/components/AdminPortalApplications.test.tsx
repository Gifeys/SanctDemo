import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import AdminPortal from './AdminPortal'
import { MINISTRY_APPLICATION_TYPE, MINISTRY_STATUSES } from '../lib/ministryApplication'

// The admin side of the ministry application, verified here because the
// portal is behind an admin sign-in and Firebase Auth is unconfigured for
// this project (auth/configuration-not-found on every attempt).

const ministryApp = {
  id: 'app-1',
  type: MINISTRY_APPLICATION_TYPE,
  applicant: 'Juan dela Cruz',
  details: 'Singing Servants of Christ (Choir) — Mary Help of Christians Parish',
  date: '21/09/2026',
  status: 'Pending',
  email: 'juan@gmail.com',
  mobile: '0917-1234567',
  ministryName: 'Singing Servants of Christ (Choir)',
  parishName: 'Mary Help of Christians Parish',
  message: 'I sing at weddings.',
}

function renderPortal(onUpdateApplicationStatus = vi.fn()) {
  render(
    <AdminPortal
      userEmail="office@sti.edu"
      applications={[ministryApp]}
      onDeleteApplication={vi.fn()}
      onUpdateApplicationStatus={onUpdateApplicationStatus}
      announcements={[]}
      onAddAnnouncement={vi.fn()}
      onDeleteAnnouncement={vi.fn()}
    />,
  )
  // The applications live on the portal's Database tab, which is not the
  // one it opens on.
  act(() => {
    fireEvent.click(screen.getByText('Data'))
  })

  return onUpdateApplicationStatus
}

beforeEach(() => {
  // The portal fetches SMTP status on mount; it is not what is under test.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminPortal — ministry applications', () => {
  it('shows everything the coordinator needs to act on the application', () => {
    renderPortal()

    expect(screen.getByText(/Juan dela Cruz/)).toBeTruthy()
    expect(screen.getByText(/Singing Servants of Christ \(Choir\)/)).toBeTruthy()
    expect(screen.getByText(/Mary Help of Christians Parish/)).toBeTruthy()
    expect(screen.getByText(/juan@gmail.com/)).toBeTruthy()
    expect(screen.getByText(/0917-1234567/)).toBeTruthy()
    expect(screen.getByText(/I sing at weddings\./)).toBeTruthy()
    expect(screen.getByText(/21\/09\/2026/)).toBeTruthy()
  })

  it('offers exactly the four statuses and reports the chosen one', () => {
    const onUpdate = renderPortal()

    const select = screen.getByLabelText('Set status') as HTMLSelectElement
    expect([...select.options].map(o => o.value)).toEqual([...MINISTRY_STATUSES])

    fireEvent.change(select, { target: { value: 'Under Review' } })
    expect(onUpdate).toHaveBeenCalledWith('app-1', 'Under Review')
  })

  it('says a mobile number was not given rather than showing an empty field', () => {
    render(
      <AdminPortal
        userEmail="office@sti.edu"
        applications={[{ ...ministryApp, mobile: '' }]}
        onDeleteApplication={vi.fn()}
        onUpdateApplicationStatus={vi.fn()}
        announcements={[]}
        onAddAnnouncement={vi.fn()}
        onDeleteAnnouncement={vi.fn()}
      />,
    )
    act(() => {
      fireEvent.click(screen.getByText('Data'))
    })
    expect(screen.getByText(/not given/)).toBeTruthy()
  })
})
