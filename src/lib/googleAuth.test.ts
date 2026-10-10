import { describe, expect, it } from 'vitest'
import { googleProfileFrom, needsProfile, signInRoute } from './googleAuth'

describe('signInRoute', () => {
  it('uses the native account picker inside the installed app', () => {
    // Google refuses OAuth from an embedded webview and answers
    // "disallowed_useragent". A popup in the APK does not fail
    // gracefully; it shows the pilgrim a Google error page. The native
    // picker is the only route that works there.
    expect(signInRoute(true)).toBe('native')
  })

  it('uses the browser popup on the web', () => {
    expect(signInRoute(false)).toBe('popup')
  })
})

describe('needsProfile', () => {
  it('is true for somebody signing in for the first time', () => {
    expect(needsProfile(null)).toBe(true)
  })

  it('is true when a profile exists but names no parish', () => {
    // The rules refuse an application whose submitter has no churchId,
    // so a profile without one is not usable even though it exists.
    expect(needsProfile({ uid: 'u1', churchId: '' })).toBe(true)
  })

  it('is false once a parish is recorded', () => {
    expect(needsProfile({ uid: 'u1', churchId: 'route-mhcp' })).toBe(false)
  })
})

describe('googleProfileFrom', () => {
  it('takes the name Google already knows', () => {
    const p = googleProfileFrom(
      { uid: 'u1', email: 'juan@example.com', displayName: 'Juan dela Cruz' },
      'route-mhcp',
    )
    expect(p.fullName).toBe('Juan dela Cruz')
    expect(p.email).toBe('juan@example.com')
    expect(p.churchId).toBe('route-mhcp')
  })

  it('falls back to the email name when Google gives no display name', () => {
    const p = googleProfileFrom(
      { uid: 'u1', email: 'juan.cruz@example.com', displayName: null },
      'route-mhcp',
    )
    expect(p.fullName).toBe('juan.cruz')
  })

  it('offers the first word of the name as the nickname', () => {
    // The greeting on Home reads "Welcome, Juan", not the whole name.
    const p = googleProfileFrom(
      { uid: 'u1', email: 'j@example.com', displayName: 'Juan dela Cruz' },
      'route-mhcp',
    )
    expect(p.nickname).toBe('Juan')
  })

  it('never claims a verified phone number', () => {
    // Google verifies an email address, not a phone. Claiming otherwise
    // would be the one thing phone verification exists to prevent, and
    // the rules reject a profile that asserts it.
    const p = googleProfileFrom(
      { uid: 'u1', email: 'j@example.com', displayName: 'J' },
      'route-mhcp',
    )
    expect(p.phoneVerified).toBe(false)
    expect(p.phoneNumber ?? '').toBe('')
  })

  it('never grants itself a role', () => {
    const p = googleProfileFrom(
      { uid: 'u1', email: 'j@example.com', displayName: 'J' },
      'route-mhcp',
    )
    expect(p.role).toBe('user')
  })
})
