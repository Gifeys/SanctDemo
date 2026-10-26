/**
 * The six-digit code a parish administrator types after their password.
 *
 * Pure rules, no Firestore and no mail, so every decision here can be
 * tested without either.
 *
 * ## Why a code and not Firebase's email link
 *
 * The portal already had `sendSecondFactorLink`, which mails a link
 * that signs you in when you click it. That works, but it moves the
 * person out of the browser they were typing in and back through their
 * mail app, and on a shared parish computer the link sits in an inbox
 * anybody can open later. A code is read, typed, and spent.
 *
 * ## Why the code is hashed
 *
 * The stored record is readable by anybody who can read the database
 * as the server does. A plain code in that record is a password in
 * plain text with a ten-minute life; a hash is not.
 */

/** How long a code is good for. */
export const CODE_TTL_MS = 10 * 60 * 1000

/** How many wrong guesses before the code is burned. */
export const MAX_ATTEMPTS = 5

/** How long before another code may be requested. */
export const RESEND_COOLDOWN_MS = 60 * 1000

export interface OtpRecord {
  /** SHA-256 of the code. Never the code itself. */
  codeHash: string
  /** Epoch ms. */
  createdAt: number
  expiresAt: number
  attempts: number
  /** Set once the code has been spent, so it cannot be replayed. */
  usedAt?: number
}

/**
 * Six digits, uniformly.
 *
 * `% 1_000_000` on a random 32-bit integer is very slightly biased
 * toward the low end. Rejection sampling costs nothing here and
 * removes the argument entirely.
 */
export function generateCode(random: () => number = cryptoRandom): string {
  let n = random()
  while (n >= 4_000_000_000) n = random()
  return String(n % 1_000_000).padStart(6, '0')
}

function cryptoRandom(): number {
  // Node and the browser both expose this; the server is the only
  // caller, but the function stays testable either way.
  const bytes = new Uint32Array(1)
  ;(globalThis.crypto as Crypto).getRandomValues(bytes)
  return bytes[0]
}

export type OtpFailure = 'no-code' | 'expired' | 'used' | 'too-many' | 'wrong'

/**
 * One shape with an optional reason, not a discriminated union.
 *
 * This project compiles with `strict` off, which widens boolean
 * literal types so that `{ ok: true } | { ok: false; reason: R }`
 * cannot be narrowed at all - `if (!result.ok)` leaves `reason`
 * invisible to the compiler. lib/parishContent hit the same wall and
 * settled on this shape; following it keeps one convention rather
 * than two.
 */
export interface OtpCheck {
  ok: boolean
  reason?: OtpFailure
}

/**
 * Whether this code may be accepted, given what is stored.
 *
 * Deliberately returns a REASON rather than a boolean, because the
 * caller says different things for each: an expired code invites a
 * resend, a burned one does not, and a wrong digit should not reveal
 * how many guesses are left in a way that helps anybody guessing.
 */
export function checkCode(
  record: OtpRecord | null,
  supplied: string,
  suppliedHash: string,
  now: number = Date.now(),
): OtpCheck {
  if (!record) return { ok: false, reason: 'no-code' }
  if (record.usedAt) return { ok: false, reason: 'used' }
  if (now > record.expiresAt) return { ok: false, reason: 'expired' }
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too-many' }
  if (!/^\d{6}$/.test(supplied)) return { ok: false, reason: 'wrong' }
  if (suppliedHash !== record.codeHash) return { ok: false, reason: 'wrong' }
  return { ok: true }
}

/** Whether another code may be sent yet. */
export function mayResend(
  record: OtpRecord | null,
  now: number = Date.now(),
): boolean {
  if (!record) return true
  return now - record.createdAt >= RESEND_COOLDOWN_MS
}

/** What the person is told. Never how many attempts remain. */
export function messageFor(reason: OtpFailure): string {
  switch (reason) {
    case 'no-code':
      return 'No code has been sent. Ask for one and check your email.'
    case 'expired':
      return 'That code has expired. Ask for a new one.'
    case 'used':
      return 'That code has already been used. Ask for a new one.'
    case 'too-many':
      return 'Too many incorrect codes. Ask for a new one.'
    default:
      return 'That code is not right. Check your email and try again.'
  }
}

/**
 * Where the logo is fetched from.
 *
 * An absolute URL, because an email is read outside the app and a
 * relative path resolves against the mail client. A remote image and
 * not an embedded data URI: Gmail strips those.
 */
export const LOGO_URL =
  'https://sanct-demo-vxzb.vercel.app/ui/sanctiwalk-lockup-navy.png'

/**
 * The code email, in both forms a mail client may use.
 *
 * `body` is the plain-text part and stays readable on its own - some
 * clients show only that, and the code has to be findable there too.
 * `html` is the laid-out version with the parish mark.
 *
 * Written as tables with inline styles, which is not how anything else
 * in this project is written. Mail clients are not browsers: Gmail
 * drops <style> blocks and flexbox, so the layout has to survive
 * without either.
 */
export function codeEmail(
  code: string,
  parishName: string,
): { subject: string; body: string; html: string } {
  const subject = `${code} is your SanctiWalk parish office code`

  const body =
    `Your sign-in code for the ${parishName} parish office is:

` +
    `    ${code}

` +
    `It is good for ten minutes and can be used once.

` +
    `If you did not try to sign in, you can ignore this message — ` +
    `nobody can get in with your email address alone. If it keeps ` +
    `happening, change your password.
`

  const navy = '#1C2C56'
  const ink = '#14171F'
  const muted = '#63666D'
  const paper = '#E7E4DD'

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:${paper};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="max-width:460px;margin:0 auto;background:#FFFFFF;
                    border-radius:18px;border:1px solid #D5D1C8;">
        <tr><td align="center" style="padding:28px 28px 0 28px;">
          <img src="${LOGO_URL}" alt="SanctiWalk" width="168"
               style="display:block;width:168px;max-width:70%;height:auto;border:0;" />
        </td></tr>

        <tr><td align="center"
                style="padding:20px 28px 0 28px;font-family:Georgia,'Times New Roman',serif;
                       font-size:19px;font-style:italic;color:${ink};">
          Your sign-in code
        </td></tr>

        <tr><td align="center"
                style="padding:6px 28px 0 28px;font-family:Helvetica,Arial,sans-serif;
                       font-size:15px;line-height:22px;color:${muted};">
          For the ${escapeHtml(parishName)} parish office.
        </td></tr>

        <tr><td align="center" style="padding:20px 28px 0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center"
                    style="background:${paper};border-radius:14px;padding:16px 26px;
                           font-family:Helvetica,Arial,sans-serif;font-size:34px;
                           font-weight:bold;letter-spacing:9px;color:${navy};">
              ${code}
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center"
                style="padding:18px 28px 0 28px;font-family:Helvetica,Arial,sans-serif;
                       font-size:15px;line-height:22px;color:${ink};">
          It is good for ten minutes and can be used once.
        </td></tr>

        <tr><td style="padding:18px 28px 28px 28px;">
          <div style="border-top:1px solid #E6E2D9;padding-top:16px;
                      font-family:Helvetica,Arial,sans-serif;font-size:13px;
                      line-height:20px;color:${muted};">
            If you did not try to sign in, you can ignore this message &mdash;
            nobody can get in with your email address alone. If it keeps
            happening, change your password.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, body, html }
}

/** Parish names come from the database, so they are escaped. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
