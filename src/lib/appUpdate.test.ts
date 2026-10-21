import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismiss,
  fetchLatest,
  isNewer,
  versionCodeOf,
  wasDismissed,
  type LatestRelease,
} from './appUpdate'

beforeEach(() => {
  localStorage.clear()
})

describe('versionCodeOf', () => {
  it('packs the three parts the way build.gradle does', () => {
    expect(versionCodeOf('1.0.0')).toBe(10000)
    expect(versionCodeOf('1.2.3')).toBe(10203)
    expect(versionCodeOf('2.0.0')).toBe(20000)
  })

  it('orders a two-digit minor above a one-digit one', () => {
    // The bug this exists to prevent: by string order "1.10.0" sorts
    // BEFORE "1.9.0", so the newer release is never offered.
    expect(versionCodeOf('1.10.0')).toBeGreaterThan(versionCodeOf('1.9.0'))
  })

  it('rejects anything that is not three numbers', () => {
    expect(versionCodeOf('1.0')).toBe(0)
    expect(versionCodeOf('1.0.0-beta')).toBe(0)
    expect(versionCodeOf('')).toBe(0)
    expect(versionCodeOf('x.y.z')).toBe(0)
  })

  it('tolerates surrounding whitespace', () => {
    expect(versionCodeOf('  1.0.1  ')).toBe(10001)
  })
})

const release = (over: Partial<LatestRelease> = {}): LatestRelease => ({
  versionName: '1.0.1',
  versionCode: 10001,
  url: '/download/SanctiWalk.apk',
  ...over,
})

describe('isNewer', () => {
  it('offers a newer release', () => {
    expect(isNewer('1.0.0', release())).toBe(true)
  })

  it('says nothing when it is the same version', () => {
    expect(isNewer('1.0.1', release())).toBe(false)
  })

  it('never offers a downgrade', () => {
    // Happens mid-deploy. Android would refuse the install anyway, so
    // offering it is strictly worse than silence.
    expect(isNewer('2.0.0', release())).toBe(false)
  })

  it('says nothing when there is no published release', () => {
    expect(isNewer('1.0.0', null)).toBe(false)
  })

  it('falls back to the version name when no code is published', () => {
    expect(isNewer('1.0.0', release({ versionCode: 0 }))).toBe(true)
  })

  it('says nothing when the installed version is unreadable', () => {
    expect(isNewer('unknown', release())).toBe(false)
  })

  it('says nothing when the published version is unreadable', () => {
    expect(isNewer('1.0.0', release({ versionCode: 0, versionName: 'nightly' }))).toBe(false)
  })
})

describe('fetchLatest', () => {
  const ok = (body: unknown) =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => body } as unknown as Response)

  it('reads a well-formed release', async () => {
    const got = await fetchLatest('/x.json', ok(release()) as unknown as typeof fetch)
    expect(got?.versionName).toBe('1.0.1')
    expect(got?.url).toBe('/download/SanctiWalk.apk')
  })

  it('keeps the notes when there are any', async () => {
    const got = await fetchLatest(
      '/x.json',
      ok(release({ notes: 'Rosary audio fixed' })) as unknown as typeof fetch,
    )
    expect(got?.notes).toBe('Rosary audio fixed')
  })

  it('returns null on a failed request', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false } as unknown as Response)
    expect(await fetchLatest('/x.json', f as unknown as typeof fetch)).toBeNull()
  })

  it('returns null when the network throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchLatest('/x.json', f as unknown as typeof fetch)).toBeNull()
  })

  it('returns null on a body that is not an object', async () => {
    expect(await fetchLatest('/x.json', ok('nope') as unknown as typeof fetch)).toBeNull()
  })

  it('returns null when the url is missing', async () => {
    const f = ok({ versionName: '1.0.1', versionCode: 10001 })
    expect(await fetchLatest('/x.json', f as unknown as typeof fetch)).toBeNull()
  })

  it('returns null when the version name is missing', async () => {
    const f = ok({ versionCode: 10001, url: '/a.apk' })
    expect(await fetchLatest('/x.json', f as unknown as typeof fetch)).toBeNull()
  })

  it('survives an HTML error page served as JSON', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    expect(await fetchLatest('/x.json', f as unknown as typeof fetch)).toBeNull()
  })
})

describe('dismissal', () => {
  it('is not dismissed to begin with', () => {
    expect(wasDismissed('1.0.1')).toBe(false)
  })

  it('stays dismissed for the version that was turned down', () => {
    dismiss('1.0.1')
    expect(wasDismissed('1.0.1')).toBe(true)
  })

  it('asks again for a newer version', () => {
    dismiss('1.0.1')
    expect(wasDismissed('1.0.2')).toBe(false)
  })
})
