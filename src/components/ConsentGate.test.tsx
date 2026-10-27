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

/**
 * The Continue button, whatever it currently says.
 *
 * Its label changes to "Scroll to the end to continue" until the
 * notices have been read, so matching the word "Continue" alone is
 * what every one of these tests actually means.
 */
const continueButton = () =>
  screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement

/** Pretends the notices have been scrolled through. */
const scrollToEnd = () => {
  const el = document.querySelector('.consent') as HTMLElement
  Object.defineProperty(el, 'scrollHeight', { value: 4000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 800, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: 3200, configurable: true, writable: true })
  fireEvent.scroll(el)
}

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
    // Reading is now a separate condition; this test is about the
    // boxes, so it is satisfied first.
    scrollToEnd()
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
    scrollToEnd()
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/understood the Privacy Notice/i))
    fireEvent.click(continueButton())
    expect(screen.getByText('the parish app')).toBeTruthy()
  })

  it('remembers, so the next launch goes straight in', () => {
    show()
    scrollToEnd()
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

describe('what the notices say', () => {
  /* Two tests stood here covering the "Read in full" screen - opening
     a document and coming back, and the boxes staying ticked while
     away. Both are gone with the button: the documents are on the
     consent screen itself now, so there is nowhere to go and nothing
     to come back from. What replaced them is in "reading before
     agreeing" below. */

  it('the privacy notice says photographs are not stored', () => {
    // The one factual claim in the notice that a reader is most likely
    // to care about, and the one most easily broken by a later change.
    show()
    expect(screen.getByText(/not stored by SanctiWalk in any form/i)).toBeTruthy()
  })

  it('flags what still needs the parish to confirm it', () => {
    show()
    expect(screen.getAllByText(/NEEDS CONFIRMATION/).length).toBeGreaterThan(0)
  })
})

describe('reading before agreeing', () => {
  /** jsdom reports every element as zero-sized, so the scroller is faked. */
  function scrollTo({ scrollHeight, clientHeight, scrollTop }: {
    scrollHeight: number; clientHeight: number; scrollTop: number
  }) {
    const el = document.querySelector('.consent') as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true, writable: true })
    fireEvent.scroll(el)
    return el
  }

  it('puts both documents on the screen, in full', () => {
    // They used to be summaries behind a "Read in full" button, which
    // meant somebody could agree without opening either.
    show()
    expect(screen.queryByText('Read in full')).toBeNull()
    // Each title now appears twice - as the document's heading and in
    // its checkbox - so this asks for the headings.
    expect(screen.getByRole('heading', { name: /Terms and Conditions/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Privacy Notice/i })).toBeTruthy()
  })

  it('refuses to continue before the end is reached', () => {
    show()
    scrollTo({ scrollHeight: 4000, clientHeight: 800, scrollTop: 0 })
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/Privacy Notice/i))
    expect(continueButton().disabled).toBe(true)
  })

  it('says what is wanted, rather than just refusing', () => {
    show()
    scrollTo({ scrollHeight: 4000, clientHeight: 800, scrollTop: 0 })
    expect(screen.getByRole('button', { name: /scroll to the end/i })).toBeTruthy()
  })

  it('allows it once scrolled to the end and both are ticked', () => {
    show()
    scrollTo({ scrollHeight: 4000, clientHeight: 800, scrollTop: 3200 })
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/Privacy Notice/i))
    expect(continueButton().disabled).toBe(false)
  })

  it('still needs both boxes, scrolled or not', () => {
    show()
    scrollTo({ scrollHeight: 4000, clientHeight: 800, scrollTop: 3200 })
    fireEvent.click(box(/agree to the Terms/i))
    expect(continueButton().disabled).toBe(true)
  })

  it('does not strand somebody whose screen fits the whole thing', () => {
    // Content with nothing to scroll can never fire a scroll event.
    // Waiting for one would lock them out of the app for good.
    show()
    scrollTo({ scrollHeight: 500, clientHeight: 900, scrollTop: 0 })
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/Privacy Notice/i))
    expect(continueButton().disabled).toBe(false)
  })

  it('does not unlock before anything has been laid out', () => {
    // Pre-layout both heights are 0, and 0 <= 0 + 1 is true - which
    // would open the gate before a word had been painted.
    show()
    scrollTo({ scrollHeight: 0, clientHeight: 0, scrollTop: 0 })
    fireEvent.click(box(/agree to the Terms/i))
    fireEvent.click(box(/Privacy Notice/i))
    expect(continueButton().disabled).toBe(true)
  })
})
