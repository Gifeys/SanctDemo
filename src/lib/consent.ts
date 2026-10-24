/**
 * Whether this device has accepted the Terms and the Privacy Notice.
 *
 * ## Why a version and not a boolean
 *
 * A plain "accepted: true" cannot tell the difference between somebody
 * who accepted today's terms and somebody who accepted a draft from
 * before the parish reviewed them. The version is recorded with the
 * acceptance, so raising CONSENT_VERSION below asks everyone again -
 * and nothing else has to change.
 *
 * Only raise it when the documents change MATERIALLY. Re-asking for a
 * typo trains people to tap through without reading, which is the one
 * outcome a consent screen must not produce.
 *
 * ## Why the two answers are stored separately
 *
 * Agreeing to the Terms and acknowledging the Privacy Notice are
 * different acts, and the Data Privacy Act treats them differently.
 * Storing one flag for both would make it impossible to show, later,
 * that the person was told how their data is handled as distinct from
 * accepting the rules of use.
 */

/**
 * Raise this when the Terms or the Privacy Notice materially change.
 *
 * 1 — first published version.
 */
export const CONSENT_VERSION = 1

const KEY = 'sanctiwalk.consent.v1'

export interface ConsentRecord {
  /** The CONSENT_VERSION that was on screen when they accepted. */
  version: number
  /** Agreed to the Terms and Conditions. */
  terms: boolean
  /** Acknowledged having read the Privacy Notice. */
  privacy: boolean
  /** ISO 8601, from the device clock. */
  at: string
}

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const r = parsed as Record<string, unknown>
    if (typeof r.version !== 'number') return null
    return {
      version: r.version,
      terms: r.terms === true,
      privacy: r.privacy === true,
      at: typeof r.at === 'string' ? r.at : '',
    }
  } catch {
    // Storage unavailable or holding something else. Treated as "not
    // yet accepted", which shows the screen again - the safe direction.
    return null
  }
}

/**
 * Whether the screen should be shown.
 *
 * Both answers are required, and both must have been given against the
 * CURRENT version. An older acceptance is not carried forward, because
 * the point of the version is that the document they saw was different.
 */
export function needsConsent(record: ConsentRecord | null = readConsent()): boolean {
  if (!record) return true
  if (record.version !== CONSENT_VERSION) return true
  return !(record.terms && record.privacy)
}

export function saveConsent(terms: boolean, privacy: boolean): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    terms,
    privacy,
    at: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Private mode, or storage refused. The person has still answered,
    // so this session continues; they will simply be asked again next
    // launch rather than being locked out.
  }
  return record
}

/** For testing and for a future "withdraw" control in Settings. */
export function clearConsent(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
