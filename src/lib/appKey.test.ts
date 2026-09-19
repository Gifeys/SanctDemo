import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_KEY_HEADER, appKey, withAppKey } from './appKey'

afterEach(() => vi.unstubAllEnvs())

describe('appKey', () => {
  // Local development must keep working with no configuration. The server
  // only enforces the key when it has one, so an absent key is correct here
  // rather than an error.
  it('is empty when unset, and adds no header', () => {
    vi.stubEnv('VITE_APP_KEY', '')
    expect(appKey()).toBe('')
    expect(withAppKey()).toEqual({})
  })

  it('adds the header when a key is configured', () => {
    vi.stubEnv('VITE_APP_KEY', 'secret-123')
    expect(withAppKey()).toEqual({ [APP_KEY_HEADER]: 'secret-123' })
  })

  it('keeps headers the caller already set', () => {
    vi.stubEnv('VITE_APP_KEY', 'secret-123')
    expect(withAppKey({ 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
      [APP_KEY_HEADER]: 'secret-123',
    })
  })

  it('does not mutate the headers it was given', () => {
    vi.stubEnv('VITE_APP_KEY', 'secret-123')
    const original = { 'Content-Type': 'application/json' }
    withAppKey(original)
    expect(original).toEqual({ 'Content-Type': 'application/json' })
  })

  it('trims whitespace an .env file makes easy to leave behind', () => {
    vi.stubEnv('VITE_APP_KEY', '  secret-123  ')
    expect(withAppKey()[APP_KEY_HEADER]).toBe('secret-123')
  })
})
