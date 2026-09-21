// Ministry applications: the document shape, and how a status is shown.
//
// This reuses the existing `applications` collection rather than adding a
// second one. That collection already carries sacrament bookings, already
// has Firestore rules scoping reads to the owning uid, and is already
// listened to in App.tsx and rendered in both Me and the admin portal. A
// parallel collection would mean duplicating all of it.
//
// So a ministry application is an application with `type` set to
// MINISTRY_APPLICATION_TYPE and some extra fields. The old fields
// (applicant, details, date, status) are still written, because the admin
// portal and the pilgrim's own list read them - the new structured fields
// sit alongside so both views can be precise about ministry and parish
// instead of parsing them back out of a sentence.

export const MINISTRY_APPLICATION_TYPE = 'Ministry Application'

/** The only four statuses a ministry application moves through. */
export const MINISTRY_STATUSES = ['Pending', 'Under Review', 'Approved', 'Declined'] as const

export type MinistryStatus = (typeof MINISTRY_STATUSES)[number]

/** Every application starts here. The parish office moves it along. */
export const DEFAULT_MINISTRY_STATUS: MinistryStatus = 'Pending'

export interface MinistryApplicationInput {
  uid: string
  fullName: string
  email: string
  mobile: string
  ministryId: string
  ministryName: string
  parishId: string
  parishName: string
  message: string
  /** The applicant ticked the box agreeing to be contacted. */
  consent: boolean
  /** Injected so the document is testable without mocking the clock. */
  now?: Date
}

export interface MinistryApplicationDoc {
  type: typeof MINISTRY_APPLICATION_TYPE
  uid: string
  applicant: string
  email: string
  mobile: string
  ministryId: string
  ministryName: string
  parishId: string
  parishName: string
  message: string
  consent: boolean
  details: string
  date: string
  submittedAt: string
  status: MinistryStatus
}

/**
 * Builds the document to store. `id` is Firestore's to assign, and `uid`
 * must be the signed-in user's or the rules reject the write.
 */
export function buildMinistryApplication(input: MinistryApplicationInput): MinistryApplicationDoc {
  const now = input.now ?? new Date()
  const mobile = input.mobile.trim()
  const message = input.message.trim()

  return {
    type: MINISTRY_APPLICATION_TYPE,
    uid: input.uid,
    applicant: input.fullName.trim(),
    email: input.email.trim(),
    mobile,
    ministryId: input.ministryId,
    ministryName: input.ministryName,
    parishId: input.parishId,
    parishName: input.parishName,
    message,
    consent: input.consent,

    // Kept for the views that predate the structured fields. It is a
    // summary, never the source of truth - anything reading ministry or
    // parish should read those fields.
    details: `${input.ministryName} — ${input.parishName}`,

    // `date` is what the existing lists display; submittedAt is the exact
    // instant, kept separately because a localised date string cannot be
    // sorted or compared reliably.
    date: now.toLocaleDateString(),
    submittedAt: now.toISOString(),

    status: DEFAULT_MINISTRY_STATUS,
  }
}

export function isMinistryApplication(app: { type?: string }): boolean {
  return app.type === MINISTRY_APPLICATION_TYPE
}

export interface StatusPresentation {
  label: string
  /** The coloured dot the brief asks for. */
  dot: string
  /** Tailwind classes for the pill. */
  className: string
}

const PRESENTATIONS: Record<MinistryStatus, StatusPresentation> = {
  Pending: { label: 'Pending', dot: '🟡', className: 'bg-amber-50 text-amber-900 border-amber-200' },
  'Under Review': { label: 'Under Review', dot: '🔵', className: 'bg-blue-50 text-blue-900 border-blue-200' },
  Approved: { label: 'Approved', dot: '🟢', className: 'bg-green-50 text-green-900 border-green-200' },
  Declined: { label: 'Declined', dot: '🔴', className: 'bg-red-50 text-red-900 border-red-200' },
}

/**
 * How to show a status, including ones written before these four existed.
 *
 * The collection already holds statuses like "Interview Scheduled" and
 * "Approved (Simulated)" from the sacrament flow and the email modals.
 * Rewriting those rows would be a migration nobody asked for, and showing
 * them as "Pending" would be a lie, so they are matched by meaning and
 * shown with their own words.
 */
export function statusPresentation(status: string): StatusPresentation {
  const exact = PRESENTATIONS[status as MinistryStatus]
  if (exact) return exact

  const lower = status.toLowerCase()
  if (lower.includes('declin') || lower.includes('reject')) {
    return { ...PRESENTATIONS.Declined, label: status }
  }
  if (lower.includes('approve')) {
    return { ...PRESENTATIONS.Approved, label: status }
  }
  // "Awaiting" is checked before "interview" deliberately. "Awaiting Parish
  // Interview" says the parish has not acted yet, which is Pending; reading
  // the word "interview" first would report it as already under review.
  if (lower.includes('pending') || lower.includes('awaiting')) {
    return { ...PRESENTATIONS.Pending, label: status }
  }
  if (lower.includes('review') || lower.includes('interview') || lower.includes('schedul')) {
    return { ...PRESENTATIONS['Under Review'], label: status }
  }

  // Unrecognised: show it plainly rather than guess a colour that implies
  // an outcome.
  return { label: status, dot: '⚪', className: 'bg-[var(--color-brand-card)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]' }
}
