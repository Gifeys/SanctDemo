import { describe, expect, it, vi } from 'vitest'
import {
  ATTEMPT_TIMEOUT_MS,
  OVERALL_DEADLINE_MS,
  askWithRetry,
  isModelBusy,
  isRetryable,
  isTimeout,
  retryPlan,
} from './modelRetry'

// The exact message Google returned on the six phone scans that started this.
const REAL_503 =
  '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}'

describe('isModelBusy', () => {
  it('recognises the real 503 the phone actually received', () => {
    expect(isModelBusy(REAL_503)).toBe(true)
  })

  it('recognises the other ways congestion is worded', () => {
    expect(isModelBusy('UNAVAILABLE')).toBe(true)
    expect(isModelBusy('The model is overloaded')).toBe(true)
    expect(isModelBusy('Error 503 from upstream')).toBe(true)
  })

  it('does NOT treat a quota refusal as busy — retrying spends the rest for nothing', () => {
    expect(isModelBusy('429 RESOURCE_EXHAUSTED')).toBe(false)
  })

  it('does not treat configuration or request faults as busy', () => {
    expect(isModelBusy('API key not valid. PERMISSION_DENIED')).toBe(false)
    expect(isModelBusy('400 INVALID_ARGUMENT')).toBe(false)
    expect(isModelBusy('404 NOT_FOUND: model does not exist')).toBe(false)
  })

  it('does not match a 503 embedded in a longer number', () => {
    expect(isModelBusy('request id 1050377')).toBe(false)
  })
})

describe('isTimeout', () => {
  it('recognises an abandoned attempt', () => {
    // The message the SDK actually produced when the abort signal fired.
    expect(isTimeout('This operation was aborted')).toBe(true)
    expect(isTimeout('AbortError')).toBe(true)
    expect(isTimeout('ETIMEDOUT')).toBe(true)
    expect(isTimeout('Deadline exceeded')).toBe(true)
    expect(isTimeout('request timed out')).toBe(true)
  })

  it('does not treat an ordinary failure as a timeout', () => {
    expect(isTimeout('API key not valid')).toBe(false)
    expect(isTimeout('429 RESOURCE_EXHAUSTED')).toBe(false)
  })
})

describe('isRetryable', () => {
  it('covers congestion and abandoned attempts, and nothing else', () => {
    expect(isRetryable('503 UNAVAILABLE')).toBe(true)
    expect(isRetryable('This operation was aborted')).toBe(true)
    expect(isRetryable('API key not valid')).toBe(false)
    expect(isRetryable('429 RESOURCE_EXHAUSTED')).toBe(false)
  })
})

describe('retryPlan', () => {
  const plan = retryPlan('primary-lite', 'fallback-full')

  it('tries the primary once, then the fallback twice', () => {
    // One try at the primary, not three. Measured: while the primary was
    // congested it refused every request and the fallback answered correctly
    // first time, so asking a saturated pool again only spends patience.
    expect(plan.map(s => s.model)).toEqual(['primary-lite', 'fallback-full', 'fallback-full'])
  })

  it('does not wait before the first attempt', () => {
    expect(plan[0].waitMs).toBe(0)
  })

  it('backs off further each time', () => {
    const waits = plan.map(s => s.waitMs)
    for (let i = 2; i < waits.length; i++) {
      expect(waits[i]).toBeGreaterThan(waits[i - 1])
    }
  })

  it('marks every fallback step as one, and never the primary', () => {
    expect(plan[0].isFallback).toBe(false)
    expect(plan.slice(1).every(s => s.isFallback)).toBe(true)
  })
})

