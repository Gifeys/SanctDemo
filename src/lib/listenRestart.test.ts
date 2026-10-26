import { describe, expect, it } from 'vitest'

import {
  BACKOFF_MS,
  FREE_RESTARTS,
  IDLE,
  MAX_RESTARTS,
  afterHeard,
  afterRestart,
  listenLocales,
  planRestart,
} from './listenRestart'

const wanting = (attempts: number) => ({ attempts, wanted: true })

describe('planRestart', () => {
  it('does nothing when the pilgrim has stopped the microphone', () => {
    expect(planRestart({ ...IDLE, attempts: 0 }).restart).toBe(false)
  })

  it('restarts at once after a normal pause between prayers', () => {
    // The common case by far: Android ends the session after every
    // utterance, and a Rosary is hundreds of them.
    const plan = planRestart(wanting(0))
    expect(plan.restart).toBe(true)
    expect(plan.delayMs).toBe(0)
  })

  it('keeps restarting without delay for the first few', () => {
    for (let i = 0; i < FREE_RESTARTS; i++) {
      expect(planRestart(wanting(i)).delayMs).toBe(0)
    }
  })

  it('starts backing off once restarts keep failing', () => {
    // A tight loop here is a flat battery in somebody's pocket.
    expect(planRestart(wanting(FREE_RESTARTS)).delayMs).toBe(BACKOFF_MS[0])
    expect(planRestart(wanting(FREE_RESTARTS + 1)).delayMs).toBe(BACKOFF_MS[1])
  })

  it('holds at the longest delay rather than growing forever', () => {
    // Still trying, but well past the end of the backoff table.
    const last = BACKOFF_MS[BACKOFF_MS.length - 1]
    expect(planRestart(wanting(MAX_RESTARTS - 1)).delayMs).toBe(last)
    expect(planRestart(wanting(FREE_RESTARTS + BACKOFF_MS.length)).delayMs).toBe(last)
  })

  it('gives up eventually, and says so', () => {
    const plan = planRestart(wanting(MAX_RESTARTS))
    expect(plan.restart).toBe(false)
    expect(plan.giveUp).toBe(true)
  })

  it('never reports giving up while it is still trying', () => {
    expect(planRestart(wanting(MAX_RESTARTS - 1)).giveUp).toBe(false)
  })
})

describe('afterHeard', () => {
  it('resets the count, so a long Rosary is never cut off', () => {
    // Someone praying twenty minutes restarts the recogniser dozens of
    // times quite normally. Only restarts with nothing heard count.
    let state = wanting(MAX_RESTARTS - 1)
    state = afterHeard(state)
    expect(state.attempts).toBe(0)
    expect(planRestart(state).restart).toBe(true)
  })

  it('leaves the wanted flag alone', () => {
    expect(afterHeard(wanting(4)).wanted).toBe(true)
  })
})

describe('afterRestart', () => {
  it('counts up toward giving up', () => {
    expect(afterRestart(wanting(2)).attempts).toBe(3)
  })
})

describe('listenLocales', () => {
  it('tries Filipino first for a Tagalog Rosary', () => {
    expect(listenLocales('fil')[0]).toBe('fil-PH')
  })

  it('falls back to English rather than losing the feature', () => {
    // Filipino recognition is not on every handset. Asking for fil-PH
    // and giving up when it throws is how a Tagalog Rosary silently
    // stopped following the voice.
    expect(listenLocales('fil')).toContain('en-US')
  })

  it('prefers Philippine English before American', () => {
    const locales = listenLocales('en')
    expect(locales.indexOf('en-PH')).toBeLessThan(locales.indexOf('en-US'))
  })

  it('always offers at least one locale', () => {
    for (const lang of ['fil', 'en'] as const) {
      expect(listenLocales(lang).length).toBeGreaterThan(0)
    }
  })
})
