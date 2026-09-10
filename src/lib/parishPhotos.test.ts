import { describe, expect, it } from 'vitest'
import {
  PARISH_FACADE_PHOTOS,
  PLACEHOLDER_PHOTO,
  hasRealPhoto,
  parishPhoto,
  parishPhotoAlt,
} from './parishPhotos'
import { ROUTES } from '../data'

describe('parishPhoto', () => {
  it('returns the real photograph for the parish that has one', () => {
    expect(parishPhoto('route-mhcp')).toContain('dioceseofkalookan.ph')
  })

  it('returns the placeholder for a parish with no photograph', () => {
    // San Roque had a stock photo of an unrelated church standing in for it.
    expect(parishPhoto('route-src')).toBe(PLACEHOLDER_PHOTO)
  })

  it('returns the placeholder rather than throwing on an unknown or missing id', () => {
    expect(parishPhoto('route-nonexistent')).toBe(PLACEHOLDER_PHOTO)
    expect(parishPhoto(null)).toBe(PLACEHOLDER_PHOTO)
    expect(parishPhoto(undefined)).toBe(PLACEHOLDER_PHOTO)
  })
})

describe('the photograph roster', () => {
  it('contains no stock-photo hosts', () => {
    // The specific failure this module was written to end: a stock image
    // presented as a named parish. If someone pastes one back in, this fails.
    for (const [routeId, url] of Object.entries(PARISH_FACADE_PHOTOS)) {
      expect(url, `${routeId} uses a stock photo host`).not.toMatch(
        /unsplash|pexels|pixabay|shutterstock|istockphoto|gettyimages/i,
      )
    }
  })

  it('only names routes that actually exist', () => {
    const known = new Set(ROUTES.map(r => r.id))
    for (const routeId of Object.keys(PARISH_FACADE_PHOTOS)) {
      expect(known.has(routeId), `${routeId} is not a known route`).toBe(true)
    }
  })
})

describe('parishPhotoAlt', () => {
  it('names the parish when the photograph really is of that parish', () => {
    expect(parishPhotoAlt('route-mhcp', 'Mary Help of Christians Parish')).toBe(
      'Mary Help of Christians Parish',
    )
  })

  it('is empty for the placeholder, which depicts no particular church', () => {
    // A screen reader would otherwise announce a drawing as "San Roque
    // Cathedral Caloocan" — which is how the caption read before.
    expect(parishPhotoAlt('route-src', 'San Roque Cathedral Parish')).toBe('')
  })
})

describe('hasRealPhoto', () => {
  it('distinguishes a real photograph from the placeholder', () => {
    expect(hasRealPhoto('route-mhcp')).toBe(true)
    expect(hasRealPhoto('route-src')).toBe(false)
    expect(hasRealPhoto(null)).toBe(false)
  })
})
