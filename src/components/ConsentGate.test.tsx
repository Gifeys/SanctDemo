import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import ConsentGate from './ConsentGate'
import { needsConsent, saveConsent } from '../lib/consent'

function show() {
  return render(
    <ConsentGate>
      <p>the parish app</p>
    </ConsentGate>,
  )
}

const continueButton = () =>
  screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement

const box = (match: RegExp) =>
  screen.getByLabelText(match) as HTMLInputElement

beforeEach(() => {
  localStorage.clear()
})

describe('first launch', () => {
  it('shows the notices instead of the app', () => {
    show()
    expect(screen.getByText('Welcome to SanctiWalk')).toBeTruthy()
    expect(screen.queryByText('the parish app')).toBeNull()
  })

  it('offers both documents', () => {
    show()
    expect(screen.getByText('Terms and Conditions')).toBeTruthy()
    expect(screen.getByText('Privacy Notice')).toBeTruthy()
  })

  it('will not let anybody through until both are ticked', () => {
    show()
    expect(continueButton().disabled).toBe(true)

    fireEvent.click(box(/agree to the Terms/i))
    expect(continueButton().disabled).toBe(true)

    fireEvent.click(box(/understood the Privacy Notice/i))
    expect(continueButton().disabled).toBe(false)
  })

  it('goes back to disabled if a box is unticked again', () => {
    show()
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/understood the Privacy Notice/i))
    fireEvent.click(box(/agree to the Terms/i))
    expect(continueButton().disabled).toBe(true)
  })
})

describe('continuing', () => {
  it('shows the app once accepted', () => {
    show()
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/understood the Privacy Notice/i))
    fireEvent.click(continueButton())
    expect(screen.getByText('the parish app')).toBeTruthy()
  })

  it('remembers, so the next launch goes straight in', () => {
    show()
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/understood the Privacy Notice/i))
    fireEvent.click(continueButton())
    expect(needsConsent()).toBe(false)
  })

  it('does not stop somebody who already accepted', () => {
    saveConsent(true, true)
    show()
    expect(screen.getByText('the parish app')).toBeTruthy()
    expect(screen.queryByText('Welcome to SanctiWalk')).toBeNull()
  })
})

describe('reading a document in full', () => {
  it('opens the terms and comes back', () => {
    show()
    const [readTerms] = screen.getAllByRole('button', { name: 'Read in full' })
    fireEvent.click(readTerms)
    // A section heading that only exists in the full text.
    expect(screen.getByText(/What SanctiWalk is/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText('Welcome to SanctiWalk')).toBeTruthy()
  })

  it('keeps the boxes ticked while reading', () => {
    show()
    fireEvent.click(box(/agree to the Terms/i))
    const [readTerms] = screen.getAllByRole('button', { name: 'Read in full' })
    fireEvent.click(readTerms)
    fireEvent.click(screen.getByRole('button', { name: /Done/i }))
    expect(box(/agree to the Terms/i).checked).toBe(true)
  })

  it('the privacy notice says photographs are not stored', () => {
    // The one factual claim in the notice that a reader is most likely
    // to care about, and the one most easily broken by a later change.
    show()
    const buttons = screen.getAllByRole('button', { name: 'Read in full' })
    fireEvent.click(buttons[1])
    expect(screen.getByText(/not stored by SanctiWalk in any form/i)).toBeTruthy()
  })

  it('flags what still needs the parish to confirm it', () => {
    show()
    const buttons = screen.getAllByRole('button', { name: 'Read in full' })
    fireEvent.click(buttons[1])
    expect(screen.getAllByText(/NEEDS CONFIRMATION/).length).toBeGreaterThan(0)
  })
})
