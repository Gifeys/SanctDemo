/**
 * The client's side of the grounded assistant.
 *
 * ## Why this can always fail, and why that is fine
 *
 * Sancti was built to run on the device precisely because the Express
 * backend is not deployed, and an assistant whose first act is to fail
 * at a dead URL is worse than no assistant. That reasoning has not
 * changed; this does not replace the on-device matcher, it is only
 * reached for the questions the matcher could not place, and every
 * failure here returns null so the caller falls back to what it had.
 *
 * So: a short timeout, no retries, no error shown. A pilgrim asking a
 * question should never be left watching a spinner because a server is
 * asleep, and should never be told about a backend they did not know
 * existed.
 */
import { apiUrl } from './apiBase'
import { withAppKey } from './appKey'

/**
 * Short on purpose. Past a few seconds the pilgrim has already decided
 * the app is broken, and the on-device answer was available the whole
 * time.
 */
const TIMEOUT_MS = 8000

export interface AskRequest {
  question: string
  parishId?: string
  parishName?: string
  history?: Array<{ role: string; text: string }>
}

export interface AskReply {
  answer: string
  /** True when the answer rested on at least one verified parish fact. */
  grounded: boolean
  sources: Array<{ topic: string; source: 'parish' | 'app'; updatedAt: string | null }>
  gaps: string[]
}

/**
 * Ask the grounded assistant, or return null.
 *
 * Null covers every failure - no backend, a timeout, a 503, a malformed
 * body - because the caller does the same thing in all of them. It
 * never throws and never returns a fabricated answer.
 */
export async function askSancti(
  req: AskRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<AskReply | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetchImpl(apiUrl('/api/ask'), {
      method: 'POST',
      headers: withAppKey({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(req),
      signal: controller.signal,
    })
    if (!res.ok) return null

    const data = await res.json()
    const answer = typeof data?.answer === 'string' ? data.answer.trim() : ''
    // An empty answer is a failure wearing a 200. Falling back to the
    // on-device reply is better than showing a blank message bubble.
    if (!answer) return null

    return {
      answer,
      grounded: Boolean(data?.grounded),
      sources: Array.isArray(data?.sources) ? data.sources : [],
      gaps: Array.isArray(data?.gaps) ? data.gaps : [],
    }
  } catch {
    // Offline, aborted, non-JSON body - all the same outcome.
    return null
  } finally {
    clearTimeout(timer)
  }
}
