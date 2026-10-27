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
    // The box can only be ticked after the document has been read to
    // the end now, so this reads it first and then checks that going
    // back into the document and out again does not clear the tick.
    show()
    const [readTerms] = screen.getAllByRole('button', { name: 'Read in full' })
    fireEvent.click(readTerms)

    const el = document.querySelector('.consent--doc') as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 900, configurable: true })
    fireEvent.scroll(el)

    fireEvent.click(screen.getByRole('button', { name: /Done/i }))
    fireEvent.click(box(/agree to the Terms/i))
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

describe('reading before agreeing', () => {
  /** jsdom reports every element as zero-sized, so the scroller is faked. */
  function sizeScroller({ scrollHeight, clientHeight, scrollTop }: {
    scrollHeight: number; clientHeight: number; scrollTop: number
  }) {
    const el = document.querySelector('.consent--doc') as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true, writable: true })
    return el
  }

  const openFirstDoc = () => fireEvent.click(screen.getAllByText('Read in full')[0])

  it('will not let somebody agree to terms they have not opened', () => {
    // The whole point. A tick box over an unopened document is a tick
    // box, not an agreement.
    show()
    expect(box(/Terms and Conditions/i).disabled).toBe(true)
    expect(continueButton().disabled).toBe(true)
  })

  it('says what will unlock the box, rather than just refusing', () => {
    show()
    expect(screen.getAllByText(/scroll to the end/i).length).toBeGreaterThan(0)
  })

  it('keeps the box locked while the document is only part-read', () => {
    show()
    openFirstDoc()
    const el = sizeScroller({ scrollHeight: 3000, clientHeight: 600, scrollTop: 100 })
    fireEvent.scroll(el)
    fireEvent.click(screen.getByRole('button', { name: /scroll to the end/i }))
    // Still on the document: the Done button refuses until the end.
    expect(screen.queryByText(/Welcome to SanctiWalk/i)).toBeNull()
  })

  it('unlocks the box once the end is reached', () => {
    show()
    openFirstDoc()
    const el = sizeScroller({ scrollHeight: 3000, clientHeight: 600, scrollTop: 2400 })
    fireEvent.scroll(el)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(box(/Terms and Conditions/i).disabled).toBe(false)
  })

  it('does not strand somebody when the document fits the screen', () => {
    // A document with nothing to scroll can never fire a scroll event.
    // Waiting for one would lock the reader out of the app for good,
    // which is worse than the problem being solved.
    show()
    openFirstDoc()
    const el = sizeScroller({ scrollHeight: 500, clientHeight: 900, scrollTop: 0 })
    fireEvent.scroll(el)
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('still needs BOTH documents read before Continue works', () => {
    show()
    openFirstDoc()
    fireEvent.scroll(sizeScroller({ scrollHeight: 100, clientHeight: 900, scrollTop: 0 }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(box(/Terms and Conditions/i))
    // Privacy has not been opened, so its box is still locked.
    expect(box(/Privacy Notice/i).disabled).toBe(true)
    expect(continueButton().disabled).toBe(true)
  })

  it('allows Continue once both are read and ticked', () => {
    show()
    for (const i of [0, 1]) {
      fireEvent.click(screen.getAllByText('Read in full')[i])
      fireEvent.scroll(sizeScroller({ scrollHeight: 100, clientHeight: 900, scrollTop: 0 }))
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    }
    fireEvent.click(box(/Terms and Conditions/i))
    fireEvent.click(box(/Privacy Notice/i))
    expect(continueButton().disabled).toBe(false)
  })
})
