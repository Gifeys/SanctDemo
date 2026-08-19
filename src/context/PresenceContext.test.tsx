import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PresenceProvider, usePresence } from './PresenceContext'

function Probe() {
  const { presence, parish, setSimulation } = usePresence()
  return (
    <div>
      <span data-testid="mode">{presence.mode}</span>
      <span data-testid="parish">{parish ? parish.name : 'none'}</span>
      <button onClick={() => setSimulation('at_mhcp')}>simulate</button>
      <button onClick={() => setSimulation('off')}>stop</button>
    </div>
  )
}

describe('PresenceProvider', () => {
  it('starts in diocese mode with no parish', () => {
    render(<PresenceProvider><Probe /></PresenceProvider>)
    expect(screen.getByTestId('mode').textContent).toBe('diocese')
    expect(screen.getByTestId('parish').textContent).toBe('none')
  })

  it('enters present mode when the simulator is set to a parish', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>)
    await act(async () => {
      screen.getByText('simulate').click()
    })
    expect(screen.getByTestId('mode').textContent).toBe('present')
    expect(screen.getByTestId('parish').textContent).toBe('Mary Help of Christians Parish Guide')
  })

  it('returns to diocese mode when the simulator is switched off', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>)
    await act(async () => { screen.getByText('simulate').click() })
    expect(screen.getByTestId('mode').textContent).toBe('present')

    await act(async () => { screen.getByText('stop').click() })
    expect(screen.getByTestId('mode').textContent).toBe('diocese')
    expect(screen.getByTestId('parish').textContent).toBe('none')
  })
})
