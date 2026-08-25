import { describe, it, expect } from 'vitest'
import { buildChurchPinElement, buildPopupContent } from './mapMarkers'

describe('buildChurchPinElement', () => {
  it('marks a live parish pin as live, full-size', () => {
    const el = buildChurchPinElement({ name: 'San Roque Cathedral', isLive: true })
    expect(el.tagName).toBe('BUTTON')
    expect(el.type).toBe('button')
    expect(el.className).toBe('dmap__pin dmap__pin--live')
    expect(el.getAttribute('aria-label')).toBe('San Roque Cathedral')
  })

  it('marks a coming-soon parish pin as dimmed and labels it as such', () => {
    const el = buildChurchPinElement({ name: 'Birhen ng Lourdes Parish', isLive: false })
    expect(el.className).toBe('dmap__pin dmap__pin--soon')
    expect(el.getAttribute('aria-label')).toBe('Birhen ng Lourdes Parish — coming soon')
  })

  it('is always a real, focusable/tappable button — even coming-soon pins', () => {
    for (const isLive of [true, false]) {
      const el = buildChurchPinElement({ name: 'X', isLive })
      expect(el.tagName).toBe('BUTTON')
      expect(el.type).toBe('button')
    }
  })

  it('renders the church glyph (body, roof, cross) as an SVG', () => {
    const el = buildChurchPinElement({ name: 'X', isLive: true })
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.querySelector('rect')).not.toBeNull() // body
    expect(svg!.querySelector('polygon')).not.toBeNull() // roof
    expect(svg!.querySelectorAll('line').length).toBe(2) // cross
  })
})

describe('buildPopupContent', () => {
  it('shows a "View parish" action button for a live parish, not a coming-soon note', () => {
    const { el, action } = buildPopupContent({
      name: 'San Roque Cathedral',
      location: 'Vicariate of the Cathedral',
      isLive: true,
    })
    expect(el.querySelector('.dmap-card__name')?.textContent).toBe('San Roque Cathedral')
    expect(el.querySelector('.dmap-card__where')?.textContent).toBe('Vicariate of the Cathedral')
    expect(action).not.toBeNull()
    expect(action!.textContent).toBe('View parish')
    expect(el.querySelector('.dmap-card__soon')).toBeNull()
  })

  it('shows the coming-soon note for a non-live parish, with no action button', () => {
    const { el, action } = buildPopupContent({
      name: 'Birhen ng Lourdes Parish',
      location: 'Vicariate of Sacred Heart',
      isLive: false,
    })
    expect(action).toBeNull()
    expect(el.querySelector('.dmap-card__soon')?.textContent).toBe('Coming soon to SanctiWalk')
    expect(el.querySelector('.dmap-card__action')).toBeNull()
  })

  it('never renders a "View parish" button that navigates for a coming-soon parish', () => {
    const { el } = buildPopupContent({ name: 'X', isLive: false })
    expect(el.textContent).not.toContain('View parish')
  })

  it('omits the location paragraph when none is given', () => {
    const { el } = buildPopupContent({ name: 'X', isLive: true })
    expect(el.querySelector('.dmap-card__where')).toBeNull()
  })

  it('always renders the parish name as the first child (a heading)', () => {
    const { el } = buildPopupContent({ name: 'X', location: 'Y', isLive: true })
    expect(el.firstElementChild?.tagName).toBe('H3')
    expect(el.firstElementChild?.className).toBe('dmap-card__name')
  })
})
