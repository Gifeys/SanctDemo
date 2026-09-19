import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBase, apiUrl } from './apiBase'

function withBase(value: string | undefined) {
  vi.stubEnv('VITE_API_BASE', value as string)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('apiBase', () => {
  // The web build must keep calling the same origin it is served from.
  // Anything else would break the working app to serve the APK.
  it('is empty when unset, so the web build is unchanged', () => {
    withBase(undefined)
    expect(apiBase()).toBe('')
    expect(apiUrl('/api/identify')).toBe('/api/identify')
  })

  it('uses the configured server for a packaged build', () => {
    withBase('https://sanctiwalk.example.com')
    expect(apiUrl('/api/identify')).toBe('https://sanctiwalk.example.com/api/identify')
  })

  it('does not produce a double slash when the base has a trailing one', () => {
    withBase('https://sanctiwalk.example.com/')
    expect(apiUrl('/api/identify')).toBe('https://sanctiwalk.example.com/api/identify')
  })

  it('tolerates a path written without a leading slash', () => {
    withBase('https://sanctiwalk.example.com')
    expect(apiUrl('api/identify')).toBe('https://sanctiwalk.example.com/api/identify')
  })

  it('ignores surrounding whitespace, which an .env file makes easy to leave in', () => {
    withBase('  https://sanctiwalk.example.com  ')
    expect(apiUrl('/api/identify')).toBe('https://sanctiwalk.example.com/api/identify')
  })
})
