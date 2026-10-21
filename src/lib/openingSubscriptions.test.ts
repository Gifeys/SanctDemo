import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isWatched,
  onWatchChange,
  setWatched,
  watchKey,
  watchedKeys,
} from './openingSubscriptions'

beforeEach(() => {
  localStorage.clear()
})

describe('watchKey', () => {
  it('includes the item when there is one', () => {
    expect(watchKey({ kind: 'ministry', parishId: 'route-mhcp', itemId: 'choir' }))
      .toBe('ministry:route-mhcp:choir')
  })

  it('omits it for a parish-wide watch', () => {
    expect(watchKey({ kind: 'mass', parishId: 'route-mhcp' })).toBe('mass:route-mhcp')
  })

  it('keeps the same ministry in two parishes apart', () => {
    const a = watchKey({ kind: 'ministry', parishId: 'route-mhcp', itemId: 'choir' })
    const b = watchKey({ kind: 'ministry', parishId: 'route-sr', itemId: 'choir' })
    expect(a).not.toBe(b)
  })

  it('keeps a ministry and a sacrament of the same id apart', () => {
    const a = watchKey({ kind: 'ministry', parishId: 'p', itemId: 'x' })
    const b = watchKey({ kind: 'sacrament', parishId: 'p', itemId: 'x' })
    expect(a).not.toBe(b)
  })
})

describe('setWatched', () => {
  it('nothing is watched to begin with', () => {
    expect(isWatched({ kind: 'mass', parishId: 'route-mhcp' })).toBe(false)
  })

  it('remembers a watch', () => {
    setWatched({ kind: 'mass', parishId: 'route-mhcp' }, true)
    expect(isWatched({ kind: 'mass', parishId: 'route-mhcp' })).toBe(true)
  })

  it('survives being read back from storage', () => {
    setWatched({ kind: 'ministry', parishId: 'p', itemId: 'choir' }, true)
    expect([...watchedKeys()]).toEqual(['ministry:p:choir'])
  })

  it('removes one without touching the others', () => {
    setWatched({ kind: 'ministry', parishId: 'p', itemId: 'choir' }, true)
    setWatched({ kind: 'ministry', parishId: 'p', itemId: 'lector' }, true)
    setWatched({ kind: 'ministry', parishId: 'p', itemId: 'choir' }, false)

    expect(isWatched({ kind: 'ministry', parishId: 'p', itemId: 'choir' })).toBe(false)
    expect(isWatched({ kind: 'ministry', parishId: 'p', itemId: 'lector' })).toBe(true)
  })

  it('watching twice does not store it twice', () => {
    setWatched({ kind: 'mass', parishId: 'p' }, true)
    setWatched({ kind: 'mass', parishId: 'p' }, true)
    expect(watchedKeys().size).toBe(1)
  })

  it('unwatching something never watched is not an error', () => {
    setWatched({ kind: 'mass', parishId: 'p' }, false)
    expect(watchedKeys().size).toBe(0)
  })
})

describe('reading a corrupt store', () => {
  it('treats somebody else data in that slot as nothing watched', () => {
    localStorage.setItem('sanctiwalk.watch.v1', '{"not":"an array"}')
    expect(isWatched({ kind: 'mass', parishId: 'p' })).toBe(false)
  })

  it('treats a half-written value as nothing watched', () => {
    localStorage.setItem('sanctiwalk.watch.v1', '["mass:p"')
    expect(isWatched({ kind: 'mass', parishId: 'p' })).toBe(false)
  })

  it('drops non-strings rather than matching them', () => {
    localStorage.setItem('sanctiwalk.watch.v1', '["mass:p", 7, null]')
    expect([...watchedKeys()]).toEqual(['mass:p'])
  })
})

describe('onWatchChange', () => {
  it('tells a second bell on the same thing', () => {
    const seen = vi.fn()
    onWatchChange(seen)
    setWatched({ kind: 'mass', parishId: 'p' }, true)
    expect(seen).toHaveBeenCalled()
  })

  it('stops telling it once unsubscribed', () => {
    const seen = vi.fn()
    const off = onWatchChange(seen)
    off()
    setWatched({ kind: 'mass', parishId: 'p' }, true)
    expect(seen).not.toHaveBeenCalled()
  })

  it('one throwing listener does not silence the next', () => {
    const good = vi.fn()
    const offBad = onWatchChange(() => { throw new Error('nope') })
    const offGood = onWatchChange(good)
    setWatched({ kind: 'mass', parishId: 'p' }, true)
    expect(good).toHaveBeenCalled()
    offBad()
    offGood()
  })
})
