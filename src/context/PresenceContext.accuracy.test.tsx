// Defect 3 ("I don't have live location exactly where I am") coverage:
// the browser's reported accuracy radius must reach the UI instead of being
// discarded, real GPS must take precedence over the simulator, and a
// simulated position must never be presented as if it carried a real
// accuracy figure. See docs/reports/map-fixes-and-directions.md.
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PresenceProvider, usePresence } from './PresenceContext'

function Probe() {
  const { accuracyMeters, position, simulation, setSimulation } = usePresence()
  return (
    <div>
      <span data-testid="accuracy">{accuracyMeters === null ? 'null' : accuracyMeters}</span>
      <span data-testid="position">{position ? `${position.lat},${position.lng}` : 'none'}</span>
      <span data-testid="simulation">{simulation}</span>
      <button onClick={() => setSimulation('at_mhcp')}>simulate</button>
      <button onClick={() => setSimulation('off')}>stop</button>
    </div>
  )
}

describe('PresenceProvider accuracy handling', () => {
  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition: () => 1, clearWatch: () => {} },
      configurable: true,
    })
  })

  it('surfaces the accuracy radius reported by a real GPS fix', async () => {
    let successCb: ((p: any) => void) | null = null
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        watchPosition: (success: any) => {
          successCb = success
          return 1
        },
        clearWatch: () => {},
      },
      configurable: true,
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)
    expect(screen.getByTestId('accuracy').textContent).toBe('null')

    await act(async () => {
      successCb && successCb({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 42 } })
    })

    expect(screen.getByTestId('accuracy').textContent).toBe('42')
    expect(screen.getByTestId('position').textContent).toBe('14.6377,120.9734')
  })

  it('clears accuracy when GPS is denied — never shows a stale figure for an unknown position', async () => {
    let errorCb: ((e: any) => void) | null = null
    let successCb: ((p: any) => void) | null = null
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        watchPosition: (success: any, error: any) => {
          successCb = success
          errorCb = error
          return 1
        },
        clearWatch: () => {},
      },
      configurable: true,
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)
    await act(async () => {
      successCb && successCb({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 15 } })
    })
    expect(screen.getByTestId('accuracy').textContent).toBe('15')

    // code 1 is PERMISSION_DENIED - the only error that means the user
    // genuinely refused. A timeout must NOT clear the position, which is
    // covered in PresenceContext.geoTransient.test.tsx.
    await act(async () => {
      errorCb && errorCb({ code: 1 })
    })
    expect(screen.getByTestId('accuracy').textContent).toBe('null')
  })

  it('a simulated position never carries a real accuracy figure, even right after a real fix', async () => {
    let successCb: ((p: any) => void) | null = null
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        watchPosition: (success: any) => {
          successCb = success
          return 1
        },
        clearWatch: () => {},
      },
      configurable: true,
    })

    render(<PresenceProvider><Probe /></PresenceProvider>)
    await act(async () => {
      successCb && successCb({ coords: { latitude: 14.6377, longitude: 120.9734, accuracy: 20 } })
    })
    expect(screen.getByTestId('accuracy').textContent).toBe('20')

    await act(async () => {
      screen.getByText('simulate').click()
    })
    expect(screen.getByTestId('simulation').textContent).toBe('at_mhcp')
    expect(screen.getByTestId('accuracy').textContent).toBe('null')
  })

  it('real GPS takes precedence: turning the simulator off drops the simulated position until a real fix arrives', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>)
    await act(async () => {
      screen.getByText('simulate').click()
    })
    expect(screen.getByTestId('position').textContent).not.toBe('none')

    await act(async () => {
      screen.getByText('stop').click()
    })
    expect(screen.getByTestId('simulation').textContent).toBe('off')
    expect(screen.getByTestId('position').textContent).toBe('none')
    expect(screen.getByTestId('accuracy').textContent).toBe('null')
  })
})
