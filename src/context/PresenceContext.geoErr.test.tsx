import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PresenceProvider, usePresence } from './PresenceContext'

function Probe() {
  const { presence, gpsStatus } = usePresence()
  return (
    <div>
      <span data-testid="mode">{presence.mode}</span>
      <span data-testid="gps">{gpsStatus}</span>
    </div>
  )
}

describe('PresenceProvider geolocation error handling', () => {
  afterEach(() => {
    // Leave a harmless no-op geolocation in place so RTL's automatic
    // unmount-cleanup (which calls clearWatch) doesn't itself throw.
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition: () => 1, clearWatch: () => {} },
      configurable: true,
    })
  })

  it('applies a null position and reports denied when the error callback fires', async () => {
    let errorCb: ((e: any) => void) | null = null
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        watchPosition: (_success: any, error: any) => {
          errorCb = error
          return 1
        },
        clearWatch: () => {},
      },
      configurable: true,
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)

    // A real GeolocationPositionError always carries a code; code 1 is
    // PERMISSION_DENIED. The old call passed nothing and only worked
    // because the handler ignored its argument and assumed refusal.
    await act(async () => {
      errorCb && (errorCb as any)({ code: 1 })
    })

    expect(screen.getByTestId('gps').textContent).toBe('denied')
    expect(screen.getByTestId('mode').textContent).toBe('diocese')
  })

  it('applies a null position and reports unavailable when geolocation is missing', async () => {
    // 'in' must actually fail to find the property, not just see `undefined`.
    delete (globalThis.navigator as any).geolocation

    render(<PresenceProvider><Probe /></PresenceProvider>)

    expect(screen.getByTestId('gps').textContent).toBe('unavailable')
    expect(screen.getByTestId('mode').textContent).toBe('diocese')
  })
})
