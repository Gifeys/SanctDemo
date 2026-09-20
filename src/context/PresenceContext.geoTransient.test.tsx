import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PresenceProvider, usePresence } from './PresenceContext'

// A GeolocationPositionError carries its codes as instance properties.
function geoError(code: number) {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' }
}

function Probe() {
  const { position, gpsStatus } = usePresence()
  return (
    <div>
      <span data-testid="status">{gpsStatus}</span>
      <span data-testid="pos">{position ? `${position.lat},${position.lng}` : 'none'}</span>
    </div>
  )
}

function mockGeo(impl: (success: any, error: any) => void) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (success: any, error: any) => {
        impl(success, error)
        return 1
      },
      clearWatch: () => {},
    },
  })
}

beforeEach(() => vi.restoreAllMocks())

describe('transient GPS failures', () => {
  // The bug this guards: a TIMEOUT was reported as 'denied' and wiped the
  // position. Recentre is disabled whenever position is null, so a slow fix
  // indoors permanently disabled the button and claimed the user had refused
  // permission they had in fact granted.
  it('keeps the last fix and does not claim denial on TIMEOUT', async () => {
    mockGeo((success, error) => {
      success({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 12 } })
      error(geoError(3))
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('lost'))
    expect(screen.getByTestId('pos').textContent).toBe('14.6377,120.9734')
  })

  it('keeps the last fix on POSITION_UNAVAILABLE too', async () => {
    mockGeo((success, error) => {
      success({ coords: { latitude: 14.65, longitude: 120.97, accuracy: 20 } })
      error(geoError(2))
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('lost'))
    expect(screen.getByTestId('pos').textContent).toBe('14.65,120.97')
  })

  // A real refusal must still clear everything: continuing to assert a
  // position the app can no longer verify is the failure that sends someone
  // to the wrong church.
  it('clears the position on a genuine PERMISSION_DENIED', async () => {
    mockGeo((success, error) => {
      success({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 12 } })
      error(geoError(1))
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('denied'))
    expect(screen.getByTestId('pos').textContent).toBe('none')
  })

  it('reports searching, not denied, before any fix arrives', async () => {
    mockGeo(() => {})
    render(<PresenceProvider><Probe /></PresenceProvider>)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('searching'))
  })

  it('moves the position when a later fix arrives', async () => {
    let push: (p: any) => void = () => {}
    mockGeo(success => { push = success })

    render(<PresenceProvider><Probe /></PresenceProvider>)
    push({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 10 } })
    await waitFor(() => expect(screen.getByTestId('pos').textContent).toBe('14.6377,120.9734'))

    push({ coords: { latitude: 14.6516, longitude: 120.9726, accuracy: 8 } })
    await waitFor(() => expect(screen.getByTestId('pos').textContent).toBe('14.6516,120.9726'))
  })
})