describe('askWithRetry', () => {
  const plan = retryPlan('primary', 'fallback')
  // Waiting is stubbed out: these assert the sequence, not the clock.
  const noWait = { wait: async () => {} }

  it('returns the first answer without retrying when the model is free', async () => {
    const ask = vi.fn().mockResolvedValue('ok')
    const result = await askWithRetry(plan, ask, noWait)

    expect(result).toMatchObject({ value: 'ok', model: 'primary', attempt: 1 })
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('recovers on a later attempt when the congestion clears', async () => {
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new Error(REAL_503))
      .mockResolvedValueOnce('recovered')

    const result = await askWithRetry(plan, ask, noWait)

    expect(result).toMatchObject({ value: 'recovered', attempt: 2 })
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('reaches the fallback model on the very next attempt when the primary is busy', async () => {
    const ask = vi.fn(async (model: string) => {
      if (model === 'primary') throw new Error(REAL_503)
      return 'from fallback'
    })

    const result = await askWithRetry(plan, ask, noWait)

    expect(result).toMatchObject({ value: 'from fallback', model: 'fallback' })
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('rethrows the busy error once every attempt is spent', async () => {
    const ask = vi.fn().mockRejectedValue(new Error(REAL_503))
    await expect(askWithRetry(plan, ask, noWait)).rejects.toThrow(/high demand/)
    expect(ask).toHaveBeenCalledTimes(plan.length)
  })

  it('gives up IMMEDIATELY on an error retrying cannot fix', async () => {
    const ask = vi.fn().mockRejectedValue(new Error('API key not valid'))

    await expect(askWithRetry(plan, ask, noWait)).rejects.toThrow(/API key/)
    // The whole point: one attempt, not three, so the honest error is not
    // delayed by seconds of pointless backoff.
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('does not retry an exhausted quota', async () => {
    const ask = vi.fn().mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'))
    await expect(askWithRetry(plan, ask, noWait)).rejects.toThrow(/RESOURCE_EXHAUSTED/)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('waits before every retry but never before the first attempt', async () => {
    const waits: number[] = []
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new Error(REAL_503))
      .mockResolvedValueOnce('ok')

    await askWithRetry(plan, ask, {
      wait: async ms => {
        waits.push(ms)
      },
    })

    expect(waits).toEqual([plan[1].waitMs])
  })

  it('reports each failed attempt, so a congested run is visible in the log', async () => {
    const onBusy = vi.fn()
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new Error(REAL_503))
      .mockRejectedValueOnce(new Error(REAL_503))
      .mockResolvedValueOnce('ok')

    await askWithRetry(plan, ask, { ...noWait, onBusy })

    expect(onBusy).toHaveBeenCalledTimes(2)
    expect(onBusy).toHaveBeenNthCalledWith(1, 'primary', 1)
    expect(onBusy).toHaveBeenNthCalledWith(2, 'fallback', 2)
  })
})

describe('askWithRetry deadline', () => {
  const plan = retryPlan('primary', 'fallback')

  it('retries an abandoned attempt rather than giving up on it', async () => {
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new Error('This operation was aborted'))
      .mockResolvedValueOnce('ok')

    const result = await askWithRetry(plan, ask, { wait: async () => {} })
    expect(result.value).toBe('ok')
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('stops starting attempts once the overall deadline has passed', async () => {
    // A clock that jumps 30s per reading: the deadline is crossed before the
    // planned attempts are used up.
    let clock = 0
    const now = () => (clock += 30000)
    const ask = vi.fn().mockRejectedValue(new Error('503 UNAVAILABLE'))

    await expect(
      askWithRetry(plan, ask, { wait: async () => {}, now, deadlineMs: OVERALL_DEADLINE_MS }),
    ).rejects.toThrow(/UNAVAILABLE/)

    expect(ask.mock.calls.length).toBeLessThan(plan.length)
    expect(ask).toHaveBeenCalled()
  })

  it('always makes at least one attempt, however tight the deadline', async () => {
    // A deadline already spent is a reason to stop trying AGAIN — never a
    // reason to report a failure no call was ever made to earn.
    const ask = vi.fn().mockResolvedValue('ok')
    const result = await askWithRetry(plan, ask, { wait: async () => {}, deadlineMs: 0 })
    expect(result.value).toBe('ok')
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('leaves the whole sequence room to finish inside the client timeout', () => {
    // ArTour.tsx aborts at SCAN_TIMEOUT_MS (45s). A server still retrying past
    // that is working towards an answer it can no longer deliver, and the
    // pilgrim sees a bare timeout instead of the honest "the service is busy".
    expect(OVERALL_DEADLINE_MS).toBeLessThan(45000)
  })

  it('never lets a single attempt outlast the whole sequence', () => {
    expect(ATTEMPT_TIMEOUT_MS).toBeLessThan(OVERALL_DEADLINE_MS)
  })

  it('sits above the slowest measured success, so a real answer is never cut off', () => {
    // gemini-3.5-flash answered in 18.5s on the app's own capture size.
    expect(ATTEMPT_TIMEOUT_MS).toBeGreaterThan(18500)
  })

  it('gives each attempt only the time left, so the total cannot overrun', async () => {
    // The bug this replaced: a flat per-attempt limit let a late attempt start
    // just inside the deadline and run well past it — measured returning at
    // 26.3s against a 21s deadline, past the client's own abort.
    const budgets: number[] = []
    let clock = 0
    const ask = vi.fn(async (_model: string, timeoutMs: number) => {
      budgets.push(timeoutMs)
      // Long enough that after the first attempt less than a full per-attempt
      // budget is left inside the 40s deadline.
      clock += 26000
      throw new Error(REAL_503)
    })

    await expect(
      askWithRetry(plan, ask, { wait: async () => {}, now: () => clock, deadlineMs: 40000 }),
    ).rejects.toThrow()

    expect(budgets[0]).toBe(ATTEMPT_TIMEOUT_MS)
    // By the second attempt less than a full budget remains, so less is given.
    expect(budgets[1]).toBeLessThan(ATTEMPT_TIMEOUT_MS)
    expect(budgets.every(b => b > 0)).toBe(true)
  })
})
