/**
 * Retrying a congested vision model.
 *
 * Extracted from server.ts so the sequencing can be tested. It earned that:
 * six consecutive scans from a real phone were logged failing with
 * `503 UNAVAILABLE — "This model is currently experiencing high demand"`,
 * and because there was no retry at all, every one surfaced to the pilgrim as
 * a flat "Recognition failed. Please try again." The feature looked broken
 * when nothing about it was.
 */

/** Backoff before the second and third attempts. */
export const RETRY_BACKOFF_MS = [400, 1500]

/**
 * How long any single attempt may run before it is abandoned.
 *
 * Set from measurement, not taste. Against the app's real 208 KB / 960px
 * capture:
 *
 *   gemini-3.5-flash-lite   503 after 108s, then 503 after 3.3s
 *   gemini-3.5-flash        answered in 7.3s, then in 18.5s
 *
 * The 108s is the important one. The model was congested, and the SDK retries
 * a 503 internally with its own long backoff before surfacing it — so what
 * looks like a hang is really the SDK still trying. This cap is what cuts
 * that short. It sits above the slowest observed SUCCESS (18.5s) so a genuine
 * answer is never thrown away to save a few seconds.
 */
export const ATTEMPT_TIMEOUT_MS = 20000

/**
 * The ceiling on the WHOLE sequence — every attempt and every backoff.
 *
 * This must stay below the client's own abort (SCAN_TIMEOUT_MS in
 * ArTour.tsx) or the retries are worse than useless: the pilgrim is shown a
 * timeout while the server is still working towards an answer it can no
 * longer deliver, and the honest "the service is busy" — the more useful
 * message, and the entire point of retrying — never reaches them. That is
 * not hypothetical: an earlier 21s deadline let a fourth attempt start at
 * 19.9s and return at 26.3s, past the client's 25s.
 */
export const OVERALL_DEADLINE_MS = 40000

/**
 * True for the errors worth trying again: this model's serving capacity is
 * full right now, which is a temporary property of the provider's fleet
 * rather than anything about the request.
 *
 * A 429 is deliberately NOT busy. That is a quota decision — the allowance is
 * spent, and asking again cannot succeed, it only spends the remainder
 * faster. Neither is a bad key or a malformed request: those fail identically
 * however many times they are asked, so retrying them only delays the honest
 * error by three seconds.
 */
export function isModelBusy(message: string): boolean {
  return /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(message)
}

/**
 * True for an attempt that was abandoned rather than answered.
 *
 * Retried for the same reason congestion is: a call that hangs says nothing
 * about whether the next one will, and the fallback is a different service
 * that may well answer at once.
 */
export function isTimeout(message: string): boolean {
  return /abort|timed? ?out|ETIMEDOUT|deadline/i.test(message)
}

/** Every failure worth another attempt. Everything else is rethrown at once. */
export function isRetryable(message: string): boolean {
  return isModelBusy(message) || isTimeout(message)
}

export interface RetryPlanStep {
  /** Milliseconds to wait before this attempt. 0 for the first. */
  waitMs: number
  /** Which model to ask. */
  model: string
  /** True once the primary has been given up on. */
  isFallback: boolean
}

/**
 * The sequence of attempts: the primary once, then the fallback twice.
 *
 * The primary gets ONE try, not three. Measurement drove this: while
 * flash-lite was congested it refused every request, and the fallback
 * answered correctly first time. Asking a saturated pool three times spends
 * the pilgrim's patience to learn what the first refusal already said.
 *
 * The fallback must not be another model from the same congested family — a
 * 503 means that pool is saturated, so retrying inside it is the one thing
 * guaranteed not to help. Separate models also hold separate free-tier
 * quotas, so falling back neither borrows nor exhausts the primary's.
 */
export function retryPlan(primary: string, fallback: string): RetryPlanStep[] {
  return [
    { waitMs: 0, model: primary, isFallback: false },
    { waitMs: RETRY_BACKOFF_MS[0], model: fallback, isFallback: true },
    { waitMs: RETRY_BACKOFF_MS[1], model: fallback, isFallback: true },
  ]
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface AttemptOutcome<T> {
  value: T
  model: string
  /** 1-based, so a log line reads the way a person counts. */
  attempt: number
}

/**
 * Runs `ask` against each step of the plan until one succeeds.
 *
 * Rethrows a non-busy error IMMEDIATELY rather than working through the
 * remaining attempts — a wrong API key is not going to become right, and
 * making the pilgrim wait three seconds to be told so is worse than telling
 * them at once.
 */
export async function askWithRetry<T>(
  plan: RetryPlanStep[],
  ask: (model: string, timeoutMs: number) => Promise<T>,
  hooks: {
    onBusy?: (model: string, attempt: number) => void
    wait?: (ms: number) => Promise<void>
    now?: () => number
    deadlineMs?: number
  } = {},
): Promise<AttemptOutcome<T>> {
  const wait = hooks.wait ?? sleep
  const now = hooks.now ?? Date.now
  const deadlineMs = hooks.deadlineMs ?? OVERALL_DEADLINE_MS
  const startedAt = now()
  let lastError: unknown = null

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]

    // The deadline only ever cancels a RETRY. The first attempt always runs:
    // a deadline already spent is a reason to stop trying again, never a
    // reason to have asked nothing at all and report a failure that no call
    // was ever made to earn.
    if (i > 0) {
      // Checked before the backoff as well as after it, so a sequence that
      // has already run long does not sleep two more seconds only to start a
      // call it has no time left to finish.
      if (now() - startedAt + step.waitMs >= deadlineMs) break
      if (step.waitMs > 0) await wait(step.waitMs)
      if (now() - startedAt >= deadlineMs) break
    }

    // Each attempt gets whatever is LEFT of the deadline, capped at the
    // per-attempt limit — never a flat 12s.
    //
    // A flat limit overruns: measured end to end, four attempts of up to 12s
    // plus backoff returned at 26.3s, past the client's own 25s abort. The
    // pilgrim was then shown "no answer in 25 seconds" instead of the honest
    // "the service is busy", which is the more useful of the two and the
    // whole reason for the retry. Handing each attempt only the remaining
    // time makes the total impossible to exceed.
    const remaining = deadlineMs - (now() - startedAt)
    const attemptTimeout = Math.min(ATTEMPT_TIMEOUT_MS, Math.max(1000, remaining))

    try {
      return { value: await ask(step.model, attemptTimeout), model: step.model, attempt: i + 1 }
    } catch (error) {
      const message = String((error as { message?: unknown })?.message ?? error)
      if (!isRetryable(message)) throw error
      hooks.onBusy?.(step.model, i + 1)
      lastError = error
    }
  }

  // Only reachable having failed at least once: the first attempt is never
  // skipped by the deadline check above.
  throw lastError
}
